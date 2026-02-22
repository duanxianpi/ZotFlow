// Worker-side File Manager
import { unzip } from "fflate";
import { db } from "db/db";
import SparkMD5 from "spark-md5";
import { WebDavService } from "./webdav";
import { ZoteroAPIService } from "./zotero";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";

import type { Unzipped } from "fflate";
import type { ZotFlowSettings } from "settings/types";
import type { AttachmentData } from "types/zotero-item";
import type { IParentProxy } from "bridge/types";
import type { IDBZoteroFile, IDBZoteroItem } from "types/db-schema";

/**
 * Attachment management service for ZotFlow (Worker Side).
 */
export class AttachmentService {
    private downloadLocks: Map<string, Promise<Blob>> = new Map();

    constructor(
        private webdav: WebDavService,
        private settings: ZotFlowSettings,
        private zotero: ZoteroAPIService,
        private parentHost: IParentProxy,
    ) {}

    public updateSettings(settings: ZotFlowSettings) {
        this.settings = settings;
    }

    /**
     * Get file blob from cache or download from Zotero API
     * (Entry Point)
     */
    async getFileBlob(
        attachmentItem: IDBZoteroItem<AttachmentData>,
    ): Promise<Blob> {
        const { libraryID, key: itemKey } = attachmentItem;

        // Check Lock
        if (this.downloadLocks.has(itemKey)) {
            this.parentHost.log(
                "info",
                `Download already in progress for ${itemKey}, sharing promise.`,
                "AttachmentService",
            );
            return this.downloadLocks.get(itemKey)!;
        }

        // Validate Metadata
        const item = await db.items.get([libraryID, itemKey]);
        if (!item || item.itemType !== "attachment") {
            throw new ZotFlowError(
                ZotFlowErrorCode.RESOURCE_MISSING,
                "AttachmentService",
                `Item metadata not found for ${itemKey}`,
            );
        }

        // Check Cache (Fast Path)
        if (this.settings.useCache) {
            try {
                const cached = await db.files.get([libraryID, itemKey]);
                if (cached) {
                    const serverMd5 = item.raw.data.md5;
                    // If MD5 matches, or server doesn't provide MD5, consider cache valid
                    if (!serverMd5 || cached.md5 === serverMd5) {
                        this.parentHost.log(
                            "info",
                            `Cache HIT for ${itemKey}`,
                            "AttachmentService",
                        );
                        // Non-blocking access time update
                        db.files.update(cached, {
                            lastAccessedAt: new Date().toISOString(),
                        });
                        return cached.blob;
                    } else {
                        this.parentHost.log(
                            "warn",
                            `Cache STALE for ${itemKey}. Server: ${serverMd5}, Local: ${cached.md5}`,
                            "AttachmentService",
                        );
                    }
                }
            } catch (e) {
                this.parentHost.log(
                    "warn",
                    "Cache lookup failed, proceeding to download",
                    "AttachmentService",
                    e,
                );
                // Don't throw here, just fall through to download
            }
        }

        // Start Download Task (with Lock)
        this.parentHost.notify("info", `Downloading ${item.raw.data.filename}`);

        const task = this._downloadTask(item)
            .then((blob) => {
                this.parentHost.notify(
                    "info",
                    `Downloaded ${item.raw.data.filename}`,
                );
                return blob;
            })
            .finally(() => {
                this.downloadLocks.delete(item.key);
            });

        this.downloadLocks.set(item.key, task);

        return task;
    }

