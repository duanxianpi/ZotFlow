import { App, Modal } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import * as React from "react";
import { ZotFlowActivityCenter } from "./ZotFlowActivityCenter";

export class ActivityCenterModal extends Modal {
    private root: Root | null = null;

    constructor(app: App) {
        super(app);
        this.setTitle("ZotFlow Activity Center");
    }

    onOpen() {
        const { contentEl, modalEl } = this;

        modalEl.addClass("mod-zotflow-ac");
        contentEl.empty();

        this.root = createRoot(contentEl);
        this.root.render(
            <React.StrictMode>
                <ZotFlowActivityCenter />
            </React.StrictMode>,
        );
    }

    onClose() {
        const { contentEl } = this;
        if (this.root) {
            this.root.unmount();
        }
        contentEl.empty();
    }
}
