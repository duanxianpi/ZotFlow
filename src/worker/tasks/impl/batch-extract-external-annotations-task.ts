import { BaseTask } from "../base";
import { db, getCombinations } from "db/db";
import { annotationItemFromJSON } from "db/annotation";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";

import type { AttachmentService } from "worker/services/attachment";
import type { PDFProcessWorker } from "worker/services/pdf-processor";
import type { IDBZoteroItem } from "types/db-schema";
import type { AttachmentData, AnnotationData } from "types/zotero-item";
import type { AnnotationJSON } from "types/zotero-reader";

/**
 * Input descriptor for batch external annotation extraction.
 */
export interface BatchExtractExternalAnnotationsInput {
    /** Attachment items to extract from. */
    attachmentItems: IDBZoteroItem<AttachmentData>[];
}

/**
 * Result of the extraction, available after the task completes.
 */
interface ExtractionResult {
    /** External annotations converted to AnnotationJSON (for reader bridge). */
    annotations: AnnotationJSON[];
}

/**
 * BatchExtractExternalAnnotationsTask — extracts external (embedded PDF)
 * annotations via `PDFProcessWorker.import()`.
 *
 * For each attachment item:
 *   1. Skip non-PDF items
 *   2. Check MD5 to skip items already extracted
 *   3. Delete old external annotations from IDB
 *   4. Download the PDF blob
 *   5. Call `pdfProcessWorker.import()` to extract annotations
 *   6. Store extracted annotations in IDB (syncStatus = "ignore")
 *   7. Update the extraction MD5 on the attachment record
 *
 * The resulting `AnnotationJSON[]` are cached and can be retrieved via
 * `getExtractedAnnotations()` after the task completes.
 */
export class BatchExtractExternalAnnotationsTask extends BaseTask {
    private extractedAnnotations: AnnotationJSON[] = [];

    constructor(
        private attachmentService: AttachmentService,
        private pdfProcessor: PDFProcessWorker,
        private input: BatchExtractExternalAnnotationsInput,
    ) {
        super("batch-extract-external-annotations");
    }

    protected async run(signal: AbortSignal): Promise<void> {
        const items = this.input.attachmentItems.filter(
            (a) => a.raw.data.contentType === "application/pdf",
        );

        if (items.length === 0) {
            this.reportProgress(0, 0, "No PDF attachments to process");
            return;
        }

        const total = items.length;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < items.length; i++) {
            if (signal.aborted) throw new Error("Aborted");

            const item = items[i]!;
            const label = item.raw.data.filename || item.key;
            this.reportProgress(
                i,
                total,
                `Extracting ${i + 1}/${total}: ${label}`,
            );

            try {
                const annotations = await this.extractForAttachment(item);
                this.extractedAnnotations.push(...annotations);
                successCount++;
            } catch (e) {
                failCount++;
                this.log(
                    "error",
                    `Failed to extract external annotations for ${item.key}: ${
                        e instanceof Error ? e.message : String(e)
                    }`,
                    "BatchExtractExternalAnnotationsTask",
                );
            }
        }

