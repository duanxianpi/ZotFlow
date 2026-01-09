import { ItemView, WorkspaceLeaf, Notice, ViewStateResult } from 'obsidian';
import { services } from '../services/serivces';
import { IframeReaderBridge } from './zotero-reader-bridge';
import { ColorScheme } from 'types/zotero-reader';
import ObsidianZotFlow from '../main';
import { CreateReaderOptions } from 'types/zotero-reader';
import { db } from 'db/db';
import { IDBZoteroItem } from 'types/db-schema';
import { AttachmentData } from 'types/zotero-item';

export const VIEW_TYPE_ZOTERO_READER = 'zotflow-zotero-reader-view';

interface ReaderViewState extends Record<string, unknown> {
    itemKey: string;
    readerOptions: Partial<CreateReaderOptions>;
}

export class ZoteroReaderView extends ItemView {
    private attachmentItem: IDBZoteroItem<AttachmentData>;
    private readerOptions: Partial<CreateReaderOptions>;

    private plugin: ObsidianZotFlow;
    private bridge?: IframeReaderBridge;
    private colorSchemeObserver?: MutationObserver;
    private colorScheme: ColorScheme = "light"; // Default to light

    constructor(leaf: WorkspaceLeaf, plugin: ObsidianZotFlow) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_ZOTERO_READER;
    }

    getDisplayText() {
        return "Zotero Reader";
    }

    getIcon() {
        return "book-open";
    }

    async setState(state: ReaderViewState, result: ViewStateResult): Promise<void> {
        console.log("TEST", state, result)
        if (state.itemKey) {
            const _item = await db.items.get(state.itemKey);
            if (!_item || _item.itemType !== "attachment") {
                console.error(`[ZotFlow] Item ${state.itemKey} doesn't exist or is not an attachment`);
                throw new Error(`Item ${state.itemKey} doesn't exist or is not an attachment`);
            }
            this.attachmentItem = _item as IDBZoteroItem<AttachmentData>;
            await this.loadDocument();
        }

        this.readerOptions = state.readerOptions;
        super.setState(state, result);
    }

    private async loadDocument() {
        const container = this.contentEl;
        container.empty();

        const loadingEl = container.createDiv({ cls: 'zotflow-loading' });
        loadingEl.setText(`Downloading/Loading ${this.attachmentItem.key}...`);

        try {
            await this.renderReader();
        } catch (e) {
            console.error(e);
            new Notice("Error loading document");
        }
    }

    private async renderReader() {
        const container = this.contentEl;

        // Ensure color scheme is set initially
        this.colorScheme = getComputedStyle(document.body).colorScheme as ColorScheme;

        try {
            // Create bridge once
            if (!this.bridge) {
                this.bridge = new IframeReaderBridge(
                    container,
                    this.plugin.settings
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
            console.log("TEST")
            const [_, fileBlob] = await Promise.all([
                this.bridge.connect(),
                services.files.getFileBlob(this.attachmentItem.key)
            ]);

            if (!fileBlob) {
                console.error(`[ZotFlow] Failed to get file blob for ${this.attachmentItem.key}`);
                throw new Error("File not found or failed to download");
            }

            // Prepare Data
            const arrayBuffer = fileBlob;

            // Initialize Reader if ready
            if (this.bridge.state === "ready") {
                // // Get stored view states from frontmatter(Placeholder logic preserved)
                // const primaryViewState = this.fileFrontmatter?.["primaryViewState"];
                // const secondaryViewState = this.fileFrontmatter?.["secondaryViewState"];
                // const extraOptions = this.fileFrontmatter?.["options"];

                const opts = {
                    ...this.readerOptions,
                    colorScheme: this.colorScheme,
                    // annotations: annotations, // You would fetch these from DB using this.parentItemKey
                    // primaryViewState,
                    // secondaryViewState,
                    // customThemes: this.plugin.settings.readerThemes, // Using settings
                    // sidebarPosition: this.plugin.settings.sidebarPosition,
                    // ...extraOptions,
                };

                const contentType = this.attachmentItem.raw.data.contentType;
                let type: 'pdf' | 'epub' | 'snapshot' | 'paperclip';
                switch (contentType) {
                    case 'application/pdf':
                        type = 'pdf';
                        break;
                    case 'application/epub+zip':
                        type = 'epub';
                        break;
                    case 'text/html':
                        type = 'snapshot';
                        break;
                    default:
                        console.error(`Unknown content type: ${contentType}`);
                        throw new Error(`Unknown content type: ${contentType}`);
                }

                const arrayBuffer = await fileBlob.arrayBuffer()
                await this.bridge.initReader({
                    data: { buf: new Uint8Array(arrayBuffer), url: null }, // Pass buffer
                    type: type,
                    // title: ... // Optional title
                    ...opts,
                });

                console.log("INITED")
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
            errorMessage
                .createEl("div")
                .setText("Error details: " + e.message);
        }
    }

    getState(): ReaderViewState {
        return {
            itemKey: this.attachmentItem.key,
            readerOptions: this.readerOptions
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