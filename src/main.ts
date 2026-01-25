import {
    addIcon,
    App,
    Component,
    Editor,
    MarkdownRenderer,
    MarkdownView,
    Modal,
    Notice,
    Plugin,
    TFile,
    WorkspaceLeaf,
    type ObsidianProtocolData,
} from "obsidian";

import { ZotFlowSettingTab } from "./settings/settings";
import { DEFAULT_SETTINGS } from "./settings/types";
import { workerBridge } from "./bridge";
import { ZOTERO_READER_VIEW_TYPE, ZoteroReaderView } from "./ui/reader/view";
import { TREE_VIEW_TYPE, ZotFlowTreeView } from "./ui/tree-view/view";
import { services } from "./services/services";
import { ZotFlowLockExtension } from "ui/zotflow-lock-extension";

import { openAttachment } from "ui/viewer";

import type { ZotFlowSettings } from "./settings/types";

export default class ZotFlow extends Plugin {
    settings: ZotFlowSettings;

    async onload() {
        // Load settings
        await this.loadSettings();

        // Initialize local services
        services.initialize(this.app, this.settings);

        // Initialize worker bridge
        await workerBridge.initialize(this.settings);

        // Register views
        this.registerView(
            ZOTERO_READER_VIEW_TYPE,
            (leaf) => new ZoteroReaderView(leaf),
        );
        this.registerView(TREE_VIEW_TYPE, (leaf) => new ZotFlowTreeView(leaf));

        // Add tree view to left
        this.app.workspace.onLayoutReady(async () => {
            this.registerTreeView();
        });

        // Register lock extension
        this.registerEditorExtension([ZotFlowLockExtension()]);

        // Register protocol handler for zotflow URIs
        // Usage: obsidian://zotflow?filePath=path/to/file.md
        this.registerObsidianProtocolHandler(
            "zotflow",
            this.handleProtocolCall.bind(this),
        );

        // Ensure MathJax is loaded
        MarkdownRenderer.render(
            this.app,
            "$\\int$",
            document.createElement("div"),
            "",
            new Component(),
        );

        // this.addRibbonIcon(
        //     "library",
        //     "ZotFlow: Open Library",
        //     (evt: MouseEvent) => {
        //         new ZoteroSearchModal(this.app).open();
        //     },
        // );

        this.addRibbonIcon(
            "sync",
            "ZotFlow: Sync Library",
            (evt: MouseEvent) => {
                workerBridge.sync.startSync();
            },
        );

        this.addCommand({
            id: "open-tree-view",
            name: "Open Zotero Tree View",
            callback: () => {
                this.registerTreeView(true);
            },
        });

        this.addSettingTab(new ZotFlowSettingTab(this.app, this));

        // Add Icons

        addIcon(
            "zotero-underline",
            `
			<path style="scale: 5;" fill-rule="evenodd" clip-rule="evenodd" d="M16 16L11 4H9L4 16H6.16667L7.41667 13H12.5833L13.8333 16H16ZM10 6.8L8.04167 11.5H11.9583L10 6.8ZM2 17H3H17H18V17.25V18V18.25H17H3H2V18V17.25V17Z" fill="currentColor"/>
			`,
        );

        addIcon(
            "zotero-highlight",
            `<path style="scale: 5;" fill-rule="evenodd" clip-rule="evenodd" d="M3 3H17V17H3V3ZM1.75 1.75H3H17H18.25V3V17V18.25H17H3H1.75V17V3V1.75ZM16 16L11 4H9L4 16H6.16667L7.41667 13H12.5833L13.8333 16H16ZM10 6.8L8.04167 11.5H11.9583L10 6.8Z" fill="currentColor"/>`,
        );

        addIcon(
            "zotero-note",
            `<path style="scale: 5;" d="M9.375 17.625H17.625V2.375H2.375V10.625M9.375 17.625L2.375 10.625M9.375 17.625V10.625H2.375" stroke="currentColor" stroke-width="1.25" fill="transparent"/>`,
        );
        addIcon(
            "zotero-text",
            `<path style="scale: 5;" fill-rule="evenodd" clip-rule="evenodd" d="M9 2H4V4H9V17H11V4H16V2H11H9Z" fill="currentColor"/>`,
        );
        addIcon(
            "zotero-image",
            `<path style="scale: 5;" d="M12 1.75H8V3H12V1.75Z" fill="currentColor"/><path style="scale: 5;" fill-rule="evenodd" clip-rule="evenodd" d="M4 4V16H16V4H4ZM14.75 5.25H5.25V14.75H14.75V5.25Z" fill="currentColor"/><path style="scale: 5;" d="M17 14H18.25V18.25H14V17H17V14Z" fill="currentColor"/><path style="scale: 5;" d="M18.25 8H17V12H18.25V8Z" fill="currentColor"/><path style="scale: 5;" d="M1.75 8H3V12H1.75V8Z" fill="currentColor"/><path style="scale: 5;" d="M8 17H12V18.25H8V17Z" fill="currentColor"/><path style="scale: 5;" d="M14 3H17V6H18.25V1.75H14V3Z" fill="currentColor"/><path style="scale: 5;" d="M3 3V6H1.75L1.75 1.75H6V3H3Z" fill="currentColor"/><path style="scale: 5;" d="M6 17H3L3 14L1.75 14V18.25H6V17Z" fill="currentColor"/>`,
        );
        addIcon(
            "zotero-ink",
            `<g clip-path="url(#clip0_1132_37397)"><path style="scale: 5;" fill-rule="evenodd" clip-rule="evenodd" d="M15.2993 3.45132C9.70796 0.401476 5.6195 0.767603 3.51167 2.73007C2.06694 4.07517 1.70037 6.04539 2.40922 7.78528C1.9673 8.3293 1.6187 8.97119 1.40141 9.69542C0.6682 12.1393 1.45832 15.336 4.7659 18.773L5.21574 17.4235C2.50064 14.3978 2.0703 11.8158 2.59868 10.0546C2.71734 9.65915 2.88566 9.29662 3.09316 8.97053C3.37618 9.33844 3.71725 9.68296 4.11634 9.99337C6.54681 11.8837 8.86308 11.4966 9.88566 10.048C10.3762 9.35303 10.5148 8.44381 10.1287 7.61814C9.74229 6.79153 8.88965 6.16857 7.63567 5.8899C6.16757 5.56366 4.62141 5.93344 3.40711 6.83169C3.12285 5.67493 3.46864 4.47804 4.36344 3.64494C5.88061 2.2324 9.29215 1.59853 14.7008 4.54869L15.2993 3.45132ZM7.02724 19.9673L6.28793 20.2138C6.38929 20.3018 6.49234 20.3899 6.59709 20.4781L7.02724 19.9673ZM4.88377 9.00668C4.49328 8.70297 4.17813 8.36467 3.93536 8.00651C4.89976 7.1921 6.18125 6.84719 7.36451 7.11014C8.36051 7.33147 8.82035 7.77101 8.99638 8.14754C9.17285 8.52499 9.12392 8.95952 8.86445 9.3271C8.38703 10.0034 6.9533 10.6163 4.88377 9.00668ZM15.6162 6.50001C16.1043 6.01185 16.8958 6.01185 17.3839 6.50001L18.5 7.61612C18.9882 8.10428 18.9882 8.89574 18.5 9.38389L10.5463 17.3376C10.4091 17.4748 10.2418 17.5782 10.0577 17.6396L7.19768 18.5929L6.01183 18.9882L6.40711 17.8024L7.36046 14.9423C7.42182 14.7582 7.52521 14.591 7.66243 14.4537L15.6162 6.50001ZM14.5 9.38389L8.54631 15.3376L7.98825 17.0118L9.66243 16.4537L15.6162 10.5L14.5 9.38389ZM15.3839 8.50001L16.5 9.61612L17.6162 8.50001L16.5 7.38389L15.3839 8.50001Z" fill="currentColor"/></g><defs><clipPath id="clip0_1132_37397"><rect width="20" height="20" fill="white" style="scale: 5;"/></clipPath></defs>`,
        );
        addIcon(
            "zotero-icon",
            `
			<path
			style="fill:none;fill-opacity:1;stroke:currentColor;stroke-width:8.33331;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1"
			d="m 17.213858,8.3334232 h 65.067213 l 5.218851,9.8385298 -44.69689,56.088003 H 87.163227 V 91.666577 H 17.550592 L 12.500086,81.155337 56.607743,25.992326 H 17.045509 Z"/>
			`,
        );
    }

