import type { AnyIDBZoteroItem, IDBZoteroItem } from "types/db-schema";
import { TemplateService } from "./template";
import { db } from "db/db";
import type { ZotFlowSettings } from "settings/types";
import type { AttachmentData } from "types/zotero-item";
import { getAnnotationJson } from "db/annotation";
import type { IParentProxy } from "bridge/types";
import type { AttachmentService } from "./attachment";
import type { PDFProcessWorker } from "./pdf-processor";

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
    private debouncers: Map<string, NodeJS.Timeout> = new Map();

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
        // Default options are empty, which means "normal update" (update only if version is different)
        const path = await this.ensureNote(libraryID, key, options);

        if (path) {
            console.log(`[ZotFlow] Opening note: ${path}`);
            await this.parentHost.openFile(path, true);
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
            clearTimeout(this.debouncers.get(debounceId));
            this.debouncers.delete(debounceId);
        }

        // Mode A: Immediate execution
        if (!debounce) {
            await this.ensureNote(libraryID, key, options);
            return;
        }

        // Mode B: Debounced execution (2 seconds delay)
        const timer = setTimeout(async () => {
            this.debouncers.delete(debounceId);
            try {
                await this.ensureNote(libraryID, key, options);
            } catch (e) {
                console.error(
                    `[ZotFlow] Debounced update failed for ${key}`,
                    e,
                );
            }
        }, DEBOUNCE_DELAY);

        this.debouncers.set(debounceId, timer);
    }

    /**
     * Batch create notes
     */
    async batchCreateNotes(items: AnyIDBZoteroItem[]) {
        this.parentHost.notify(
            "info",
            `Batch creation started for ${items.length} items.`,
        );
        for (const item of items) {
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
    ): Promise<string | undefined> {
        const { forceUpdateContent = false, forceUpdateImages = false } =
            options;

        // Prepare data
        const item = await db.items.get({ libraryID, key });
        const library = await db.libraries.get({ id: libraryID });

        if (!item || !library) {
            console.error(`[ZotFlow] Item or Library not found: ${key}`);
            return undefined;
        }

        // Determine path
        // Ask main thread first: which file does this Key correspond to? (Cache lookup)
        let path = await this.parentHost.getFileByKey(key);

        // If Cache lookup fails, calculate default path
        if (!path) {
            path = this.getNotePath(item, library);
        }

        // Check physical file status (Stat)
        const fileCheck = await this.parentHost.checkFile(path);

        try {
            if (fileCheck.exists) {
                // Case A: File exists -> Try update (version check)
                await this.performUpdate(
                    item,
                    path,
                    fileCheck,
                    forceUpdateContent,
                );
            } else {
                // Case B: File does not exist -> Create new file
                await this.performCreate(item, path);
            }

            // Post processing: Extract images (if setting is enabled)
            if (this.settings.autoImportAnnotationImages) {
                await this.extractAnnotationImages(item, forceUpdateImages);
            }

            return path;
        } catch (e) {
            console.error(`[ZotFlow] Failed to ensure note for ${key}`, e);
            this.parentHost.notify(
                "error",
                `Failed to save note for ${item.title}`,
            );
            return undefined;
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
        const templateContent = await this.parentHost.readTextFile(
            this.settings.sourceNoteTemplatePath,
        );
        const content = await this.templateService.renderItem(
            item,
            templateContent,
        );

        await this.parentHost.writeTextFile(path, content);
        await this.parentHost.indexFile(path);

        console.log(`[ZotFlow] Created note: ${path}`);
    }

    /**
     * Perform file update (with version check)
     */
    private async performUpdate(
        item: AnyIDBZoteroItem,
        path: string,
        fileCheck: any,
        forceUpdate: boolean,
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
            );

            await this.parentHost.writeTextFile(path, content);
            console.log(
                `[ZotFlow] Updated note: ${path} (v${currentVersion} -> v${newVersion})`,
            );
        } else {
            // Version is the same, skip writing
            // console.log(`[ZotFlow] Note is up to date: ${path}`);
        }
    }

    /**
     * Extract images from PDF annotations
     */
    private async extractAnnotationImages(
        item: AnyIDBZoteroItem,
        forceUpdateAnnotationImage: boolean,
    ) {
        // Get all PDF attachments
        let attachments = (await db.items
            .where({
                libraryID: item.libraryID,
                parentItem: item.key,
                itemType: "attachment",
            })
            .toArray()) as IDBZoteroItem<AttachmentData>[];

        attachments = attachments.filter(
            (a) => a.raw.data.contentType === "application/pdf",
        );

        for (const attachment of attachments) {
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
                if (!fileBlob) {
                    console.warn(
                        `[ZotFlow] Skipped image extraction: Attachment ${attachment.key} not found.`,
                    );
                    continue;
                }

                const buffer = await fileBlob.arrayBuffer();
                await this.pdfProcessor.renderAnnotations(
                    item.libraryID,
                    buffer,
                    annotations,
                );
            }
        }
    }

    async deleteAnnotationImage(annotationKey: string) {
        // Calculate image path
        const filename = `${annotationKey}.png`;
        const folder = this.settings.annotationImageFolder;
        const path = `${folder}/${filename}`;

        // Call main thread to delete file
        try {
            const exists = await this.parentHost.checkFile(path);
            if (exists.exists) {
                await this.parentHost.deleteFile(path);
                console.log(`[ZotFlow] Deleted orphaned image: ${path}`);
            }
        } catch (e) {
            console.warn(
                `[ZotFlow] Failed to delete image for ${annotationKey}:`,
                e,
            );
        }
    }

    /**
     * Generate default file path (Sanitization)
     */
    private getNotePath(item: AnyIDBZoteroItem, library: any): string {
        const illegalRe = /[\/?<>\\:*|"]/g;
        const controlRe = /[\x00-\x1f\x80-\x9f]/g;
        const reservedRe = /^\.+$/;
        const windowsReservedRe =
            /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

        let filename = `@${item.citationKey || item.title || item.key}`;
        filename = filename
            .replace(illegalRe, "")
            .replace(controlRe, "")
            .replace(reservedRe, "")
            .replace(windowsReservedRe, "");

        const folder = this.settings.sourceNoteFolder.replace(/\/$/, "");
        const extension = "md";

        let path = `${folder}/${library.name}/${filename}.${extension}`;
        console.log(`[ZotFlow] Generated note path: ${path}`);
        return path.replace(/\/+/g, "/");
    }
}
