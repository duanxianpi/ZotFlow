import { db } from '../db/db';
import { ZoteroApiClient } from '../api/zotero-api';
import { normalizeItem, normalizeCollection } from '../utils/normalize';
import { Notice } from 'obsidian';
import { ApiChain } from 'zotero-api-client';
import { ZoteroItemData } from 'types/zotero-item';
import { ZoteroItem, AnyZoteroItem } from 'types/zotero';

const BULK_SIZE = 50; // Limit due to URL length

export class SyncService {
  private syncing = false;
  private api: ApiChain | null = null;
  private userID: number = 0;

  async startSync(apiKey: string, userID: number) {
    if (this.syncing) {
      new Notice('ZotFlow: Sync is already running.');
      return;
    }
    if (!navigator.onLine) {
      new Notice('ZotFlow: You are offline. Sync skipped.');
      return;
    }

    this.syncing = true;
    this.userID = userID;
    this.api = new ZoteroApiClient(apiKey).getClient();

    new Notice('ZotFlow: Started syncing...');
    console.log(`[ZotFlow] Start syncing for User ${userID}`);

    try {
      // Step 0: Ensure Library Record
      const libState = await db.libraries.get(this.userID);
      if (!libState) {
        await db.libraries.add({
          id: this.userID,
          type: 'user',
          name: 'My Personal Library',
          collectionVersion: 0,
          itemVersion: 0,
        });
      }

      // Step 1: Sync Collections
      await this.pullCollections();

      // Step 2: Sync Items
      await this.pullItems();

      new Notice('ZotFlow: Sync completed successfully!');
      console.log('[ZotFlow] Sync finished.');

    } catch (error: any) {
      console.error('[ZotFlow] Sync failed:', error);
      new Notice(`ZotFlow Sync Failed: ${error.message}`);
    } finally {
      this.syncing = false;
      this.api = null;
    }
  }

  // ========================================================================
  // Collection Pull
  // ========================================================================
  private async pullCollections() {
    if (!this.api) return;
    const libHandle = this.api.library('user', this.userID);

    // Get Local Version
    const libState = await db.libraries.get(this.userID);
    const localVersion = libState?.collectionVersion || 0;

    console.log(`[ZotFlow] Pulling collections from v${localVersion}...`);

    // Get Changed Versions
    const response = await libHandle.collections().get({
      format: 'versions',
      since: localVersion
    });

    const versionsMap = await (response.getData() as Response).json() as Record<string, number>;
    const serverHeaderVersion = response.getVersion() || 0;

    // Early Return (Check if up to date)
    if (serverHeaderVersion <= localVersion) {
      console.log('[ZotFlow] Collections are up to date.');
      return;
    }

    const keysToFetch = Object.keys(versionsMap);

    // Batch Fetch Data
    if (keysToFetch.length > 0) {
      const slices = this.chunkArray(keysToFetch, BULK_SIZE);

      for (const slice of slices) {
        const batchRes = await libHandle.collections().get({
          collectionKey: slice.join(','),
        });
        const collections = batchRes.raw;

        if (collections.length > 0) {
          const cleanCollections = collections.map((raw: any) => normalizeCollection(raw, this.userID));

          // Transaction Write
          await db.transaction('rw', db.collections, async () => {
            await db.collections.bulkPut(cleanCollections);
          });
        }
      }
      console.log(`[ZotFlow] Updated ${keysToFetch.length} collections.`);
    }

    // Handle Deletions
    if (localVersion > 0) {
      const delResponse = await libHandle.collections().deleted(localVersion).get();
      const deletedKeys = delResponse.getData().collections;

      if (deletedKeys.length > 0) {
        await db.transaction('rw', db.collections, async () => {
          await db.collections.bulkDelete(deletedKeys);
        });
        console.log(`[ZotFlow] Deleted ${deletedKeys.length} collections.`);
      }
    }

    // Update Version
    await db.libraries.update(this.userID, { collectionVersion: serverHeaderVersion });
  }

  // ========================================================================
  // Item Pull
  // ========================================================================
  private async pullItems() {
    if (!this.api) return;
    const libHandle = this.api.library('user', this.userID);

    const libState = await db.libraries.get(this.userID);
    const localVersion = libState?.itemVersion || 0;

    console.log(`[ZotFlow] Pulling items from v${localVersion}...`);

    // Get All Changed Versions
    const response = await libHandle.items().get({
      format: 'versions',
      since: localVersion
    });

    const versionsMap = await (response.getData() as Response).json() as Record<string, number>;
    const serverHeaderVersion = response.getVersion() || 0;

    if (serverHeaderVersion <= localVersion) {
      console.log('[ZotFlow] Items are up to date.');
      return;
    }

    const keysToFetch = Object.keys(versionsMap);
    console.log(`[ZotFlow] Found ${keysToFetch.length} items to update.`);

    // Batch Fetch Data
    if (keysToFetch.length > 0) {
      const slices = this.chunkArray(keysToFetch, BULK_SIZE);
      let processedCount = 0;

      for (const slice of slices) {
        const batchRes = await libHandle.items().get({
          itemKey: slice.join(',')
        });

        const items = batchRes.raw;

        if (items.length > 0) {
          const cleanItems = items.map((raw: any) => normalizeItem(raw as AnyZoteroItem, this.userID));

          // Transaction Write
          await db.transaction('rw', db.items, async () => {
            await db.items.bulkPut(cleanItems);
          });

          processedCount += items.length;
        }
      }
      console.log(`[ZotFlow] Synced ${processedCount} items.`);
    }

    // Handle Deletions
    if (localVersion > 0) {
      const delResponse = await libHandle.items().deleted(localVersion).get();
      const deletedKeys = delResponse.getData().items;

      if (deletedKeys && deletedKeys.length > 0) {
        await db.transaction('rw', db.items, async () => {
          // Cascade delete orphan nodes
          const childKeys = await db.items
            .where('parentItem')
            .anyOf(deletedKeys)
            .primaryKeys();

          const allKeysToDelete = Array.from(new Set([...deletedKeys, ...childKeys]));
          await db.items.bulkDelete(allKeysToDelete);

          console.log(`[ZotFlow] Deleted ${deletedKeys.length} items + ${childKeys.length} orphans.`);
        });
      }
    }

    // Update Version
    await db.libraries.update(this.userID, { itemVersion: serverHeaderVersion });
    console.log(`[ZotFlow] Item sync finished. New Version: ${serverHeaderVersion}`);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }
}