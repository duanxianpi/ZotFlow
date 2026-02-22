import { db, getCombinations } from "db/db";
import { annotationItemFromJSON, getAnnotationJson } from "db/annotation";
import { toZoteroDate } from "db/normalize";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";

import type { IParentProxy } from "bridge/types";
import type { NoteService, UpdateOptions } from "./note";
import type { IDBZoteroItem, IDBZoteroKey } from "types/db-schema";
import type {
    AnnotationData,
    AttachmentData,
    ZoteroItemDataTypeMap,
} from "types/zotero-item";
import type { AnnotationJSON } from "types/zotero-reader";

/** Result returned by saveAnnotations so the caller knows whether a note update is needed. */
export interface SaveAnnotationsResult {
    hasChanges: boolean;
}

/**
 * Worker-side service for reader annotation CRUD.
 * Replaces all direct `db` access that was previously in the main-thread
 * `ZoteroReaderView` and `IframeReaderBridge`.
 */
export class AnnotationService {
    constructor(
        private noteService: NoteService,
        private parentHost: IParentProxy,
    ) {}

    // ------------------------------------------------------------------
    //  Queries (read-only)
    // ------------------------------------------------------------------

    /** Resolve the API key record from IDB. */
    async getKeyInfo(apiKey: string): Promise<IDBZoteroKey | undefined> {
        return db.keys.get(apiKey);
    }

    /**
     * Build the annotation JSON array the reader iframe expects.
     * Wraps `getAnnotationJson` from `db/annotation.ts` so the main thread
     * never needs to import Dexie.
     */
    async getAnnotations(
        attachmentItem: IDBZoteroItem<AttachmentData>,
        apiKey: string,
    ): Promise<AnnotationJSON[]> {
        return getAnnotationJson(
            attachmentItem,
            apiKey,
            (item) => item.syncStatus !== "deleted",
        );
    }

    // ------------------------------------------------------------------
    //  Mutations
    // ------------------------------------------------------------------

    /**
     * Process annotations saved/updated from the reader iframe.
     * Handles create-vs-update logic, image persistence, and triggers
     * source-note updates via `NoteService`.
     *
     * This method replaces `ZoteroReaderView.handleAnnotationsSaved`.
     */
    async saveAnnotations(
        attachmentItem: IDBZoteroItem<AttachmentData>,
        keyInfo: IDBZoteroKey,
        annotations: AnnotationJSON[],
    ): Promise<SaveAnnotationsResult> {
        const { libraryID, parentItem: paperKey } = attachmentItem;
        const library = attachmentItem.raw.library;
        const attachmentKey = attachmentItem.key;

        let hasChanges = false;
        const itemsToPut: IDBZoteroItem<AnnotationData>[] = [];

        // Fetch existing non-deleted, non-ignored annotations
        const existingItems = (
            await db.items
                .where({
                    libraryID,
                    parentItem: attachmentKey,
                    itemType: "annotation",
                })
                .toArray()
        ).filter(
            (i) => i.syncStatus !== "deleted" && i.syncStatus !== "ignore",
        ) as IDBZoteroItem<AnnotationData>[];

        const existingMap = new Map(existingItems.map((i) => [i.key, i]));

        const now = new Date().toISOString().split(".")[0] + "Z";
        const zoteroDate = toZoteroDate(new Date().toISOString());

        for (const json of annotations) {
            const annotationData = annotationItemFromJSON(
                json,
            ) as Partial<AnnotationData>;
            const key = json.id;
            const existing = existingMap.get(key);
            const isVisual =
                annotationData.annotationType === "image" ||
                annotationData.annotationType === "ink";

            // Persist annotation image (fire & forget)
            if (isVisual && (json as any).image) {
                this.noteService
                    .saveBase64Image((json as any).image as string, key)
                    .catch((e) => {
                        this.parentHost.log(
                            "error",
                            `Failed to save annotation image for ${key}`,
                            "AnnotationService",
                            e,
                        );
                        this.parentHost.notify(
                            "error",
                            `Failed to save annotation image for ${key}`,
                        );
                    });
            }

            if (existing) {
                // === Update ===
                if (!(json as any).isExternal) {
                    if (
                        this.annotationDataDiff(
                            existing.raw.data,
                            annotationData,
                        )
                    ) {
                        hasChanges = true;
                        const newSyncStatus =
                            existing.syncStatus === "created"
                                ? "created"
                                : "updated";

                        itemsToPut.push({
                            ...existing,
                            syncStatus: newSyncStatus,
                            dateModified: now,
                            raw: {
                                ...existing.raw,
                                data: {
                                    ...existing.raw.data,
                                    ...annotationData,
                                    dateModified: zoteroDate,
                                } as any,
                            },
                        });
                    }
                }
            } else {
                // === Create ===
                hasChanges = true;
                const newItem: IDBZoteroItem<AnnotationData> = {
                    libraryID,
                    key,
                    itemType: "annotation",
                    parentItem: attachmentKey,
                    title: "",
                    collections: [],
                    dateAdded: now,
                    dateModified: now,
                    version: 0,
                    trashed: 0,
                    searchCreators: [],
                    searchTags: [],
                    syncStatus: !(json as any).isExternal
                        ? "created"
                        : "ignore",
                    syncedAt: now,
                    syncError: "",
                    annotationImageVersion: 1,
                    raw: {
                        key,
                        version: 0,
                        library,
                        links: {},
                        meta: { numChildren: 0 },
                        data: {
                            ...annotationData,
                            key,
                            itemType: "annotation",
                            parentItem: attachmentKey,
                            relations: {},
                            dateAdded: zoteroDate,
                            dateModified: zoteroDate,
                            tags: annotationData.tags || [],
                            deleted: false,
                            version: 0,
                        } as unknown as AnnotationData,
                    },
                };

                if (library.type === "group" && keyInfo) {
                    newItem.raw.meta.createdByUser = {
                        id: keyInfo.userID,
                        name: keyInfo.displayName,
                        username: keyInfo.username,
                        links: {},
                    };
                }

                itemsToPut.push(newItem);
            }
        }

        // Batch write
        if (itemsToPut.length > 0) {
            await db.transaction("rw", db.items, async () => {
                await db.items.bulkPut(itemsToPut);
            });
        }

        // Trigger source-note update (debounced, fire & forget)
        if (hasChanges) {
            this.parentHost.log(
                "debug",
                `Triggering update for note: ${paperKey}`,
                "AnnotationService",
            );
            this.noteService
                .triggerUpdate(
                    libraryID,
                    paperKey !== "" ? paperKey : attachmentKey,
                    { forceUpdateContent: true, forceUpdateImages: false },
                    true,
                )
                .catch((e) => {
                    this.parentHost.log(
                        "error",
                        "Failed to trigger note update after annotation save",
                        "AnnotationService",
                        e,
                    );
                    this.parentHost.notify(
                        "error",
                        "Failed to trigger note update after annotation save",
                    );
                });
        }

        return { hasChanges };
    }

