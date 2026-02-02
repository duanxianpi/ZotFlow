import { ItemView, WorkspaceLeaf } from "obsidian";
import React from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { ZotFlowTree } from "./TreeView";

export const TREE_VIEW_TYPE = "zotflow-tree-view";

export class ZotFlowTreeView extends ItemView {
    root: Root | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return TREE_VIEW_TYPE;
    }

    getDisplayText() {
        return "Zotero Library";
    }

    getIcon() {
        return "library";
    }

    async onOpen() {
        this.root = createRoot(this.contentEl);
        this.root.render(
            <React.StrictMode>
                <ZotFlowTree />
            </React.StrictMode>,
        );
    }

    async onClose() {
        this.root?.unmount();
    }
}
