import { ItemView, WorkspaceLeaf, Notice, ViewStateResult } from "obsidian";
import { services } from "../services/serivces";
import { IframeReaderBridge } from "./zotero-reader-bridge";
import { ColorScheme } from "types/zotero-reader";
import ObsidianZotFlow from "../main";
import { CreateReaderOptions } from "types/zotero-reader";
import { db } from "db/db";
import { IDBZoteroItem } from "types/db-schema";
import { AttachmentData } from "types/zotero-item";
import { getAnnotationJson, handleExternalAnnotation } from "utils/annotation";

export const VIEW_TYPE_ZOTERO_READER = "zotflow-zotero-reader-view";

interface ReaderViewState extends Record<string, unknown> {
    libraryID: number;
    itemKey: string;
    readerOptions: Partial<CreateReaderOptions>;
}

export class ZoteroReaderView extends ItemView {
    private attachmentItem: IDBZoteroItem<AttachmentData>;
    private readerOptions: Partial<CreateReaderOptions>;

    private bridge?: IframeReaderBridge;
    private colorSchemeObserver?: MutationObserver;
    private colorScheme: ColorScheme = "light"; // Default to light

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
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
                this.bridge = new IframeReaderBridge(
                    container,
                    services.settings,
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
                    console.log("Annotations saved:", evt.annotations);
                    // TODO: Here you might want to save annotations to DB using this.parentItemKey
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
                services.files.getFileBlob(this.attachmentItem),
            ]);

            if (!fileBlob) {
                console.error(
                    `[ZotFlow] Failed to get file blob for ${this.attachmentItem.key}`,
                );
                throw new Error("File not found or failed to download");
            }

            // Get Annotations
            const annotationJson = await getAnnotationJson(this.attachmentItem);

            // Initialize Reader if ready
            if (this.bridge.state === "ready") {
                // // Get stored view states from frontmatter(Placeholder logic preserved)
                // const primaryViewState = this.fileFrontmatter?.["primaryViewState"];
                // const secondaryViewState = this.fileFrontmatter?.["secondaryViewState"];
                // const extraOptions = this.fileFrontmatter?.["options"];

                const opts = {
                    ...this.readerOptions,
                    colorScheme: this.colorScheme,
                    annotations: annotationJson,
                    // primaryViewState,
                    // secondaryViewState,
                    // customThemes: this.plugin.settings.readerThemes, // Using settings
                    // sidebarPosition: this.plugin.settings.sidebarPosition,
                    // ...extraOptions,
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

                const keyInfo = await db.keys.get(
                    services.settings.zoteroApiKey,
                );

                const authorName =
                    this.attachmentItem.raw.library.type === "group"
                        ? keyInfo?.username || ""
                        : "";

                const [_, externalAnnotations] = await Promise.all([
                    this.bridge.initReader({
                        data: {
                            buf: new Uint8Array(await fileBlob.arrayBuffer()),
                            url: null,
                        }, // Pass buffer
                        type: type,
                        authorName,
                        // title: ... // Optional title
                        ...opts,
                    }),
                    services.pdfWorker.import(
                        await fileBlob.arrayBuffer(),
                        true,
                    ),
                ]);

                externalAnnotations
                    .map(handleExternalAnnotation)
                    .forEach((annotation) => {
                        this.bridge!.addAnnotation(annotation);
                    });

                // After initReader is finished, try to parse the external annotation
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
}
