import { ItemView, WorkspaceLeaf } from "obsidian";
import { workerBridge } from "bridge";
import { IframeReaderBridge } from "./bridge";
import { db, getCombinations } from "db/db";
import { annotationItemFromJSON, getAnnotationJson } from "db/annotation";
import { toZoteroDate } from "db/normalize";
import { services } from "services/services";

import type { ViewStateResult } from "obsidian";
import type { AttachmentData, AnnotationData } from "types/zotero-item";
import type { IDBZoteroItem, IDBZoteroKey } from "types/db-schema";
import type {
    CreateReaderOptions,
    AnnotationJSON,
    ColorScheme,
} from "types/zotero-reader";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";

export const ZOTERO_READER_VIEW_TYPE = "zotflow-zotero-reader-view";

interface ReaderViewState extends Record<string, unknown> {
    libraryID: number;
    itemKey: string;
    readerOptions: Partial<CreateReaderOptions>;
}

export class ZoteroReaderView extends ItemView {
    private attachmentItem: IDBZoteroItem<AttachmentData>;
    private readerOptions: Partial<CreateReaderOptions>;
    private keyInfo: IDBZoteroKey;

    private bridge?: IframeReaderBridge;
    private colorSchemeObserver?: MutationObserver;
    private colorScheme: ColorScheme = "light"; // Default to light

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return ZOTERO_READER_VIEW_TYPE;
    }

    getDisplayText() {
        return this.attachmentItem?.raw.data.filename || "Zotero Reader";
    }

    getIcon() {
        return "book-open";
    }

    async setState(
        state: ReaderViewState,
        result: ViewStateResult,
    ): Promise<void> {
        const _keyInfo = await db.keys.get(services.settings.zoteroApiKey);

        if (!_keyInfo) {
            console.error(
                `[ZotFlow] Key ${services.settings.zoteroApiKey} doesn't exist`,
            );
            throw new Error(
                `Key ${services.settings.zoteroApiKey} doesn't exist`,
            );
        }

        if (state.itemKey) {
            const _item = await db.items.get([state.libraryID, state.itemKey]);
            if (!_item || _item.itemType !== "attachment") {
                console.error(
                    `[ZotFlow] Item ${state.itemKey} doesn't exist or is not an attachment`,
                );
                throw new Error(
                    `Item ${state.itemKey} doesn't exist or is not an attachment`,
                );
            }
            this.attachmentItem = _item as IDBZoteroItem<AttachmentData>;

            this.keyInfo = _keyInfo;
            this.containerEl
                .getElementsByClassName("view-header-title")[0]
                ?.setText(this.attachmentItem.raw.data.filename);
            this.loadDocument();
        }

        this.readerOptions = state.readerOptions;
        super.setState(state, result);
    }

    private async loadDocument() {
        const container = this.contentEl;
        container.empty();

        const loadingEl = container.createDiv({ cls: "zotflow-loading" });
        loadingEl.setText(`Downloading/Loading ${this.attachmentItem.key}...`);

        // Try force update the source note
        workerBridge.note
            .triggerUpdate(
                this.attachmentItem.libraryID,
                this.attachmentItem.parentItem !== ""
                    ? this.attachmentItem.parentItem
                    : this.attachmentItem.key,
            )
            .catch((e) => {
                services.logService.error(
                    "Failed to trigger source note update",
                    "ZoteroReaderView",
                    e,
                );

                services.notificationService.notify(
                    "warning",
                    "Failed to auto-update source note",
                );
            });

        this.renderReader();
    }

    private async renderReader() {
        const container = this.contentEl;

        // Ensure color scheme is set initially
        this.colorScheme = getComputedStyle(document.body)
            .colorScheme as ColorScheme;

        try {
            // Create bridge once
            if (!this.bridge) {
                this.bridge = new IframeReaderBridge(
                    container,
                    false,
                    this.attachmentItem,
                );

                // Register event listeners
                this.bridge.onEventType("error", (evt) => {
                    console.error(`${evt.code}: ${evt.message}`);
                });

                this.bridge.onEventType("sidebarToggled", (evt) => {
                    console.log("Sidebar toggled:", evt.open);
                });

                this.bridge.onEventType("sidebarWidthChanged", (evt) => {
                    console.log("Sidebar width changed:", evt.width);
                });

                this.bridge.onEventType("openLink", (evt) => {
                    console.log("Opening link:", evt.url);
                });

                this.bridge.onEventType("annotationsSaved", (evt) => {
                    this.handleAnnotationsSaved(evt.annotations);
                });

                this.bridge.onEventType("annotationsDeleted", (evt) => {
                    this.handleAnnotationsDeleted(evt.ids);
                });

                this.bridge.onEventType("viewStateChanged", (evt) => {
                    console.log("View state changed:", evt.primary, evt.state);
                });

                this.bridge.onEventType("saveCustomThemes", (evt) => {
                    console.log("Custom themes saved:", evt.customThemes);
                });

                this.bridge.onEventType("setLightTheme", (evt) => {
                    console.log("Set light theme:", evt.theme);
                });

                this.bridge.onEventType("setDarkTheme", (evt) => {
                    console.log("Set dark theme:", evt.theme);
                });

                // Observe color scheme changes once and delegate to bridge
                this.colorSchemeObserver = new MutationObserver(() => {
                    const newColorScheme = getComputedStyle(document.body)
                        .colorScheme as ColorScheme;
                    if (newColorScheme && newColorScheme !== this.colorScheme) {
                        this.bridge!.setColorScheme(newColorScheme);
                        this.colorScheme = newColorScheme;
                    }
                });
                this.colorSchemeObserver.observe(document.body, {
                    attributes: true,
                    attributeFilter: ["class"],
                });
            }

            // Connect Bridge & Get File concurrently
            const [_, fileBlob] = await Promise.all([
                this.bridge.connect(),
                workerBridge
                    .downloadAttachment(this.attachmentItem)
                    .catch((e) => {
                        services.logService.error(
                            "Failed to download attachment",
                            "ZoteroReaderView",
                            e,
                        );
                        services.notificationService.notify(
                            "error",
                            "Failed to download attachment",
                        );
                        return null;
                    }),
            ]);

            if (!fileBlob) {
                throw new ZotFlowError(
                    ZotFlowErrorCode.RESOURCE_MISSING,
                    "File not found or failed to download",
                    "ZoteroReaderView",
                    {
                        attachmentItem: this.attachmentItem,
                    },
                );
            }

            // Get Annotations
            const annotationJson = await getAnnotationJson(
                this.attachmentItem,
                services.settings.zoteroApiKey,
                (item) => item.syncStatus !== "deleted",
            );
            // Initialize Reader if ready
            if (this.bridge.state === "bridge-ready") {
                const opts = {
                    ...this.readerOptions,
                    colorScheme: this.colorScheme,
                    annotations: annotationJson,
                };

                const contentType = this.attachmentItem.raw.data.contentType;
                let type: "pdf" | "epub" | "snapshot" | "paperclip";
                switch (contentType) {
                    case "application/pdf":
                        type = "pdf";
                        break;
                    case "application/epub+zip":
                        type = "epub";
                        break;
                    case "text/html":
                        type = "snapshot";
                        break;
                    default:
                        services.logService.error(
                            `Unknown content type: ${contentType}`,
                            "ZoteroReaderView",
                        );
                        throw new ZotFlowError(
                            ZotFlowErrorCode.UNKNOWN,
                            `Unknown content type: ${contentType}`,
                            "ZoteroReaderView",
                            {
                                attachmentItem: this.attachmentItem,
                            },
                        );
                }

                const authorName =
                    this.attachmentItem.raw.library.type === "group"
                        ? this.keyInfo.username || ""
                        : "";

                // Initialize Reader Logic
                this.bridge.initReader({
                    data: {
                        buf: new Uint8Array(await fileBlob.arrayBuffer()),
                        url: null,
                    },
                    type: type,
                    authorName,
                    ...opts,
                });

                // Extract external annotations
                this.extractExternalAnnotation();
            }
        } catch (e: any) {
            services.logService.error(
                "Error loading Zotero Reader view",
                "ZoteroReaderView",
                e,
            );
            container.empty();
            const errorMessage = container.createDiv({
                cls: "error-message",
            });
            errorMessage
                .createEl("div")
                .setText("Failed to load Zotero Reader");
            errorMessage.createEl("div").setText("Error details: " + e.message);
        }
    }

    readerNavigate(navigationInfo: any) {
        if (!this.bridge) return;

        this.bridge.navigate(navigationInfo);
    }

    getState(): ReaderViewState {
        return {
            libraryID: this.attachmentItem.libraryID,
            itemKey: this.attachmentItem.key,
            readerOptions: this.readerOptions,
        };
    }

    async onClose() {
        if (this.colorSchemeObserver) {
            this.colorSchemeObserver.disconnect();
        }
        if (this.bridge) {
            await this.bridge.dispose();
        }
    }

    private async extractExternalAnnotation() {
        const isPDF =
            this.attachmentItem.raw.data.contentType === "application/pdf";
        if (!isPDF) return;

        const currentMD5 = this.attachmentItem.raw.data.md5;
        const lastExtractionMD5 =
            this.attachmentItem.externalAnnotationExtractionFileMD5;

        if (currentMD5 && currentMD5 === lastExtractionMD5) {
            services.logService.log(
                "debug",
                "Skipping annotation extraction (MD5 match)",
                "ZoteroReaderView",
            );
            return;
        }

        try {
            const annotations = await workerBridge.extractExternalAnnotations([
                this.attachmentItem,
            ]);

            // Push extracted annotations to the reader iframe
            for (const annotation of annotations) {
                this.bridge!.addAnnotation(annotation);
            }

            // Update local cache of the MD5
            if (currentMD5) {
                this.attachmentItem.externalAnnotationExtractionFileMD5 =
                    currentMD5;
            }

            services.logService.log(
                "debug",
                `External annotations extracted: ${annotations.length}`,
                "ZoteroReaderView",
            );
        } catch (e) {
            services.logService.error(
                "Failed to extract external annotations",
                "ZoteroReaderView",
                e,
            );
            services.notificationService.notify(
                "error",
                "Failed to extract external annotations",
            );
        }
    }

    /**
     * Compare annotation data to check if it has changed
     */
    private annotationDataDiff(
        existing: AnnotationData,
        annotationData: Partial<AnnotationData>,
    ) {
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

    /**
     * Handle saved/updated annotations
     */
    private async handleAnnotationsSaved(annotations: any[]) {
        const { libraryID, parentItem: paperKey } = this.attachmentItem;
        const library = this.attachmentItem.raw.library;
        const attachmentKey = this.attachmentItem.key;

        let hasChanges = false;

        const itemsToPut: IDBZoteroItem<AnnotationData>[] = [];

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
            const annotationData = annotationItemFromJSON(json);
            const key = json.id;
            const existing = existingMap.get(key);
            const isVisual =
                annotationData.annotationType === "image" ||
                annotationData.annotationType === "ink";
            if (isVisual && json.image) {
                workerBridge.note
                    .saveBase64Image(json.image, key)
                    .catch((e) => {
                        services.logService.error(
                            `Failed to save annotation image for ${key}`,
                            "ZoteroReaderView",
                            e,
                        );
                        services.notificationService.notify(
                            "error",
                            `Failed to save annotation image for ${key}`,
                        );
                    });
            }

            if (existing) {
                // === Update logic (UPDATE) ===
                if (!json.isExternal) {
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
                // === Create logic (CREATE) ===
                hasChanges = true;

                const newItem: IDBZoteroItem<AnnotationData> = {
                    libraryID,
                    key,
                    itemType: "annotation",
                    parentItem: attachmentKey, // Annotation parent item is PDF
                    title: "",
                    collections: [],
                    dateAdded: now,
                    dateModified: now,
                    version: 0,
                    trashed: 0,
                    searchCreators: [],
                    searchTags: [],
                    syncStatus: !json.isExternal ? "created" : "ignore",
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

                if (library.type === "group" && this.keyInfo) {
                    newItem.raw.meta.createdByUser = {
                        id: this.keyInfo.userID,
                        name: this.keyInfo.displayName,
                        username: this.keyInfo.username,
                        links: {},
                    };
                }

                itemsToPut.push(newItem);
            }
        }

        // Execute batch transaction
        if (itemsToPut.length > 0) {
            await db.transaction("rw", db.items, async () => {
                await db.items.bulkPut(itemsToPut);
            });
        }

        // Debounce Update Source Note
        if (hasChanges) {
            services.logService.log(
                "debug",
                `Triggering update for note: ${paperKey}`,
                "ZoteroReaderView",
            );
            workerBridge.note
                .triggerUpdate(
                    libraryID,
                    paperKey !== "" ? paperKey : attachmentKey,
                    {
                        forceUpdateContent: true,
                        forceUpdateImages: false,
                    },
                    true,
                )
                .catch((e) => {
                    services.logService.error(
                        "Failed to trigger note update after annotation save",
                        "ZoteroReaderView",
                        e,
                    );
                    services.notificationService.notify(
                        "error",
                        "Failed to trigger note update after annotation save",
                    );
                });
        }
    }

    /**
     * Handle deleted annotations
     * Optimization: Batch processing
     */
    private async handleAnnotationsDeleted(ids: string[]) {
        services.logService.log(
            "debug",
            `Handling deleted annotations: ${ids.join(", ")}`,
            "ZoteroReaderView",
        );
        const { libraryID } = this.attachmentItem;
        const paperKey = this.attachmentItem.parentItem;

        if (!ids.length) return;

        const itemsToDeletePhysical: [number, string][] = [];
        const itemsToDeleteSoft: IDBZoteroItem<AnnotationData>[] = [];
        const now = new Date().toISOString().split(".")[0] + "Z";

        // Read affected items to determine types
        const items = (await db.items
            .where(["libraryID", "key"])
            .anyOf(getCombinations([[libraryID], ids]))
            .toArray()) as IDBZoteroItem<AnnotationData>[];

        services.logService.log(
            "debug",
            `Found ${items.length} annotations to delete`,
            "ZoteroReaderView",
        );

        // Iterate and handle delete logic
        for (const existing of items) {
            const isVisual =
                existing.raw.data.annotationType === "image" ||
                existing.raw.data.annotationType === "ink";

            // Only delete physical images if it's a visual annotation
            if (isVisual) {
                workerBridge.note
                    .deleteAnnotationImage(existing.key)
                    .catch((e) => {
                        services.logService.error(
                            `Failed to delete annotation image for ${existing.key}`,
                            "ZoteroReaderView",
                            e,
                        );
                        services.notificationService.notify(
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

        // Execute batch transaction
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

        // Trigger note update
        workerBridge.note
            .triggerUpdate(
                libraryID,
                paperKey !== "" ? paperKey : this.attachmentItem.key,
                { forceUpdateContent: true },
                true,
            )
            .catch((e) => {
                services.logService.error(
                    "Failed to trigger note update after annotation delete",
                    "ZoteroReaderView",
                    e,
                );
                services.notificationService.notify(
                    "error",
                    "Failed to trigger note update after annotation delete",
                );
            });
    }
}
