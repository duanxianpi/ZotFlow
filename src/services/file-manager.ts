import { Notice, requestUrl } from 'obsidian';
import { unzip, Unzipped } from 'fflate';
import { db } from '../db/db';
import { IDBZoteroFile } from '../types/db-schema';
import SparkMD5 from 'spark-md5';
import { WebDavClient } from '../api/webdav-api';
import { ZotFlowSettings } from '../settings';
import { SyncService } from './sync-service';

export class FileManager {
    private webdav: WebDavClient;
    private sync: SyncService;
    private settings: ZotFlowSettings;
    private downloadLocks: Map<string, Promise<Blob | null>> = new Map();

    constructor(webdav: WebDavClient, sync: SyncService, settings: ZotFlowSettings) {
        this.webdav = webdav;
        this.sync = sync;
        this.settings = settings;
    }

    public updateSettings(settings: ZotFlowSettings) {
        this.settings = settings;
    }

    /**
     * Get file blob from cache or download from Zotero API
     * (Entry Point)
     */
    async getFileBlob(itemKey: string): Promise<Blob | null> {
        // Check lock first
        if (this.downloadLocks.has(itemKey)) {
            console.log(`[ZotFlow] Download already in progress for ${itemKey}, sharing promise.`);
            return this.downloadLocks.get(itemKey)!;
        }

        // Get Item Metadata, We assume it's up-to-date
        const item = await db.items.get(itemKey);

        if (!item || item.itemType !== 'attachment') {
            new Notice(`Item metadata not found for ${itemKey}`);
            return null;
        }

        // Check Cache First (Fast Path)
        if (this.settings.useCache) {
            const cached = await db.files.get(itemKey);
            if (cached) {
                const serverMd5 = item.raw.data.md5;
                // If MD5 matches, or server doesn't provide MD5 (can't verify), consider cache valid
                if (!serverMd5 || cached.md5 === serverMd5) {
                    console.log(`[ZotFlow] Cache HIT for ${itemKey}`);
                    // Asynchronously update access time (non-blocking)
                    db.files.update(itemKey, { lastAccessedAt: new Date().toISOString() });
                    console.log(cached.blob);
                    return cached.blob;
                } else {
                    console.log(`[ZotFlow] Cache STALE for ${itemKey}. Server: ${serverMd5}, Local: ${cached.md5}`);
                    // Cache is stale, continue to download task...
                }
            }
        }

        // Start Download Task with Lock
        const task = this._downloadTask(itemKey, item).finally(() => {
            this.downloadLocks.delete(itemKey);
        });

        this.downloadLocks.set(itemKey, task);
        return task;
    }

    /**
     * Internal Download Task
     * Encapsulates logic for Download -> Verify -> Save -> Prune
     */
    private async _downloadTask(itemKey: string, item: any): Promise<Blob | null> {
        try {
            if (item.itemType !== 'attachment') return null;

            let buffer: ArrayBuffer | null = null;
            const linkMode = item.raw.data.linkMode;

            // Download Strategy
            switch (linkMode) {
                case 'linked_file':
                    console.log(`[ZotFlow] Linked file detected for ${itemKey}. Implementation pending.`);
                    break;
                case 'imported_file':
                case 'imported_url':
                    console.log(`[ZotFlow] Downloading from Zotero API for ${itemKey}`);
                    buffer = await this.downloadFromZoteroAPI(itemKey, item.libraryID);

                    if (!buffer && this.settings.useWebDav) {
                        console.log(`[ZotFlow] Downloading from WebDAV for ${itemKey}`);
                        buffer = await this.downloadFromWebDAV(itemKey);
                    }

                    break;
                default:
                    buffer = await this.downloadFromZoteroAPI(itemKey, item.libraryID);
                    break;
            }

            if (!buffer) {
                new Notice("Failed to download file.");
                return null;
            }

            // Integrity Check & Auto-Repair
            const serverMd5 = item.raw.data.md5;
            let finalMd5 = serverMd5 || '';

            if (serverMd5) {
                const calculatedMd5 = SparkMD5.ArrayBuffer.hash(buffer);

                if (calculatedMd5 !== serverMd5) {
                    const msg = `MD5 Mismatch for ${itemKey}!\nExpected: ${serverMd5}\nGot: ${calculatedMd5}`;
                    console.warn(`[ZotFlow] ${msg}`);

                    // Smart Repair Strategy:
                    // If downloaded from Zotero API, we trust the downloaded file is the latest.
                    // At this point, update local record's MD5, instead of erroring out.
                    if (linkMode === 'imported_file' || !this.settings.useWebDav) {
                        console.log("[ZotFlow] Trusting live download. Auto-updating metadata.");
                        finalMd5 = calculatedMd5; // Use actual calculated value
                        // Optional: Notify Sync service to refresh Item Metadata
                        // services.sync.refreshItem(itemKey); 
                    } else {
                        // WebDAV might be old, or sync not completed
                        new Notice(`⚠️ Integrity Warning: WebDAV file might be outdated.`);
                        // Still allow through, to prevent user from being unable to read
                    }
                } else {
                    console.log(`[ZotFlow] Integrity Verified: ${serverMd5}`);
                }
            } else {
                // If no serverMd5, calculate and save current value
                finalMd5 = SparkMD5.ArrayBuffer.hash(buffer);
            }

            const blob = new Blob([buffer], { type: item.raw.data.contentType || 'application/pdf' });

            // Save to Cache
            if (this.settings.useCache) {
                const fileRecord: IDBZoteroFile = {
                    key: itemKey,
                    blob: blob,
                    mimeType: item.raw.data.contentType || 'application/pdf',
                    fileName: item.raw.data.filename || 'file.pdf',
                    md5: finalMd5, // Use verified or repaired MD5
                    lastAccessedAt: new Date().toISOString(),
                    size: buffer.byteLength
                };

                await db.files.put(fileRecord);

                // Trigger Pruning (Fire & Forget)
                this.pruneCache();
            }

            return blob;

        } catch (error) {
            console.error("[ZotFlow] Download task error:", error);
            return null;
        }
    }

