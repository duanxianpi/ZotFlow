import type { AnyIDBZoteroItem, IDBZoteroItem } from "types/db-schema";
import { TemplateService } from "./template";
import { db } from "db/db";
import type { ZotFlowSettings } from "settings/types";
import type { AttachmentData } from "types/zotero-item";
import { getAnnotationJson } from "db/annotation";
import type { IParentProxy } from "bridge/types";
import type { AttachmentService } from "./attachment";
import type { PDFProcessWorker } from "./pdf-processor";
import { getNotePath } from "utils/utils";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";

const DEBOUNCE_DELAY = 2000;

/**
 * Update options interface
 */
export interface UpdateOptions {
    forceUpdateContent?: boolean;
    forceUpdateImages?: boolean;
}

export class NoteService {
    // Debounce map for update operations
    private debouncers: Map<string, ReturnType<typeof setTimeout>> = new Map();

    constructor(
        private settings: ZotFlowSettings,
        private templateService: TemplateService,
        private parentHost: IParentProxy,
        private attachmentService: AttachmentService,
        private pdfProcessor: PDFProcessWorker,
    ) {}

    updateSettings(newSettings: ZotFlowSettings) {
        this.settings = newSettings;
        this.templateService.updateSettings(newSettings);
    }

    /**
     * Clear all pending debounced operations.
     */
    dispose() {
        for (const timer of this.debouncers.values()) {
            clearTimeout(timer);
        }
        this.debouncers.clear();
    }

    /**
     * ============================================================
     * Public API
     * ============================================================
     */

    /**
     * Open note (core entry point)
     * Automatically find or create note
     * Smart update content (only update if version is different, unless specified force)
     * Open file in Obsidian
     */
    async openNote(
        libraryID: number,
        key: string,
        options: UpdateOptions = {},
    ) {
        try {
            const path = await this.ensureNote(libraryID, key, options);

            if (path) {
                this.parentHost.log(
                    "debug",
                    `Opening note: ${path}`,
                    "NoteService",
                );
                await this.parentHost.openFile(path, true);
            }
        } catch (e) {
            throw ZotFlowError.wrap(
                e,
                ZotFlowErrorCode.FILE_OPEN_FAILED,
                "NoteService",
                "Failed to open note",
            );
        }
    }

    /**
     * Trigger update (for background sync or manual refresh)
     * Support immediate execution or debounced execution
     */
    async triggerUpdate(
        libraryID: number,
        key: string,
        options: UpdateOptions = {},
        debounce: boolean = false,
    ) {
        const debounceId = `${libraryID}-${key}`;

        // Clear old timer
        if (this.debouncers.has(debounceId)) {
            clearTimeout(this.debouncers.get(debounceId)!);
            this.debouncers.delete(debounceId);
        }

        // Mode A: Immediate execution
        if (!debounce) {
            try {
                await this.ensureNote(libraryID, key, options);
            } catch (e) {
                throw ZotFlowError.wrap(
                    e,
                    ZotFlowErrorCode.FILE_WRITE_FAILED,
                    "NoteService",
                    "Immediate update failed",
                );
            }
            return;
        }

        // Mode B: Debounced execution (2 seconds delay)
        const timer = setTimeout(async () => {
            this.debouncers.delete(debounceId);
            try {
                await this.ensureNote(libraryID, key, options);
            } catch (e) {
                // Background task should not throw, just log
                this.parentHost.log(
                    "error",
                    `Debounced update failed for ${key}`,
                    "NoteService",
                    e,
                );
            }
        }, DEBOUNCE_DELAY);

        this.debouncers.set(debounceId, timer);
    }

    /**
     * Batch create notes
     * Wraps individual updates in try-catch to ensure batch continuity
     */
    async batchCreateNotes(items: AnyIDBZoteroItem[]) {
        this.parentHost.notify(
            "info",
            `Batch creation started for ${items.length} items.`,
        );

        let successCount = 0;
        let failCount = 0;

        for (const item of items) {
            try {
                // Batch operations do not open files, no debouncing
                await this.triggerUpdate(
                    item.libraryID,
                    item.key,
                    {
                        forceUpdateContent: false,
                        forceUpdateImages: false,
                    },
                    false,
                );
                successCount++;
            } catch (e) {
                this.parentHost.log(
                    "error",
                    `Failed to create note for ${item.key}`,
                    "NoteService",
                    e,
                );
                failCount++;
            }
        }

        if (failCount > 0) {
            this.parentHost.notify(
                "info",
                `Batch finished: ${successCount} success, ${failCount} failed.`,
            );
        } else {
            this.parentHost.notify(
                "info",
                `Batch creation finished successfully.`,
            );
        }
    }