    /**
     * Delete annotations from IDB (soft-delete for synced, hard-delete for
     * locally-created ones). Triggers source-note update afterwards.
     *
     * This method replaces `ZoteroReaderView.handleAnnotationsDeleted`.
     */
    async deleteAnnotations(
        attachmentItem: IDBZoteroItem<AttachmentData>,
        ids: string[],
    ): Promise<void> {
        const { libraryID } = attachmentItem;
        const paperKey = attachmentItem.parentItem;

        if (!ids.length) return;

        this.parentHost.log(
            "debug",
            `Handling deleted annotations: ${ids.join(", ")}`,
            "AnnotationService",
        );

        const itemsToDeletePhysical: [number, string][] = [];
        const itemsToDeleteSoft: IDBZoteroItem<AnnotationData>[] = [];
        const now = new Date().toISOString().split(".")[0] + "Z";

        const items = (await db.items
            .where(["libraryID", "key"])
            .anyOf(getCombinations([[libraryID], ids]))
            .toArray()) as IDBZoteroItem<AnnotationData>[];

        this.parentHost.log(
            "debug",
            `Found ${items.length} annotations to delete`,
            "AnnotationService",
        );

        for (const existing of items) {
            const isVisual =
                existing.raw.data.annotationType === "image" ||
                existing.raw.data.annotationType === "ink";

            if (isVisual) {
                this.noteService
                    .deleteAnnotationImage(existing.key)
                    .catch((e) => {
                        this.parentHost.log(
                            "error",
                            `Failed to delete annotation image for ${existing.key}`,
                            "AnnotationService",
                            e,
                        );
                        this.parentHost.notify(
                            "error",
                            `Failed to delete annotation image for ${existing.key}`,
                        );
                    });
            }

            if (existing.syncStatus === "created") {
                itemsToDeletePhysical.push([libraryID, existing.key]);
            } else {
                itemsToDeleteSoft.push({
                    ...existing,
                    syncStatus: "deleted",
                    dateModified: now,
                    raw: {
                        ...existing.raw,
                        data: {
                            ...existing.raw.data,
                            deleted: true,
                        } as any,
                    },
                });
            }
        }

        // Batch write
        if (itemsToDeletePhysical.length > 0 || itemsToDeleteSoft.length > 0) {
            await db.transaction("rw", db.items, async () => {
                if (itemsToDeletePhysical.length > 0) {
                    await db.items.bulkDelete(itemsToDeletePhysical);
                }
                if (itemsToDeleteSoft.length > 0) {
                    await db.items.bulkPut(itemsToDeleteSoft);
                }
            });
        }

        // Trigger source-note update
        this.noteService
            .triggerUpdate(
                libraryID,
                paperKey !== "" ? paperKey : attachmentItem.key,
                { forceUpdateContent: true },
                true,
            )
            .catch((e) => {
                this.parentHost.log(
                    "error",
                    "Failed to trigger note update after annotation delete",
                    "AnnotationService",
                    e,
                );
                this.parentHost.notify(
                    "error",
                    "Failed to trigger note update after annotation delete",
                );
            });
    }

    // ------------------------------------------------------------------
    //  Private helpers
    // ------------------------------------------------------------------

    private annotationDataDiff(
        existing: AnnotationData,
        annotationData: Partial<AnnotationData>,
    ): boolean {
        return (
            existing.annotationComment !== annotationData.annotationComment ||
            existing.annotationColor !== annotationData.annotationColor ||
            existing.annotationPageLabel !==
                annotationData.annotationPageLabel ||
            existing.annotationPosition !== annotationData.annotationPosition ||
            existing.annotationSortIndex !==
                annotationData.annotationSortIndex ||
            existing.annotationText !== annotationData.annotationText ||
            existing.annotationType !== annotationData.annotationType
        );
    }
}
