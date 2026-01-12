import { ItemView, WorkspaceLeaf, Notice, ViewStateResult } from "obsidian";
import { workerBridge } from "bridge";
import { IframeReaderBridge } from "./bridge";
import { AnnotationJSON, ColorScheme } from "types/zotero-reader";
import { CreateReaderOptions } from "types/zotero-reader";
import { db } from "db/db";
import { IDBZoteroItem, IDBZoteroKey } from "types/db-schema";
import { AttachmentData, AnnotationData } from "types/zotero-item";
import { ZotFlowSettings } from "settings/types";
import { annotationItemFromJSON } from "utils/annotation";

export const VIEW_TYPE_ZOTERO_READER = "zotflow-zotero-reader-view";

interface ReaderViewState extends Record<string, unknown> {
    libraryID: number;
    itemKey: string;
    readerOptions: Partial<CreateReaderOptions>;
}

export class ZoteroReaderView extends ItemView {
    private settings: ZotFlowSettings;
    private attachmentItem: IDBZoteroItem<AttachmentData>;
    private readerOptions: Partial<CreateReaderOptions>;
    private keyInfo: IDBZoteroKey;

    private bridge?: IframeReaderBridge;
    private colorSchemeObserver?: MutationObserver;
    private colorScheme: ColorScheme = "light"; // Default to light

    constructor(leaf: WorkspaceLeaf, settings: ZotFlowSettings) {
        super(leaf);
        this.settings = settings;
    }