    /**
     * ============================================================
     * Core Logic (Flow Control)
     * ============================================================
     */

    /**
     * Core logic: Ensure note is ready
     * Responsible for routing logic: Index lookup -> Default path fallback -> Existence check -> Create/Update
     */
    private async ensureNote(
        libraryID: number,
        key: string,
        options: UpdateOptions,
    ): Promise<string> {
        const { forceUpdateContent = false, forceUpdateImages = false } =
            options;

        // Prepare data
        const item = await db.items.get({ libraryID, key });
        const library = await db.libraries.get({ id: libraryID });

        if (!item || !library) {
            throw new ZotFlowError(
                ZotFlowErrorCode.RESOURCE_MISSING,
                "NoteService",
                `Item or Library not found: ${key}`,
            );
        }

        try {
            // Determine path
            // Ask main thread first: which file does this Key correspond to? (Cache lookup)
            let path = await this.parentHost.getFileByKey(key);

            // If Cache lookup fails, calculate default path
            if (!path) {
                path = getNotePath({
                    citationKey: item.citationKey,
                    title: item.title,
                    key: item.key,
                    sourceNoteFolder: this.settings.sourceNoteFolder,
                    libraryName: library.name,
                });
            }

            // Check physical file status
            const fileCheck = await this.parentHost.checkFile(path);

            if (
                fileCheck.exists &&
                fileCheck.frontmatter?.["zotero-key"] === key
            ) {
                // Case A: File exists -> Try update (version check)
                await this.performUpdate(
                    item,
                    fileCheck,
                    forceUpdateContent,
                    forceUpdateImages,
                );
            } else {
                // Case B: File does not exist or frontmatter is different -> Create new file
                await this.performCreate(item, path);

                // Post processing: Extract images (if setting is enabled)
                if (this.settings.autoImportAnnotationImages) {
                    try {
                        await this.extractAnnotationImages(item, true);
                    } catch (imgErr) {
                        // Non-fatal error: Image extraction failed, but note is saved.
                        this.parentHost.log(
                            "warn",
                            `Initial image extraction failed for ${key}`,
                            "NoteService",
                            imgErr,
                        );
                    }
                }
            }

            return path;
        } catch (e) {
            throw ZotFlowError.wrap(
                e,
                ZotFlowErrorCode.DB_WRITE_FAILED,
                "NoteService",
                `Ensure note failed: ${(e as Error).message}`,
            );
        }
    }

    /**
     * ============================================================
     * Execution Helpers (The Workers)
     * ============================================================
     */

    /**
     * Perform file creation
     */
    private async performCreate(item: AnyIDBZoteroItem, path: string) {
        // If file exists but is not our note (collision), create a file with different name
        let fileCheck = await this.parentHost.checkFile(path);
        let notePath = path;

        if (fileCheck.exists) {
            let counter = 1;
            const maxRetries = 100;
            while (fileCheck.exists && counter < maxRetries) {
                notePath = path.replace(/\.md$/, ` (${counter}).md`);
                fileCheck = await this.parentHost.checkFile(notePath);
                counter++;
            }
            if (counter >= maxRetries) {
                throw new ZotFlowError(
                    ZotFlowErrorCode.FILE_WRITE_FAILED,
                    "NoteService",
                    "Could not find a unique filename",
                );
            }
        }

        // Create empty file first
        await this.parentHost.writeTextFile(notePath, "");
        await this.parentHost.indexFile(notePath);

        // Then write content
        const templateContent = await this.parentHost.readTextFile(
            this.settings.sourceNoteTemplatePath,
        );

        // Render Item may throw ZotFlowError (Template Error), let it bubble
        const content = await this.templateService.renderItem(
            item,
            templateContent,
            {},
        );

        await this.parentHost.writeTextFile(notePath, content);

        console.log(`[ZotFlow] Created note: ${notePath}`);
    }

