import { TFile, App, Notice } from "obsidian";

/**
 * IndexService is a service that indexes all markdown files in the vault.
 * It uses the metadataCache to get the zotero-key from the frontmatter.
 * It uses the vault to get the markdown files.
 */
export class IndexService {
    private keyToFileMap: Map<string, TFile> = new Map();
    private app: App;
    private initialized: boolean = false;

    constructor(app: App) {
        this.app = app;
    }

    // Initialize
    public load() {
        // Wait for Obsidian layout to be ready before the first scan
        this.app.workspace.onLayoutReady(() => {
            console.log("ZotFlow: Layout ready, building index...");
            this.rebuildIndex();
            this.registerEvents();
            this.initialized = true;
        });
    }

    // Listen for changes (incremental updates, no need for full rescan)
    private registerEvents() {
        // Listen for metadata changes (including Frontmatter modifications)
        this.app.metadataCache.on("changed", (file) => {
            this.indexFile(file);
        });

        // Listen for file rename/move
        this.app.vault.on("rename", (file, oldPath) => {
            if (file instanceof TFile) this.indexFile(file);
        });

        // Listen for deletion
        this.app.vault.on("delete", (file) => {
            if (file instanceof TFile) this.removeFileIndex(file);
        });
    }

    // Build index
    private rebuildIndex() {
        this.keyToFileMap.clear();
        const files = this.app.vault.getMarkdownFiles();

        files.forEach((file) => {
            this.indexFile(file);
        });

        console.log(
            `ZotFlow: Index built. Found ${this.keyToFileMap.size} linked files.`,
        );
    }

    // Process a single file
    public indexFile(file: TFile) {
        // Get data from cache, do not await read()
        const cache = this.app.metadataCache.getFileCache(file);
        const zoteroKey = cache?.frontmatter?.["zotero-key"];

        if (zoteroKey) {
            this.keyToFileMap.set(zoteroKey, file);
        }
    }

    private removeFileIndex(file: TFile) {
        for (const [key, indexedFile] of this.keyToFileMap.entries()) {
            if (indexedFile.path === file.path) {
                this.keyToFileMap.delete(key);
                break;
            }
        }
    }

    // Public query API
    public getFileByKey(key: string): TFile | undefined {
        if (!this.initialized) {
            new Notice(
                "ZotFlow: Index not initialized. Please wait for the layout to be ready.",
            );
        }
        return this.keyToFileMap.get(key);
    }
}
