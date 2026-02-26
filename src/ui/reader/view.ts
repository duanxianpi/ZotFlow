import { ItemView, WorkspaceLeaf } from "obsidian";
import { workerBridge } from "bridge";
import { IframeReaderBridge } from "./bridge";
import { services } from "services/services";
import { ViewStateService } from "services/view-state-service";

import type { ViewStateResult } from "obsidian";
import type { AttachmentData } from "types/zotero-item";
import type { IDBZoteroItem, IDBZoteroKey } from "types/db-schema";
import type {
    AnnotationJSON,
    ColorScheme,
    CreateReaderOptions,
    CustomReaderTheme,
} from "types/zotero-reader";
import type { ITaskInfo } from "types/tasks";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";

/** View type identifier for the Zotero cloud reader view. */
export const ZOTERO_READER_VIEW_TYPE = "zotflow-zotero-reader-view";

interface ReaderViewState extends Record<string, unknown> {
    libraryID: number;
    itemKey: string;
}

/** Obsidian `ItemView` that embeds the Zotero reader iframe for remote/cloud attachments. */
export class ZoteroReaderView extends ItemView {
    private attachmentItem: IDBZoteroItem<AttachmentData>;
    private keyInfo: IDBZoteroKey;

    private bridge?: IframeReaderBridge;
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
            const _item = await workerBridge.dbHelper.getAttachmentItem(
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

        // Resolve initial color scheme based on setting
        const schemeSetting = services.settings.readerColorScheme;
        if (schemeSetting === "light") {
            this.colorScheme = "light";
        } else if (schemeSetting === "dark") {
            this.colorScheme = "dark";
        } else {
            this.colorScheme = getComputedStyle(document.body)
                .colorScheme as ColorScheme;
        }

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
                    this.handleViewStateChanged(evt.state, evt.primary);
                });

                this.bridge.onEventType("saveCustomThemes", (evt) => {
                    services.viewStateService.saveCustomThemes(
                        evt.customThemes as CustomReaderTheme[],
                    );
                });

                this.bridge.onEventType("setLightTheme", (evt) => {
                    this.handleSetTheme("light", evt.theme);
                });

                this.bridge.onEventType("setDarkTheme", (evt) => {
                    this.handleSetTheme("dark", evt.theme);
                });

                // Observe color scheme changes via Obsidian's css-change event
                // Only monitor when following Obsidian scheme
                if (
                    schemeSetting === "obsidian" ||
                    schemeSetting === "obsidian-theme"
                ) {
                    this.registerEvent(
                        this.app.workspace.on("css-change", () => {
                            if (
                                schemeSetting === "obsidian" ||
                                schemeSetting === "obsidian-theme"
                            ) {
                                const newColorScheme = getComputedStyle(
                                    document.body,
                                ).colorScheme as ColorScheme;
                                if (
                                    newColorScheme &&
                                    newColorScheme !== this.colorScheme
                                ) {
                                    this.bridge!.setColorScheme(newColorScheme);
                                    this.colorScheme = newColorScheme;
                                }
                            }
                        }),
                    );
                }
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
                const savedViewState = services.viewStateService.getViewState(
                    ViewStateService.remoteKey(
                        this.attachmentItem.libraryID,
                        this.attachmentItem.key,
                    ),
                );

                const themeDefaults = {
                    lightTheme: services.settings.defaultLightTheme,
                    darkTheme: services.settings.defaultDarkTheme,
                };

                // User's saved theme takes top priority
                const themeOverrides = {
                    lightTheme:
                        savedViewState?.lightTheme ?? themeDefaults.lightTheme,
                    darkTheme:
                        savedViewState?.darkTheme ?? themeDefaults.darkTheme,
                };

                const opts: Partial<CreateReaderOptions> = {
                    annotations: annotationJson,
                    primaryViewState: savedViewState?.primaryViewState,
                    colorScheme: this.colorScheme,
                    customThemes: services.viewStateService.getCustomThemes(),
                    ...themeOverrides,
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
        };
    }

    async onClose() {
        this.unsubscribeTaskMonitor?.();
        if (this.bridge) {
            await this.bridge.dispose();
        }

        // Flush view state on close to ensure latest state is saved
        services.viewStateService.flushViewStateSave();
    }

    /**
     * Persist the reader's view state to data.json.
     */
    private handleViewStateChanged(state: unknown, primary: boolean) {
        if (!this.attachmentItem) return;

        services.viewStateService.saveViewState(
            ViewStateService.remoteKey(
                this.attachmentItem.libraryID,
                this.attachmentItem.key,
            ),
            primary,
            state as Record<string, unknown>,
        );
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
     * Persist a theme choice to the view state.
     */
    private handleSetTheme(kind: "light" | "dark", theme: unknown) {
        if (!this.attachmentItem) return;
        services.viewStateService.saveTheme(
            ViewStateService.remoteKey(
                this.attachmentItem.libraryID,
                this.attachmentItem.key,
            ),
            kind,
            theme,
        );
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
