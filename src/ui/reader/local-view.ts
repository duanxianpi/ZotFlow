import { FileView, WorkspaceLeaf, Notice, TFile, ItemView } from "obsidian";
import { workerBridge } from "bridge";
import { IframeReaderBridge } from "./bridge";
import { LocalAnnotationManager } from "./local-anno-manager";

import type {
    CreateReaderOptions,
    ColorScheme,
    AnnotationJSON,
} from "types/zotero-reader";
import { services } from "services/services";

export const LOCAL_ZOTERO_READER_VIEW_TYPE = "zotflow-local-zotero-reader-view";

export class LocalReaderView extends ItemView {
    private file: TFile | null = null;
    private bridge?: IframeReaderBridge;
    private colorSchemeObserver?: MutationObserver;
    private colorScheme: ColorScheme = "light"; // Default to light
    private readerOptions: Partial<CreateReaderOptions> = {};
    private annotationManager?: LocalAnnotationManager;

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

    async onOpen() {
        // add action to trigger update
        this.addAction("dice", "Trigger Update", () => {
            console.log(this.file);
        });
    }

    async setState(state: any, result: any) {
        if (state.file) {
            const file = services.app.vault.getAbstractFileByPath(state.file);
            if (file instanceof TFile) {
                this.file = file;
                this.containerEl
                    .getElementsByClassName("view-header-title")[0]
                    ?.setText(this.file.name);
                this.loadDocument(this.file);
            }
        }
        super.setState(state, result);
    }

    getState(): any {
        return {
            file: this.file?.path,
        };
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
                // Initialize annotation manager
                this.annotationManager = new LocalAnnotationManager(file);
                this.bridge = new IframeReaderBridge(
                    container,
                    true,
                    undefined,
                    file,
                    this.annotationManager,
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

                this.bridge.onEventType("annotationsSaved", async (evt) => {
                    await this.handleAnnotationsSaved(evt.annotations);
                });

                this.bridge.onEventType("annotationsDeleted", async (evt) => {
                    await this.handleAnnotationsDeleted(evt.ids);
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
            const [_, buffer, loadedAnnotations] = await Promise.all([
                this.bridge.connect(),
                this.app.vault.readBinary(file),
                (async () => {
                    return await this.annotationManager?.load();
                })(),
            ]);

            console.log(this.bridge);

            // Initialize Reader if ready
            if (this.bridge.state === "bridge-ready") {
                const opts = {
                    ...this.readerOptions,
                    colorScheme: this.colorScheme,
                    annotations: loadedAnnotations,
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
    // Handle navigation info
    setEphemeralState(state: any): void {
        if (state && state.subpath) {
            const subpath = state.subpath;
            const navigationInfo = this.parseNavigationInfo(subpath);

            if (navigationInfo) {
                this.readerNavigate(navigationInfo);
            }
        }

        super.setEphemeralState(state);
    }

    // Parse navigation info
    parseNavigationInfo(subpath: string): any {
        //Regex to match annotation=url_encoded_string
        const match = subpath.match(/annotation=([^&]+)/);
        if (match && match[1]) {
            return JSON.parse(decodeURIComponent(match[1]));
        }
        return null;
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

    /**
     * Handle saved/updated annotations
     */
    private async handleAnnotationsSaved(annotations: any[]) {
        if (this.annotationManager) {
            for (const annotation of annotations) {
                const isVisual =
                    annotation.type === "image" || annotation.type === "ink";
                if (isVisual && annotation.image) {
                    workerBridge.localNote.saveBase64Image(
                        annotation.image,
                        annotation.id,
                    );
                }
                await this.annotationManager.save(annotation);
            }
        }
    }

    /**
     * Handle deleted annotations
     * Optimization: Batch processing
     */
    private async handleAnnotationsDeleted(ids: string[]) {
        if (this.annotationManager) {
            for (const id of ids) {
                const annotation = this.annotationManager.get(id);
                if (annotation) {
                    const isVisual =
                        annotation.type === "image" ||
                        annotation.type === "ink";
                    if (isVisual) {
                        workerBridge.localNote.deleteAnnotationImage(id);
                    }
                }
                await this.annotationManager.delete(id);
            }
        }
    }
}