    onunload() {}

    async registerTreeView(active = false) {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(TREE_VIEW_TYPE);

        if (leaves.length > 0) {
            const existingLeaf = leaves[0];
            if (existingLeaf) leaf = existingLeaf;
        } else {
            const leftLeaf = workspace.getLeftLeaf(false);
            if (leftLeaf) {
                leaf = leftLeaf;
                await leaf.setViewState({
                    type: TREE_VIEW_TYPE,
                    active,
                });
            }
        }

        if (leaf && active) workspace.revealLeaf(leaf);
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            (await this.loadData()) as Partial<ZotFlowSettings>,
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
        workerBridge.updateSettings(this.settings);
        services.updateSettings(this.settings);
    }

    /**
     * Handle protocol calls for zotflow
     */
    private async handleProtocolCall(
        params: ObsidianProtocolData,
    ): Promise<void> {
        try {
            const { type, libraryID, key, navigation } = params;

            if (!type || !libraryID || !key) {
                new Notice("ZotFlow: Missing parameters for protocol call");
                return;
            }

            const libID = parseInt(libraryID);
            if (isNaN(libID)) {
                new Notice("ZotFlow: Invalid library ID");
                return;
            }

            if (type === "open-note") {
                await services.note.createOrOpenNote(libID, key, false);
            } else if (type === "open-attachment") {
                await openAttachment(libID, key, this.app, navigation);
            } else {
                new Notice(`ZotFlow: Unknown action type: ${type}`);
            }
        } catch (error) {
            console.error("Error handling zotflow protocol call:", error);
            new Notice("Failed to handle ZotFlow protocol call");
        }
    }
}
