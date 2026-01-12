import { db, getCombinations } from "db/db";
import { ZoteroAPIService } from "./zotero";
import { normalizeItem, normalizeCollection } from "utils/normalize";
import { AnyZoteroItem } from "types/zotero";
import { ZotFlowSettings } from "settings/types";
import { Zotero_Item_Types } from "types/zotero-item-const";
import { IParentProxy } from "bridge/parent-host";

const BULK_SIZE = 50; // Limit due to URL length

/**
 * Sync service for ZotFlow (Worker Side).
 * Handles the entire sync process, including collections and items.
 */
export class SyncService {
    private syncing = false;

    constructor(
        private zotero: ZoteroAPIService,
        private settings: ZotFlowSettings,
        private parentHost: IParentProxy,
    ) {}

    public updateSettings(settings: ZotFlowSettings) {
        this.settings = settings;
    }

    async startSync() {
        if (this.syncing) {
            this.parentHost.notify("info", "Sync is already running.");
            return;
        }

        if (!navigator.onLine) {
            this.parentHost.notify("info", "You are offline. Sync skipped.");
            return;
        }

        const apiKey = this.settings.zoteroApiKey;
        const librariesConfig = this.settings.librariesConfig;

        if (!apiKey) {
            this.parentHost.notify("error", "Zotero API key is missing.");
            return;
        }

        this.zotero.updateCredentials(apiKey);

        // Get Key Info first
        const keyInfo = await db.keys.get(apiKey);

        if (!keyInfo) {
            this.parentHost.notify(
                "error",
                "Invalid Zotero API key (not found in DB).",
            );
            return;
        }

        // Attempt to get group libraries if any
        const libraries = keyInfo.joinedGroups || [];

        // Always include personal library
        libraries.unshift(keyInfo.userID);

        if (!librariesConfig) {
            this.parentHost.notify("info", "No libraries configured for sync.");
            this.syncing = false;
            return;
        }

        this.syncing = true;
        this.parentHost.notify("info", "Started syncing...");
        console.log(`[ZotFlow] Start syncing`);

        try {
            await Promise.all(
                libraries.map(async (libKey) => {
                    const libConfig = librariesConfig[libKey];
                    const lib = await db.libraries.get(libKey);
                    if (!lib || !libConfig || libConfig.mode === "ignored")
                        return;

                    try {
                        // Step 1: Sync Collections
                        await this.pullCollections(lib.type, libKey);

                        // Step 2: Sync Items
                        await this.pullItems(lib.type, libKey);
                    } catch (error: any) {
                        console.error("[ZotFlow] Sync failed:", error);
                        this.parentHost.notify(
                            "error",
                            `Sync Failed for ${libKey}: ${error.message}`,
                        );
                    }
                }),
            );
            this.parentHost.notify("success", "Sync completed successfully!");
            console.log("[ZotFlow] Sync finished.");
        } finally {
            this.syncing = false;
        }
    }

    // ========================================================================
    // Collection Pull
    // ========================================================================
    private async pullCollections(
        libraryType: "user" | "group",
        libraryID: number,
    ) {
        if (!this.zotero) return;
        const libHandle = this.zotero.client.library(libraryType, libraryID);

        // Get Local Version
        const libState = await db.libraries.get(libraryID);
        const localVersion = libState?.collectionVersion || 0;

        console.log(`[ZotFlow] Pulling collections from v${localVersion}...`);

        // Get Changed Versions
        const response = await libHandle.collections().get({
            format: "versions",
            since: localVersion,
        });

        const versionsMap = (await (
            response.getData() as Response
        ).json()) as Record<string, number>;
        const serverHeaderVersion = response.getVersion() || 0;

        // Early Return (Check if up to date)
        if (serverHeaderVersion <= localVersion) {
            console.log("[ZotFlow] Collections are up to date.");
            return;
        }

        const keysToFetch = Object.keys(versionsMap);

        // Batch Fetch Data
        if (keysToFetch.length > 0) {
            const slices = this.chunkArray(keysToFetch, BULK_SIZE);

            for (const slice of slices) {
                const batchRes = await libHandle.collections().get({
                    collectionKey: slice.join(","),
                });
                const collections = batchRes.raw;

                if (collections.length > 0) {
                    const cleanCollections = collections.map((raw: any) =>
                        normalizeCollection(raw, libraryID),
                    );

                    // Transaction Write
                    await db.transaction("rw", db.collections, async () => {
                        await db.collections.bulkPut(cleanCollections);
                    });
                }
            }
            this.parentHost.notify(
                "info",
                `Updated ${keysToFetch.length} collections.`,
            );
            console.log(`[ZotFlow] Updated ${keysToFetch.length} collections.`);
        }

        // Handle Deletions
        if (localVersion > 0) {
            const delResponse = await libHandle.deleted(localVersion).get();
            const deletedKeys = delResponse.getData().collections;

            if (deletedKeys.length > 0) {
                await db.transaction("rw", db.collections, async () => {
                    const childKeys = await db.collections
                        .where(["libraryID", "parentCollection"])
                        .anyOf(getCombinations([[libraryID], deletedKeys]))
                        .primaryKeys();

                    const allKeysToDelete = Array.from(
                        new Set([...deletedKeys, ...childKeys]),
                    );
                    await db.collections.bulkDelete(allKeysToDelete);
                });
                console.log(
                    `[ZotFlow] Deleted ${deletedKeys.length} collections.`,
                );
            }
        }

        // Update Version
        await db.libraries.update(libraryID, {
            collectionVersion: serverHeaderVersion,
        });
    }