    /**
     * Perform file update (with version check)
     */
    private async performUpdate(
        item: AnyIDBZoteroItem,
        fileCheck: any,
        forceUpdate: boolean,
        forceUpdateImages: boolean,
    ) {
        // Read Frontmatter version from file
        const currentVersion =
            fileCheck.frontmatter?.["item-version"]?.toString();
        const newVersion = item.version.toString();

        // Only update if versions are different, or if forced update is specified
        if (forceUpdate || currentVersion !== newVersion) {
            const templateContent = await this.parentHost.readTextFile(
                this.settings.sourceNoteTemplatePath,
            );

            const content = await this.templateService.renderItem(
                item,
                templateContent,
                fileCheck.frontmatter || {},
            );

            await this.parentHost.writeTextFile(fileCheck.path, content);
            console.log(
                `[ZotFlow] Updated note: ${fileCheck.path} (v${currentVersion} -> v${newVersion})`,
            );

            // Extract images (if setting is enabled)
            if (this.settings.autoImportAnnotationImages) {
                try {
                    await this.extractAnnotationImages(item, forceUpdateImages);
                } catch (imgErr) {
                    throw ZotFlowError.wrap(
                        imgErr,
                        ZotFlowErrorCode.FILE_WRITE_FAILED,
                        "NoteService",
                        `Image update failed for ${item.key}`,
                    );
                }
            }
        } else {
            // Version is the same, skip writing
        }
    }

    /**
     * Extract images from PDF annotations.
     * Public to allow usage from batch tasks.
     */
    async extractAnnotationImages(
        item: AnyIDBZoteroItem,
        forceUpdateAnnotationImage: boolean,
    ) {
        // Get all PDF attachments
        let attachments: IDBZoteroItem<AttachmentData>[];

        if (item.itemType === "attachment") {
            attachments = [item as IDBZoteroItem<AttachmentData>];
        } else {
            attachments = (await db.items
                .where({
                    libraryID: item.libraryID,
                    parentItem: item.key,
                    itemType: "attachment",
                })
                .toArray()) as IDBZoteroItem<AttachmentData>[];
        }

        attachments = attachments.filter(
            (a) => a.raw.data.contentType === "application/pdf",
        );

        for (const attachment of attachments) {
            try {
                const annotations = await getAnnotationJson(
                    attachment,
                    this.settings.zoteroApiKey,
                    (a) => {
                        const isImage =
                            a.raw.data.annotationType === "image" ||
                            a.raw.data.annotationType === "ink";
                        // Logic: is image annotation && (never rendered || Zotero version updated || forced refresh)
                        const needsUpdate =
                            !a.annotationImageVersion ||
                            a.version > a.annotationImageVersion ||
                            forceUpdateAnnotationImage;
                        return isImage && needsUpdate;
                    },
                );

                if (annotations.length > 0) {
                    const fileBlob =
                        await this.attachmentService.getFileBlob(attachment);

                    if (fileBlob) {
                        const buffer = await fileBlob.arrayBuffer();
                        await this.pdfProcessor.renderAnnotations(
                            item.libraryID,
                            buffer,
                            annotations,
                        );
                    }
                }
            } catch (e) {
                throw ZotFlowError.wrap(
                    e,
                    ZotFlowErrorCode.FILE_WRITE_FAILED,
                    "NoteService",
                    `Failed to process attachment ${attachment.key}`,
                );
            }
        }
    }

    async saveBase64Image(image: string, annotationKey: string) {
        try {
            const base64 = image.split(",")[1]!;
            const binaryString = atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const folder = this.settings.annotationImageFolder.replace(
                /\/$/,
                "",
            );
            const path = `${folder}/${annotationKey}.png`;

            await this.parentHost.writeBinaryFile(path, bytes.buffer);
        } catch (e) {
            throw ZotFlowError.wrap(
                e,
                ZotFlowErrorCode.FILE_WRITE_FAILED,
                "NoteService",
                `Failed to save image ${annotationKey}`,
            );
        }
    }

    async deleteAnnotationImage(annotationKey: string) {
        // Calculate image path
        const filename = `${annotationKey}.png`;
        const folder = this.settings.annotationImageFolder.replace(/\/$/, "");
        const path = `${folder}/${filename}`;

        // Call main thread to delete file
        try {
            const exists = await this.parentHost.checkFile(path);
            if (exists.exists) {
                await this.parentHost.deleteFile(path);
                console.log(`[ZotFlow] Deleted orphaned image: ${path}`);
            }
        } catch (e) {
            throw ZotFlowError.wrap(
                e,
                ZotFlowErrorCode.FILE_WRITE_FAILED,
                "NoteService",
                `Failed to delete image ${annotationKey}: ${(e as Error).message}`,
            );
        }
    }
}
