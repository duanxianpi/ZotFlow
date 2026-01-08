import { ItemView, WorkspaceLeaf, Notice, ViewStateResult } from 'obsidian';
import { services } from '../services/serivces';

export const VIEW_TYPE_ZOTERO_READER = 'zotero-reader-view';

export class ZoteroReaderView extends ItemView {
    private itemKey: string = '';

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
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

    async setState(state: any, result: ViewStateResult): Promise<void> {
        if (state.itemKey) {
            this.itemKey = state.itemKey;
            await this.loadDocument();
        }
        super.setState(state, result);
    }

    async loadDocument() {
        const container = this.contentEl;
        container.empty();

        const loadingEl = container.createDiv({ cls: 'zotflow-loading' });
        loadingEl.setText(`Downloading/Loading ${this.itemKey}...`);

        try {
            const blob = await services.files.getFileBlob(this.itemKey);

            if (blob) {
                loadingEl.remove();
                container.createEl('h2', { text: 'Success!' });
                container.createDiv({ text: `Loaded Blob Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB` });
                container.createDiv({ text: `MIME: ${blob.type}` });

                // --- 真正的 PDF.js 渲染逻辑将在这里开始 ---
                // const url = URL.createObjectURL(blob);
                // this.renderPDF(url);
            } else {
                loadingEl.setText("Failed to load file.");
            }
        } catch (e) {
            console.error(e);
            new Notice("Error loading document");
        }
    }
}