    /**
     * Download from WebDAV
     * Logic: Download .zip -> Unzip -> Find main file -> Return ArrayBuffer
     */

    private async downloadFromWebDAV(key: string): Promise<ArrayBuffer | null> {
        try {
            const zipPath = `${key}.zip`;
            const buffer = await this.webdav.downloadFile(zipPath);
            if (!buffer) return null;

            const uint8Input = new Uint8Array(buffer);

            const unzipped = await new Promise<Unzipped>((resolve, reject) => {
                unzip(uint8Input, {
                    filter: (file) => {
                        return !file.name.endsWith('/') &&
                            !file.name.startsWith('.') &&
                            !file.name.endsWith('.prop');
                    }
                }, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });

            const targetFileName = Object.keys(unzipped).first();

            if (!targetFileName) {
                throw new Error("Empty ZIP or only .prop found");
            }

            return unzipped[targetFileName]!.buffer as ArrayBuffer;

        } catch (e) {
            console.error("[ZotFlow] WebDAV Error:", e);
            return null;
        }
    }

    /**
     * Zotero API
     */
    private async downloadFromZoteroAPI(key: string, libraryID: number): Promise<ArrayBuffer | null> {
        const url = `https://api.zotero.org/users/${libraryID}/items/${key}/file/view`;

        try {
            const response = await requestUrl({
                url: url,
                method: 'GET',
                headers: {
                    'Zotero-API-Version': '3',
                    'Zotero-API-Key': this.settings.zoteroApiKey
                }
            });

            if (response.status !== 200) throw new Error(`API Error ${response.status}`);

            return response.arrayBuffer;

        } catch (e) {
            console.error("[ZotFlow] API Download Error:", e);
            return null;
        }
    }

    /**
     * LRU Cache Pruning
     * Remove oldest files when cache exceeds limit
     */
    private async pruneCache() {
        try {
            const limitMB = this.settings.maxCacheSizeMB;
            const limitBytes = limitMB * 1024 * 1024;

            const allFiles = await db.files.toArray();
            let totalSize = allFiles.reduce((acc, file) => acc + (file.size || 0), 0);

            if (totalSize <= limitBytes || limitBytes === 0) return;

            console.log(`[ZotFlow] Cache size (${(totalSize / 1024 / 1024).toFixed(1)}MB) exceeds limit (${limitMB}MB). Pruning...`);

            const sortedFiles = allFiles.sort((a, b) => {
                return (a.lastAccessedAt || '').localeCompare(b.lastAccessedAt || '');
            });

            const keysToDelete: string[] = [];

            // Remove files until we're under the limit
            for (const file of sortedFiles) {
                if (totalSize <= limitBytes) break;

                totalSize -= (file.size || 0);
                keysToDelete.push(file.key);
            }

            if (keysToDelete.length > 0) {
                await db.files.bulkDelete(keysToDelete);
                console.log(`[ZotFlow] Pruned ${keysToDelete.length} files.`);
            }

        } catch (e) {
            console.error("[ZotFlow] Prune cache failed:", e);
        }
    }
}