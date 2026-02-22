import { ItemView, WorkspaceLeaf } from "obsidian";
import { workerBridge } from "bridge";
import { IframeReaderBridge } from "./bridge";
import { services } from "services/services";

import type { ViewStateResult } from "obsidian";
import type { AttachmentData } from "types/zotero-item";
import type { IDBZoteroItem, IDBZoteroKey } from "types/db-schema";
import type {
    CreateReaderOptions,
    AnnotationJSON,
    ColorScheme,
} from "types/zotero-reader";
import type { ITaskInfo } from "types/tasks";
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
    private unsubscribeTaskMonitor?: () => void;
    private lastSyncTaskStatuses = new Map<string, ITaskInfo["status"]>();

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
        const _keyInfo = await workerBridge.annotation.getKeyInfo(
            services.settings.zoteroapikey,
        );

        if (!_keyInfo) {
            services.logService.error(
                `Key ${services.settings.zoteroapikey} doesn't exist`,
                "ZoteroReaderView",
            );
            throw new Error(
                `Key ${services.settings.zoteroapikey} doesn't exist`,
            );
        }

        if (state.itemKey) {
            const _item = await workerBridge.query.getAttachmentItem(
                state.libraryID,
                state.itemKey,
            );
            if (!_item) {
                services.logService.error(
                    `Item ${state.itemKey} doesn't exist or is not an attachment`,
                    "ZoteroReaderView",
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
            const annotationJson = await workerBridge.annotation.getAnnotations(
                this.attachmentItem,
                services.settings.zoteroapikey,
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

                // Subscribe to sync events for live annotation updates
                this.subscribeToSyncEvents();
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
        this.unsubscribeTaskMonitor?.();
        if (this.colorSchemeObserver) {
            this.colorSchemeObserver.disconnect();
        }
        if (this.bridge) {
            await this.bridge.dispose();
        }
    }

    /**
     * Subscribe to TaskMonitor and refresh annotations in the reader
     * when a sync task that covers this attachment's library completes.
     */
    private subscribeToSyncEvents() {
        // Avoid double-subscribe
        this.unsubscribeTaskMonitor?.();

        this.unsubscribeTaskMonitor = services.taskMonitor.subscribe(
            (tasks: ITaskInfo[]) => {
                for (const task of tasks) {
                    if (task.type !== "sync") continue;

                    const prev = this.lastSyncTaskStatuses.get(task.id);
                    this.lastSyncTaskStatuses.set(task.id, task.status);

                    // Only act on a transition *into* "completed"
                    if (task.status !== "completed" || prev === "completed")
                        continue;

                    // Check if the sync covers this attachment's library
                    const taskLibId = task.input?.["libraryId"];
                    if (
                        taskLibId !== undefined &&
                        taskLibId !== this.attachmentItem.libraryID
                    ) {
                        continue; // Sync was for a different library
                    }

                    // Refresh annotations from IDB without reconnecting
                    services.logService.info(
                        `Sync completed — refreshing reader annotations (task ${task.id})`,
                        "ZoteroReaderView",
                    );
                    this.refreshAnnotationsFromDB().catch((e) => {
                        services.logService.error(
                            "Failed to refresh reader annotations after sync",
                            "ZoteroReaderView",
                            e,
                        );
                    });

                    // One refresh per update batch is enough
                    break;
                }
            },
        );
    }

    /**
     * Re-read annotations from IDB and push them to the reader iframe
     * without tearing down the bridge.
     */
    private async refreshAnnotationsFromDB() {
        if (!this.bridge || this.bridge.state !== "reader-ready") return;

        const annotations = await workerBridge.annotation.getAnnotations(
            this.attachmentItem,
            services.settings.zoteroapikey,
        );

        this.bridge.refreshAnnotations(annotations);
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
                {
                    libraryID: this.attachmentItem.libraryID,
                    itemKey: this.attachmentItem.key,
                },
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
     * Handle saved/updated annotations
     */
    private async handleAnnotationsSaved(annotations: AnnotationJSON[]) {
        try {
            await workerBridge.annotation.saveAnnotations(
                this.attachmentItem,
                this.keyInfo,
                annotations,
            );
        } catch (e) {
            services.logService.error(
                "Failed to save annotations",
                "ZoteroReaderView",
                e,
            );
            services.notificationService.notify(
                "error",
                "Failed to save annotations",
            );
        }
    }

    /**
     * Handle deleted annotations
     */
    private async handleAnnotationsDeleted(ids: string[]) {
        try {
            await workerBridge.annotation.deleteAnnotations(
                this.attachmentItem,
                ids,
            );
        } catch (e) {
            services.logService.error(
                "Failed to delete annotations",
                "ZoteroReaderView",
                e,
            );
            services.notificationService.notify(
                "error",
                "Failed to delete annotations",
            );
        }
    }
}