        this.result = { successCount, failCount };
        this.reportProgress(
            total,
            total,
            failCount > 0
                ? `Done: ${successCount} success, ${failCount} failed`
                : `Extracted ${this.extractedAnnotations.length} annotations`,
        );
    }

    /**
     * Extract external annotations from a single PDF attachment.
     * Returns AnnotationJSON[] for use by the reader bridge.
     */
    private async extractForAttachment(
        attachment: IDBZoteroItem<AttachmentData>,
    ): Promise<AnnotationJSON[]> {
        const currentMD5 = attachment.raw.data.md5;
        const lastExtractionMD5 =
            attachment.externalAnnotationExtractionFileMD5;

        // Skip if MD5 matches (already extracted)
        if (currentMD5 && currentMD5 === lastExtractionMD5) {
            this.log(
                "debug",
                `Skipping ${attachment.key} — MD5 match`,
                "BatchExtractExternalAnnotationsTask",
            );
            return [];
        }

        // Delete existing external annotations for this attachment
        const existingExternal = await db.items
            .where({
                libraryID: attachment.libraryID,
                parentItem: attachment.key,
            })
            .filter(
                (i) =>
                    (i as IDBZoteroItem<AnnotationData>).raw.data
                        .annotationIsExternal === true,
            )
            .primaryKeys();

        if (existingExternal.length > 0) {
            await db.items.bulkDelete(existingExternal);
        }

        // Download the PDF
        const fileBlob = await this.attachmentService.getFileBlob(attachment);
        if (!fileBlob) {
            throw new ZotFlowError(
                ZotFlowErrorCode.RESOURCE_MISSING,
                "BatchExtractExternalAnnotationsTask",
                `File blob not available for ${attachment.key}`,
            );
        }

        const buffer = await fileBlob.arrayBuffer();

        // Extract via PDF worker
        const rawAnnotations = await this.pdfProcessor.import(buffer, true);

        // Build IDB items + AnnotationJSON in one pass
        const annotationJsonResults: AnnotationJSON[] = [];
        const library = attachment.raw.library;
        const now = new Date().toISOString().split(".")[0] + "Z";

        const idbItems: IDBZoteroItem<AnnotationData>[] = rawAnnotations.map(
            (raw: any) => {
                const key =
                    raw.key || raw.id || crypto.randomUUID().slice(0, 8);

                // Build AnnotationJSON for the reader
                annotationJsonResults.push({
                    id: key,
                    type: raw.annotationType,
                    isExternal: true,
                    authorName: raw.annotationAuthorName,
                    readOnly: true,
                    text: raw.annotationText,
                    comment: raw.annotationComment,
                    pageLabel: raw.annotationPageLabel,
                    color: raw.annotationColor,
                    sortIndex: raw.annotationSortIndex,
                    position: JSON.parse(raw.annotationPosition),
                    tags: raw.tags || [],
                    dateModified: "",
                    dateCreated: "",
                });

                return {
                    libraryID: attachment.libraryID,
                    key,
                    itemType: "annotation",
                    parentItem: attachment.key,
                    title: "",
                    collections: [],
                    dateAdded: now,
                    dateModified: now,
                    version: 0,
                    trashed: 0,
                    searchCreators: [],
                    searchTags: [],
                    syncStatus: "ignore",
                    syncedAt: now,
                    syncError: "",
                    raw: {
                        key,
                        version: 0,
                        library,
                        links: {},
                        meta: { numChildren: 0 },
                        data: {
                            ...raw,
                            key,
                            itemType: "annotation",
                            parentItem: attachment.key,
                            annotationIsExternal: true,
                            relations: {},
                            dateAdded: now,
                            dateModified: now,
                            tags: raw.tags || [],
                            deleted: false,
                            version: 0,
                        } as unknown as AnnotationData,
                    },
                } as IDBZoteroItem<AnnotationData>;
            },
        );

        // Store annotations in IDB
        if (idbItems.length > 0) {
            await db.transaction("rw", db.items, async () => {
                await db.items.bulkPut(idbItems);
            });
        }

        // Update extraction MD5 on the attachment
        if (currentMD5) {
            await db.items.update([attachment.libraryID, attachment.key], {
                externalAnnotationExtractionFileMD5: currentMD5,
            });
        }

        this.log(
            "debug",
            `Extracted ${annotationJsonResults.length} external annotations for ${attachment.key}`,
            "BatchExtractExternalAnnotationsTask",
        );

        return annotationJsonResults;
    }

    /**
     * Retrieve extracted annotations after task completes.
     * Used by the main thread to push annotations to the reader bridge.
     */
    public getExtractedAnnotations(): AnnotationJSON[] {
        return this.extractedAnnotations;
    }
}