    /**
     * Internal Download Task
     * Encapsulates logic for Download -> Verify -> Save -> Prune
     */
    private async _downloadTask(
        item: IDBZoteroItem<AttachmentData>,
    ): Promise<Blob> {
        let buffer: ArrayBuffer | null = null;
        const linkMode = item.raw.data.linkMode;

        // Download Strategy
        switch (linkMode) {
            case "linked_file":
                throw new ZotFlowError(
                    ZotFlowErrorCode.UNKNOWN,
                    "AttachmentService",
                    `Linked file detected for ${item.key}. Not implemented.`,
                );
            case "imported_file":
            case "imported_url":
                // Try WebDAV first if enabled
                if (this.settings.useWebDav) {
                    try {
                        this.parentHost.log(
                            "info",
                            `Downloading from WebDAV for ${item.key}`,
                            "AttachmentService",
                        );
                        buffer = await this.downloadFromWebDAV(item.key);
                    } catch (e) {
                        this.parentHost.log(
                            "error",
                            `WebDAV failed for ${item.key}, falling back to API.`,
                            "AttachmentService",
                            e,
                        );
                    }
                }

                // If WebDAV disabled or failed, use API
                if (!buffer) {
                    this.parentHost.log(
                        "info",
                        `Downloading from Zotero API for ${item.key}`,
                        "AttachmentService",
                    );
                    buffer = await this.downloadFromZoteroAPI(item);
                }
                break;
            default:
                buffer = await this.downloadFromZoteroAPI(item);
                break;
        }

        if (!buffer) {
            // Should be unreachable if sub-methods throw correctly, but safe-guard
            throw new ZotFlowError(
                ZotFlowErrorCode.NETWORK_ERROR,
                "AttachmentService",
                "Download resulted in empty buffer",
            );
        }

        // B. Integrity Check & Auto-Repair
        const serverMd5 = item.raw.data.md5;
        let finalMd5 = serverMd5 || "";

        if (serverMd5) {
            const calculatedMd5 = SparkMD5.ArrayBuffer.hash(buffer);

            if (calculatedMd5 !== serverMd5) {
                const msg = `MD5 Mismatch for ${item.key}! Expected: ${serverMd5}, Got: ${calculatedMd5}`;
                this.parentHost.log("warn", msg, "AttachmentService");

                // Smart Repair Strategy
                if (linkMode === "imported_file" || !this.settings.useWebDav) {
                    this.parentHost.log(
                        "info",
                        "Trusting live download. Auto-updating metadata.",
                        "AttachmentService",
                    );
                    finalMd5 = calculatedMd5;
                } else {
                    // WebDAV might be stale. We warn but allow it (don't throw),
                    // because user might still want to read the (slightly old) file.
                    this.parentHost.log(
                        "warn",
                        "Integrity Warning: WebDAV file might be outdated.",
                        "AttachmentService",
                    );
                }
            }
        } else {
            finalMd5 = SparkMD5.ArrayBuffer.hash(buffer);
        }

        const blob = new Blob([buffer], {
            type: item.raw.data.contentType || "application/pdf",
        });

        // C. Save to Cache
        if (this.settings.useCache) {
            try {
                const fileRecord: IDBZoteroFile = {
                    libraryID: item.libraryID,
                    key: item.key,
                    blob: blob,
                    mimeType: item.raw.data.contentType || "application/pdf",
                    fileName: item.raw.data.filename || "file.pdf",
                    md5: finalMd5,
                    lastAccessedAt: new Date().toISOString(),
                    size: buffer.byteLength,
                };

                await db.files.put(fileRecord);

                // Fire & Forget Pruning
                this.pruneCache().catch((e) =>
                    this.parentHost.log(
                        "error",
                        "Background prune failed",
                        "AttachmentService",
                        e,
                    ),
                );
            } catch (e) {
                this.parentHost.log(
                    "error",
                    "Failed to save to cache",
                    "AttachmentService",
                    e,
                );
                // Cache failure shouldn't stop the user from viewing the file, so we don't throw.
            }
        }

        return blob;
    }

    /**
     * Download from WebDAV
     */
    private async downloadFromWebDAV(key: string): Promise<ArrayBuffer> {
        try {
            const zipPath = `${key}.zip`;
            const buffer = await this.webdav.downloadFile(zipPath);

            if (!buffer) {
                throw new ZotFlowError(
                    ZotFlowErrorCode.RESOURCE_MISSING,
                    "AttachmentService",
                    `WebDAV file ${zipPath} is empty or missing`,
                );
            }

            const uint8Input = new Uint8Array(buffer);

            // Wrap unzip in a promise to handle async callback errors
            return await new Promise<ArrayBuffer>((resolve, reject) => {
                unzip(
                    uint8Input,
                    {
                        filter: (file) =>
                            !file.name.endsWith("/") &&
                            !file.name.startsWith(".") &&
                            !file.name.endsWith(".prop"),
                    },
                    (err, unzipped) => {
                        if (err) {
                            reject(
                                new ZotFlowError(
                                    ZotFlowErrorCode.PARSE_ERROR,
                                    "AttachmentService",
                                    `Unzip failed: ${err.message}`,
                                ),
                            );
                            return;
                        }

                        const targetFileName = Object.keys(unzipped)[0];
                        if (!targetFileName || !unzipped[targetFileName]) {
                            reject(
                                new ZotFlowError(
                                    ZotFlowErrorCode.PARSE_ERROR,
                                    "AttachmentService",
                                    "Empty ZIP or only .prop found",
                                ),
                            );
                            return;
                        }

                        resolve(
                            unzipped[targetFileName]!.buffer as ArrayBuffer,
                        );
                    },
                );
            });
        } catch (e) {
            throw ZotFlowError.wrap(
                e,
                ZotFlowErrorCode.NETWORK_ERROR,
                "AttachmentService",
                `WebDAV Download Error:`,
            );
        }
    }

