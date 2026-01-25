import {
    Notice,
    TFile,
    normalizePath,
    App,
    TAbstractFile,
    MarkdownView,
} from "obsidian";
import type { AnyIDBZoteroItem } from "types/db-schema";
import { TemplateService } from "./template-service";
import { db } from "db/db";
import type { ZotFlowSettings } from "settings/types";

export class NoteService {
    constructor(
        private app: App,
        private templateService: TemplateService,
        private settings: ZotFlowSettings,
    ) {}

    updateSettings(newSettings: ZotFlowSettings) {
        this.settings = newSettings;
    }

    /**
     * Creates or opens a source note for the given Zotero item.
     * @param item The Zotero item to create a note for.
     * @param forceUpdate If true, overwrites the existing note with new template content.
     */
    async createOrOpenNote(
        libraryID: number,
        key: string,
        forceUpdate: boolean = false,
    ) {
        const item = await db.items.get({
            libraryID: libraryID,
            key: key,
        });
        if (!item) {
            console.error("Item not found");
            return;
        }

        const library = await db.libraries.get({
            id: libraryID,
        });
        if (!library) {
            console.error("Library not found");
            return;
        }

        // Sanitize filename
        const illegalRe = /[\/?<>\\:*|"]/g;
        const controlRe = /[\x00-\x1f\x80-\x9f]/g;
        const reservedRe = /^\.+$/;
        const windowsReservedRe =
            /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

        let filename = `@${item.citationKey || item.title || item.key}`;
        filename = filename
            .replace(illegalRe, "")
            .replace(controlRe, "")
            .replace(reservedRe, "")
            .replace(windowsReservedRe, "");

        const folder = this.settings.sourceNoteFolder.replace(/\/$/, "");
        const extension = "md";

        let path = normalizePath(
            `${folder}/${library.name}/${filename}.${extension}`,
        );

        let file = this.app.vault.getAbstractFileByPath(path);

        if (file && forceUpdate && file instanceof TFile) {
            // Update existing note
            try {
                const content = await this.templateService.renderItem(item);
                await this.app.vault.modify(file, content);
            } catch (err) {
                console.error("Failed to update note", err);
                new Notice("Failed to update note. Check console.");
                return;
            }
        } else if (!file) {
            // Create new note
            try {
                const content = await this.templateService.renderItem(item);

                // Create the folder if it doesn't exist
                const folderPath = path.split("/").slice(0, -1).join("/");
                if (!(await this.app.vault.adapter.exists(folderPath))) {
                    await this.app.vault.createFolder(folderPath);
                }

                file = await this.app.vault.create(path, content);
            } catch (err) {
                console.error("Failed to create note", err);
                new Notice("Failed to create note. Check console.");
                return;
            }
        } else {
            new Notice(`Opened existing note: ${file.name}`);
        }

        await this.openNote(file, true);
    }

    private async openNote(file: TAbstractFile, newLeaf: boolean) {
        const leaves = this.app.workspace.getLeavesOfType("markdown");
        for (const leaf of leaves) {
            const view = leaf.view as MarkdownView;
            if (view.file && view.file.path === file.path) {
                this.app.workspace.setActiveLeaf(leaf);
                return;
            }
        }

        if (file instanceof TFile) {
            this.app.workspace.getLeaf(newLeaf).openFile(file);
        }
    }

    private async getAvailablePath(
        app: App,
        folderPath: string,
        filename: string,
        extension: string,
    ) {
        let finalName = filename;
        let i = 1;

        let path = normalizePath(`${folderPath}/${finalName}.${extension}`);

        while (await app.vault.adapter.exists(path)) {
            finalName = `${filename} (${i})`;
            path = normalizePath(`${folderPath}/${finalName}.${extension}`);
            i++;
        }

        return path;
    }

    async batchCreateNotes(items: AnyIDBZoteroItem[]) {
        new Notice(
            `Batch creation not fully implemented yet. Selected ${items.length} items.`,
        );
        // TODO: Loop through items and create notes.
        // Careful with UI blocking.
    }
}