    getViewType() {
        return VIEW_TYPE_ZOTERO_READER;
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
        const _keyInfo = await db.keys.get(this.settings.zoteroApiKey);

        if (!_keyInfo) {
            console.error(
                `[ZotFlow] Key ${this.settings.zoteroApiKey} doesn't exist`,
            );
            throw new Error(`Key ${this.settings.zoteroApiKey} doesn't exist`);
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

        try {
            this.renderReader();
        } catch (e) {
            console.error(e);
            new Notice("Error loading document");
        }
    }

    private async renderReader() {
        const container = this.contentEl;

        // Ensure color scheme is set initially
        this.colorScheme = getComputedStyle(document.body)
            .colorScheme as ColorScheme;

        try {
            // Create bridge once
            if (!this.bridge) {
                this.bridge = new IframeReaderBridge(container, this.settings);

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
                    console.log("Annotations deleted:", evt.ids);
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
                workerBridge.attachment.getFileBlob(this.attachmentItem),
            ]);

            if (!fileBlob) {
                console.error(
                    `[ZotFlow] Failed to get file blob for ${this.attachmentItem.key}`,
                );
                throw new Error("File not found or failed to download");
            }

            // Get Annotations
            const annotationJson = await this.getAnnotationJson(
                this.attachmentItem,
            );

            // Initialize Reader if ready
            if (this.bridge.state === "ready") {
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
                        console.error(`Unknown content type: ${contentType}`);
                        throw new Error(`Unknown content type: ${contentType}`);
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
                this.extractExternalAnnotation(fileBlob);
            }
        } catch (e: any) {
            console.error("Error loading Zotero Reader view:", e);
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

    private async extractExternalAnnotation(fileBlob: Blob) {
        const currentMD5 = this.attachmentItem.raw.data.md5;
        const lastExtractionMD5 =
            this.attachmentItem.annotationExtractionFileMD5;
        // Only extract for PDFs
        const isPDF =
            this.attachmentItem.raw.data.contentType === "application/pdf";

        if (isPDF) {
            if (currentMD5 && currentMD5 === lastExtractionMD5) {
                console.log(
                    "[ZotFlow] Skipping annotation extraction (MD5 match)",
                );
            } else {
                console.log(
                    "[ZotFlow] MD5 mismatch or missing. Extracting annotations...",
                );

                // Delete existing external annotations for this item
                await db.items
                    .where(["libraryID", "parentItem"])
                    .equals([
                        this.attachmentItem.libraryID,
                        this.attachmentItem.key,
                    ])
                    .filter(
                        (i) =>
                            (i as IDBZoteroItem<AnnotationData>).raw.data
                                .annotationIsExternal === true,
                    )
                    .delete();

                const externalAnnotationsRaw =
                    await workerBridge.pdfProcessWorker.import(
                        await fileBlob.arrayBuffer(),
                        true,
                    );

                const externalAnnotations = externalAnnotationsRaw.map(
                    this.handleExternalAnnotation,
                );

                // Push to Reader
                await Promise.all(
                    externalAnnotations.map((annotation) => {
                        this.bridge!.addAnnotation(annotation);
                    }),
                );

                // Update Extraction MD5
                if (currentMD5) {
                    await db.items.update(
                        [
                            this.attachmentItem.libraryID,
                            this.attachmentItem.key,
                        ],
                        {
                            annotationExtractionFileMD5: currentMD5,
                        },
                    );
                    this.attachmentItem.annotationExtractionFileMD5 =
                        currentMD5;
                }
                console.log("[ZotFlow] Annotations extracted successfully");
            }
        }
    }

    private async handleAnnotationsSaved(annotations: any[]) {
        const { libraryID, key: parentItem } = this.attachmentItem;
        const library = this.attachmentItem.raw.library;

        for (const json of annotations) {
            const annotationData = annotationItemFromJSON(json);
            const key = json.id;

            const existing = await db.items.get([libraryID, key]);

            if (existing && !json.isExternal) {
                // Determine new sync status
                const newSyncStatus =
                    existing.syncStatus === "created" ? "created" : "updated";

                await db.transaction("rw", db.items, async () => {
                    await db.items.update([libraryID, key], {
                        raw: {
                            ...existing.raw,
                            data: {
                                ...existing.raw.data,
                                ...annotationData,
                            } as any,
                        },
                        dateModified: new Date().toISOString(),
                        syncStatus: newSyncStatus,
                    });
                });
            } else {
                const now = new Date().toISOString();
                // Mock user for local creation if needed, or rely on what's in settings/library
                const newItem: IDBZoteroItem<AnnotationData> = {
                    libraryID,
                    key,
                    itemType: "annotation",
                    parentItem,
                    trashed: 0,
                    title: "",
                    collections: [],
                    dateAdded: now,
                    dateModified: now,
                    version: 0,
                    searchCreators: [],
                    searchTags: [],
                    syncStatus: json.isExternal ? "created" : "ignore",
                    raw: {
                        key,
                        version: 0,
                        library,
                        links: {},
                        meta: {
                            numChildren: 0,
                        },
                        data: {
                            ...annotationData,
                            key,
                            itemType: "annotation",
                            parentItem,
                            relations: {},
                            dateAdded: now,
                            dateModified: now,
                            tags: annotationData.tags || [],
                            deleted: false,
                            version: 0,
                        } as unknown as AnnotationData,
                    },
                };
                await db.transaction("rw", db.items, async () => {
                    await db.items.put(newItem);
                });
            }
        }
    }

    /**
     * Get all annotations for a given item from the local database.
     *
     * @param libraryID The ID of the Zotero library (user or group ID).
     * @param itemKey The key of the parent item (e.g., journal article) to fetch annotations for.
     * @returns A promise that resolves to an array of annotation items.
     */
    private async getAnnotationJson(
        item: IDBZoteroItem<AttachmentData>,
    ): Promise<AnnotationJSON[]> {
        // Get current user from settings/DB
        const apiKey = this.settings.zoteroApiKey;
        const currentUserKey = await db.keys.get(apiKey);
        const currentUser = currentUserKey
            ? {
                  id: currentUserKey.userID,
                  username: currentUserKey.username,
                  displayName: currentUserKey.displayName,
              }
            : null;

        // Get Library Info
        const library = await db.libraries.get(item.libraryID);
        const isGroup = library?.type === "group";

        // Get User info (for creator/modifier)
        // lastModifiedByUser is not readily available in standard Zotero item API response
        // We will assume it's createdByUser if not present.

        // Tag Colors from Settings
        const tagColors = new Map();
        /*
        if (client.settings.tagColors && client.settings.tagColors.value) {
            client.settings.tagColors.value.forEach((tc: any) => {
                tagColors.set(tc.name, { color: tc.color, position: 0 }); // Position logic might need refinement if present in settings
            });
        }
        */

        // Zotero Annotations
        const annotations = (await db.items
            .where(["libraryID", "parentItem", "itemType", "trashed"])
            .equals([item.libraryID, item.key, "annotation", 0])
            .toArray()) as IDBZoteroItem<AnnotationData>[];

        // External Annotations
        const annotationJson: AnnotationJSON[] = [];
        for (const annotation of annotations) {
            const o: any = {};
            o.libraryID = annotation.libraryID;
            o.id = annotation.key;
            o.type = annotation.raw.data.annotationType;
            o.isExternal = annotation.raw.data.annotationIsExternal || false; // Default to false

            const isAuthor =
                !annotation.raw.meta.createdByUser?.id ||
                annotation.raw.meta.createdByUser?.id === currentUser?.id;
            const isReadOnly = false; // Defaulting to false

            if (annotation.raw.data.annotationAuthorName) {
                o.authorName = annotation.raw.data.annotationAuthorName;
                if (isGroup) {
                    // Not sure what is lastModifiedByUser
                }
            } else if (
                !o.isExternal &&
                isGroup &&
                annotation.raw.meta.createdByUser
            ) {
                o.authorName =
                    annotation.raw.meta.createdByUser.username ||
                    annotation.raw.meta.createdByUser.name;
                o.isAuthorNameAuthoritative = true;
            }

            o.readOnly = isReadOnly || o.isExternal || !isAuthor;

            if (o.type === "highlight" || o.type === "underline") {
                o.text = annotation.raw.data.annotationText;
            }

            o.comment = annotation.raw.data.annotationComment;
            o.pageLabel = annotation.raw.data.annotationPageLabel;
            o.color = annotation.raw.data.annotationColor;
            o.sortIndex = annotation.raw.data.annotationSortIndex;
            o.position = JSON.parse(annotation.raw.data.annotationPosition);

            // Add tags
            const tags = annotation.raw.data.tags || [];

            const processedTags = tags.map((t) => {
                const obj: any = {
                    name: t.tag,
                };
                /*
                if (tagColors.has(t.tag)) {
                    obj.color = tagColors.get(t.tag).color;
                    obj.position = tagColors.get(t.tag).position;
                }
                */
                return obj;
            });

            processedTags.sort((a, b) => {
                if (!a.color && !b.color) {
                    return a.name.localeCompare(b.name, {
                        sensitivity: "accent",
                    });
                }
                if (!a.color && !b.color) {
                    return -1;
                }
                if (!a.color && b.color) {
                    return 1;
                }
                return a.position - b.position;
            });

            processedTags.forEach((t) => delete t.position);
            o.tags = processedTags;

            o.dateModified = annotation.dateModified;
            annotationJson.push(o);
        }
        return annotationJson;
    }

    private handleExternalAnnotation(annotation: any): AnnotationJSON {
        return {
            id: annotation.key,
            type: annotation.annotationType,
            isExternal: true,
            authorName: annotation.annotationAuthorName,
            readOnly: true,
            text: annotation.annotationText,
            comment: annotation.annotationComment,
            pageLabel: annotation.annotationPageLabel,
            color: annotation.annotationColor,
            sortIndex: annotation.annotationSortIndex,
            position: JSON.parse(annotation.annotationPosition),
            tags: annotation.tags,
            dateModified: "",
        };
    }
}
