import { BaseTask } from "../base";
import { db } from "db/db";
import { getAnnotationJson } from "db/annotation";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";

import type { NoteService } from "worker/services/note";
import type { AttachmentService } from "worker/services/attachment";
import type { PDFProcessWorker } from "worker/services/pdf-processor";
import type { ZotFlowSettings } from "settings/types";
import type { IDBZoteroItem, AnyIDBZoteroItem } from "types/db-schema";
import type { AttachmentData, AnnotationData } from "types/zotero-item";

/**
 * Input descriptor for batch image extraction.
 */
export interface BatchExtractImagesInput {
    /** Library IDs to include. If empty, all synced libraries are used. */
    libraryIDs?: number[];
    /** Specific parent item keys. If provided, only extract images for these items. */
    itemKeys?: string[];
    /** Force re-render even if annotationImageVersion matches. */
    forceUpdate?: boolean;
}

/**
 * BatchExtractImagesTask — extracts annotation images from PDF attachments.
 *
 * For each item:
 *   1. Find PDF attachments
 *   2. Query image/ink annotations that need rendering
 *   3. Download PDF (via AttachmentService cache)
 *   4. Render annotation images (via PDFProcessWorker)
 *   5. Save images to vault
 */
export class BatchExtractImagesTask extends BaseTask {
    constructor(
        private attachmentService: AttachmentService,
        private pdfProcessor: PDFProcessWorker,
        private settings: ZotFlowSettings,
        private input: BatchExtractImagesInput,
    ) {
        super("batch-extract-images");
    }

    protected async run(signal: AbortSignal): Promise<void> {
        const items = await this.resolveItems();

        if (items.length === 0) {
            this.reportProgress(0, 0, "No items to process");
            return;
        }

        const total = items.length;
        let successCount = 0;
        let failCount = 0;
        const forceUpdate = this.input.forceUpdate ?? false;

        for (let i = 0; i < items.length; i++) {
            if (signal.aborted) throw new Error("Aborted");

            const item = items[i]!;
            const label = item.title || item.key;
            this.reportProgress(
                i,
                total,
                `Extracting ${i + 1}/${total}: ${label}`,
            );

            try {
                await this.extractForItem(item, forceUpdate);
                successCount++;
            } catch (e) {
                failCount++;
                // Non-fatal: log and continue
                this.log(
                    "error",
                    `Failed to extract images for item ${item.key}: ${
                        e instanceof Error ? e.message : String(e)
                    }`,
                    "BatchExtractImagesTask",
                    { itemKey: item.key, libraryID: item.libraryID },
                );
            }
        }

        this.result = { successCount, failCount };

        if (failCount > 0) {
            this.reportProgress(
                total,
                total,
                `Finished: ${successCount} success, ${failCount} failed`,
            );
        } else {
            this.reportProgress(total, total, "All images extracted");
        }
    }

    /**
     * Extract annotation images for a single parent item.
     * Mirrors `NoteService.extractAnnotationImages` but operates independently.
     */
    private async extractForItem(item: AnyIDBZoteroItem, forceUpdate: boolean) {
        // Resolve PDF attachments
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
            const annotations = await getAnnotationJson(
                attachment,
                this.settings.zoteroApiKey,
                (a: IDBZoteroItem<AnnotationData>) => {
                    const isImage =
                        a.raw.data.annotationType === "image" ||
                        a.raw.data.annotationType === "ink";
                    const needsUpdate =
                        !a.annotationImageVersion ||
                        a.version > a.annotationImageVersion ||
                        forceUpdate;
                    return isImage && needsUpdate;
                },
            );

            if (annotations.length === 0) continue;

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
    }

    /**
     * Resolve items from database based on input descriptor.
     */
    private async resolveItems(): Promise<AnyIDBZoteroItem[]> {
        // If specific keys are provided, fetch those directly
        if (this.input.itemKeys && this.input.itemKeys.length > 0) {
            const libraryIDs = this.input.libraryIDs;
            if (!libraryIDs || libraryIDs.length === 0) {
                throw new ZotFlowError(
                    ZotFlowErrorCode.CONFIG_MISSING,
                    "BatchExtractImagesTask",
                    "libraryIDs required when itemKeys specified",
                );
            }

            const items: AnyIDBZoteroItem[] = [];
            for (const key of this.input.itemKeys) {
                for (const libID of libraryIDs) {
                    const item = await db.items.get([libID, key]);
                    if (item) {
                        items.push(item);
                        break;
                    }
                }
            }
            return items;
        }

        // Otherwise, fetch all top-level items from specified libraries
        const libraryIDs =
            this.input.libraryIDs && this.input.libraryIDs.length > 0
                ? this.input.libraryIDs
                : (await db.libraries.toArray()).map((l) => l.id);

        const results: AnyIDBZoteroItem[] = [];
        for (const libID of libraryIDs) {
            const allTopLevel = await db.items
                .where("[libraryID+parentItem+itemType+trashed]")
                .between([libID, "", "", 0], [libID, "", "\uffff", 0])
                .toArray();

            // Only include items that could have PDF attachments
            const filtered = allTopLevel.filter(
                (item) =>
                    item.itemType !== "attachment" &&
                    item.itemType !== "annotation" &&
                    item.itemType !== "note",
            );
            results.push(...filtered);
        }

        return results;
    }
}