    /**
     * Zotero API
     * Throws ZotFlowError on failure
     */
    private async downloadFromZoteroAPI(
        item: IDBZoteroItem<AttachmentData>,
    ): Promise<ArrayBuffer> {
        try {
            const response = await fetch(
                `https://api.zotero.org/${item.raw.library.type}s/${item.libraryID}/items/${item.key}/file`,
                {
                    headers: {
                        "Zotero-API-Key": this.settings.zoteroapikey,
                    },
                },
            );

            if (!response.ok) {
                // Translate HTTP Status Codes to ZotFlowErrorCode
                if (response.status === 403 || response.status === 401) {
                    throw new ZotFlowError(
                        ZotFlowErrorCode.AUTH_INVALID,
                        "AttachmentService",
                        `Zotero API Auth Failed: ${response.status}`,
                    );
                }
                if (response.status === 404) {
                    throw new ZotFlowError(
                        ZotFlowErrorCode.RESOURCE_MISSING,
                        "AttachmentService",
                        `File not found on Zotero Server`,
                    );
                }
                if (response.status === 429) {
                    throw new ZotFlowError(
                        ZotFlowErrorCode.API_LIMIT,
                        "AttachmentService",
                        `Zotero API Rate Limit Exceeded`,
                    );
                }
                throw new ZotFlowError(
                    ZotFlowErrorCode.NETWORK_ERROR,
                    "AttachmentService",
                    `Zotero API Error: ${response.status} ${response.statusText}`,
                );
            }

            const buffer = await response.arrayBuffer();

            // Handle ZIP response from API (rare but possible for some storage modes)
            if (response.headers.get("content-type") === "application/zip") {
                const uint8Input = new Uint8Array(buffer);
                return await new Promise<ArrayBuffer>((resolve, reject) => {
                    unzip(
                        uint8Input,
                        {
                            filter: (file) =>
                                !file.name.endsWith("/") &&
                                !file.name.startsWith(".") &&
                                !file.name.endsWith(".prop"),
                        },
                        (err, unzipped) => {
                            if (err) {
                                reject(
                                    new ZotFlowError(
                                        ZotFlowErrorCode.PARSE_ERROR,
                                        "AttachmentService",
                                        `API Zip Unzip failed: ${err.message}`,
                                    ),
                                );
                                return;
                            }
                            const targetFileName = Object.keys(unzipped)[0];
                            if (!targetFileName) {
                                reject(
                                    new ZotFlowError(
                                        ZotFlowErrorCode.PARSE_ERROR,
                                        "AttachmentService",
                                        "API ZIP Empty",
                                    ),
                                );
                                return;
                            }
                            resolve(
                                unzipped[targetFileName]!.buffer as ArrayBuffer,
                            );
                        },
                    );
                });
            }

            return buffer;
        } catch (e) {
            throw ZotFlowError.wrap(
                e,
                ZotFlowErrorCode.NETWORK_ERROR,
                "AttachmentService",
                `API Fetch Failed: ${(e as Error).message}`,
            );
        }
    }

    /**
     * Return the total size in bytes of all cached files.
     */
    async getCacheTotalSizeBytes(): Promise<number> {
        const allFiles = await db.files.toArray();
        return allFiles.reduce((acc, file) => acc + (file.size || 0), 0);
    }

    /**
     * Delete all cached files.
     */
    async purgeCache(): Promise<void> {
        await db.files.clear();
    }

    /**
     * LRU Cache Pruning
     */
    private async pruneCache() {
        try {
            const limitMB = this.settings.maxCacheSizeMB;
            const limitBytes = limitMB * 1024 * 1024;

            const allFiles = await db.files.toArray();
            let totalSize = allFiles.reduce(
                (acc, file) => acc + (file.size || 0),
                0,
            );

            if (totalSize <= limitBytes || limitBytes === 0) return;

            this.parentHost.log(
                "info",
                `Cache size (${(totalSize / 1024 / 1024).toFixed(1)}MB) exceeds limit (${limitMB}MB). Pruning...`,
                "AttachmentService",
            );

            const sortedFiles = allFiles.sort((a, b) =>
                (a.lastAccessedAt || "").localeCompare(b.lastAccessedAt || ""),
            );

            const keysToDelete: [number, string][] = [];

            for (const file of sortedFiles) {
                if (totalSize <= limitBytes) break;
                totalSize -= file.size || 0;
                keysToDelete.push([file.libraryID, file.key]);
            }

            if (keysToDelete.length > 0) {
                await db.transaction("rw", db.files, async () => {
                    await db.files.bulkDelete(keysToDelete);
                });
                this.parentHost.log(
                    "info",
                    `Pruned ${keysToDelete.length} files.`,
                    "AttachmentService",
                );
            }
        } catch (e) {
            this.parentHost.log(
                "error",
                `Prune cache failed: ${(e as Error).message}`,
                "AttachmentService",
                e,
            );
        }
    }
}
