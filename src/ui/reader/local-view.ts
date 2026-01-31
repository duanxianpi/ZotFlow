import { FileView, WorkspaceLeaf, Notice, TFile } from "obsidian";
import * as Comlink from "comlink";
import { workerBridge } from "bridge";
import { IframeReaderBridge } from "./bridge";

import type { CreateReaderOptions, ColorScheme } from "types/zotero-reader";
import type { IDBZoteroItem } from "types/db-schema";
import type { AttachmentData } from "types/zotero-item";

export const LOCAL_ZOTERO_READER_VIEW_TYPE = "zotflow-local-zotero-reader-view";

export class LocalReaderView extends FileView {
    private bridge?: IframeReaderBridge;
    private colorSchemeObserver?: MutationObserver;
    private colorScheme: ColorScheme = "light"; // Default to light
    private readerOptions: Partial<CreateReaderOptions> = {};

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return LOCAL_ZOTERO_READER_VIEW_TYPE;
    }

    getDisplayText() {
        return this.file?.name || "Zotero Reader";
    }

    getIcon() {
        return "book-open";
    }

    async onLoadFile(file: TFile): Promise<void> {
        this.loadDocument(file);
    }

    private async loadDocument(file: TFile) {
        const container = this.contentEl;
        container.empty();

        const loadingEl = container.createDiv({ cls: "zotflow-loading" });
        loadingEl.setText(`Loading ${file.name}...`);

        try {
            this.renderReader(file);
        } catch (e) {
            console.error(e);
            new Notice("Error loading document");
        }
    }

    private async renderReader(file: TFile) {
        const container = this.contentEl;

        // Ensure color scheme is set initially
        this.colorScheme = getComputedStyle(document.body)
            .colorScheme as ColorScheme;

        try {
            // Create bridge once
            if (!this.bridge) {
                this.bridge = new IframeReaderBridge(container, true);

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
            await this.bridge.connect();
            const buffer = await this.app.vault.readBinary(file);

            // Process Local File (MD5 & Source Note)
            try {
                // Slice buffer: Head (1KB), Mid (1KB), Tail (1KB)
                const sliceSize = 1024;
                const slices: ArrayBuffer[] = [];
                const len = buffer.byteLength;

                if (len <= sliceSize * 3) {
                    // Small file: take whole
                    slices.push(buffer.slice(0));
                } else {
                    slices.push(buffer.slice(0, sliceSize)); // Head
                    slices.push(
                        buffer.slice(
                            Math.floor(len / 2),
                            Math.floor(len / 2) + sliceSize,
                        ),
                    ); // Mid
                    slices.push(buffer.slice(len - sliceSize)); // Tail
                }

                // Call worker with Transferable
                const result = await workerBridge.localNote.openNote({
                    slices: Comlink.transfer(slices, slices),
                    filename: file.name,
                    path: file.path,
                });

                if (result) {
                    console.log(
                        `[LocalReaderView] Processed file. Key: ${result.key}, Note: ${result.path}`,
                    );
                }
            } catch (err) {
                console.error(
                    "[LocalReaderView] Failed to process local file:",
                    err,
                );
            }

            // Initialize Reader if ready
            if (this.bridge.state === "bridge-ready") {
                const opts = {
                    ...this.readerOptions,
                    colorScheme: this.colorScheme,
                    annotations: [], // No annotations for local files
                };

                const type = this.getReaderType(file.extension);

                // Initialize Reader Logic
                this.bridge.initReader({
                    data: {
                        buf: new Uint8Array(buffer),
                        url: null,
                    },
                    type: type as any,
                    authorName: "",
                    ...opts,
                });
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

    private getReaderType(extension: string) {
        switch (extension.toLowerCase()) {
            case "pdf":
                return "pdf";
            case "epub":
                return "epub";
            case "html":
                return "snapshot";
            default:
                return "pdf";
        }
    }

    readerNavigate(navigationInfo: any) {
        if (!this.bridge) return;
        this.bridge.navigate(navigationInfo);
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