    // ========================================================================
    // Item Pull
    // ========================================================================
    private async pullItems(libraryType: "user" | "group", libraryID: number) {
        if (!this.zotero) return;
        const libHandle = this.zotero.client.library(libraryType, libraryID);

        const libState = await db.libraries.get(libraryID);
        const localVersion = libState?.itemVersion || 0;

        console.log(`[ZotFlow] Pulling items from v${localVersion}...`);

        // Get All Changed Versions
        const response = await libHandle.items().get({
            format: "versions",
            since: localVersion,
            includeTrashed: false,
        });

        const versionsMap = (await (
            response.getData() as Response
        ).json()) as Record<string, number>;
        const serverHeaderVersion = response.getVersion() || 0;

        if (serverHeaderVersion <= localVersion) {
            console.log("[ZotFlow] Items are up to date.");
            return;
        }

        const keysToFetch = Object.keys(versionsMap);
        console.log(`[ZotFlow] Found ${keysToFetch.length} items to update.`);
        this.parentHost.notify(
            "info",
            `Found ${keysToFetch.length} items to update.`,
        );

        // Batch Fetch Data
        if (keysToFetch.length > 0) {
            const slices = this.chunkArray(keysToFetch, BULK_SIZE);
            let processedCount = 0;

            for (const slice of slices) {
                const batchRes = await libHandle.items().get({
                    itemKey: slice.join(","),
                });

                const items = batchRes.raw;

                if (items.length > 0) {
                    const cleanItems = items.map((raw: any) =>
                        normalizeItem(raw as AnyZoteroItem, libraryID),
                    );

                    // Transaction Write
                    await db.transaction("rw", db.items, async () => {
                        await db.items.bulkPut(cleanItems);
                    });

                    processedCount += items.length;
                    this.parentHost.notify(
                        "info",
                        `Synced ${processedCount} / ${keysToFetch.length} items...`,
                    );
                }
            }
            console.log(`[ZotFlow] Synced ${processedCount} items.`);
        }

        // Handle Deletions
        if (localVersion > 0) {
            const delResponse = await libHandle.deleted(localVersion).get();
            const deletedKeys = delResponse.getData().items;

            if (deletedKeys && deletedKeys.length > 0) {
                await db.transaction("rw", db.items, async () => {
                    // Cascade delete orphan nodes
                    const childKeys = await db.items
                        .where(["libraryID", "parentItem", "itemType"])
                        .anyOf(
                            getCombinations([
                                [libraryID],
                                deletedKeys,
                                Zotero_Item_Types,
                            ]),
                        )
                        .primaryKeys();

                    const allKeysToDelete = Array.from(
                        new Set([...deletedKeys, ...childKeys]),
                    );
                    await db.items.bulkDelete(allKeysToDelete);

                    console.log(
                        `[ZotFlow] Deleted ${deletedKeys.length} items + ${childKeys.length} orphans.`,
                    );
                });
            }
        }

        // Update Version
        await db.libraries.update(libraryID, {
            itemVersion: serverHeaderVersion,
        });
        console.log(
            `[ZotFlow] Item sync finished. New Version: ${serverHeaderVersion}`,
        );
    }

    private chunkArray<T>(array: T[], size: number): T[][] {
        const result = [];
        for (let i = 0; i < array.length; i += size) {
            result.push(array.slice(i, i + size));
        }
        return result;
    }
}
