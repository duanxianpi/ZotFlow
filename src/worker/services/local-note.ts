import SparkMD5 from "spark-md5";
import type { IParentProxy } from "bridge/types";
import type { ZotFlowSettings } from "settings/types";
import type { LocalTemplateService } from "./local-template";
import type { UpdateOptions } from "./note";

export interface LocalFileInfo {
    slices: ArrayBuffer[];
    filename: string;
    path: string;
}

export class LocalNoteService {
    private settings: ZotFlowSettings;
    private parentHost: IParentProxy;
    private templateService: LocalTemplateService;
    private debouncers: Map<string, NodeJS.Timeout> = new Map();

    constructor(
        settings: ZotFlowSettings,
        parentHost: IParentProxy,
        templateService: LocalTemplateService,
    ) {
        this.settings = settings;
        this.parentHost = parentHost;
        this.templateService = templateService;
    }

    public updateSettings(settings: ZotFlowSettings) {
        this.settings = settings;
        this.templateService.updateSettings(settings);
    }

    /**
     * ============================================================
     * Public API
     * ============================================================
     */

    /**
     * Open note (core entry point)
     * Automatically find or create note
     * Open file in Obsidian
     */
    async openNote(
        fileInfo: LocalFileInfo,
        options: UpdateOptions = {},
    ): Promise<{ key: string; path: string } | undefined> {
        const result = await this.ensureNote(fileInfo, options);

        if (result && result.path) {
            console.log(`[ZotFlow] Opening note: ${result.path}`);
            await this.parentHost.openFile(result.path, true);
        }
        return result;
    }

    /**
     * Trigger update (for background sync or manual refresh)
     * Support immediate execution or debounced execution
     */
    async triggerUpdate(
        fileInfo: LocalFileInfo,
        options: UpdateOptions = {},
        debounce: boolean = false,
    ): Promise<{ key: string; path: string } | undefined> {
        // We need the key for debouncing, but we can't get it without calculating MD5.
        // For local files, debouncing might be less critical or we calculate MD5 first.
        // To strictly follow NoteService, we'll calculate MD5 inside ensureNote.
        // But for debouncing we need an ID.
        // We can use file path as ID for debouncing if needed, or calculate MD5 quickly.
        // However, we'll implement immediate execution primarily.

        if (!debounce) {
            return await this.ensureNote(fileInfo, options);
        }

        const debounceId = fileInfo.path; // Use file path as unstable ID for debouncing
        if (this.debouncers.has(debounceId)) {
            clearTimeout(this.debouncers.get(debounceId));
            this.debouncers.delete(debounceId);
        }

        return new Promise((resolve) => {
            const timer = setTimeout(async () => {
                this.debouncers.delete(debounceId);
                try {
                    resolve(await this.ensureNote(fileInfo, options));
                } catch (e) {
                    console.error(
                        `[ZotFlow] Debounced update failed for ${fileInfo.path}`,
                        e,
                    );
                    resolve(undefined);
                }
            }, 2000);
            this.debouncers.set(debounceId, timer);
        });
    }

    /**
     * ============================================================
     * Core Logic (Flow Control)
     * ============================================================
     */

    /**
     * Core logic: Ensure note is ready
     * Responsible for routing logic: Calc MD5 -> Index lookup -> Default path fallback -> Existence check -> Create/Update
     */
    private async ensureNote(
        fileInfo: LocalFileInfo,
        options: UpdateOptions,
    ): Promise<{ key: string; path: string } | undefined> {
        const { forceUpdateContent = false } = options;
        const { slices, filename, path: originalFilePath } = fileInfo;

        // 1. Calculate MD5 & Key
        const hash = this.calculateMD5(slices);
        const key = `local_${hash}`;

        console.log(
            `[LocalNoteService] Ensuring note for ${filename} (Key: ${key})`,
        );

        // 2. Determine Path (Index Lookup or Default)
        let notePath = await this.parentHost.getFileByKey(key);

        if (!notePath) {
            // Construct default path
            const noteFolder = this.settings.sourceNoteFolder;
            // Ensure we don't have double slashes
            const folder = noteFolder.endsWith("/")
                ? noteFolder.slice(0, -1)
                : noteFolder;
            notePath = `${folder}/Local/@${filename}.md`.replace(/\/\//g, "/");
        }

        // 3. Check physical file status
        const fileCheck = await this.parentHost.checkFile(notePath);

        try {
            if (fileCheck.exists) {
                // Case A: File exists -> Try update
                await this.performUpdate(
                    key,
                    fileInfo,
                    notePath,
                    fileCheck,
                    forceUpdateContent,
                );
            } else {
                // Case B: File does not exist -> Create new file
                await this.performCreate(key, fileInfo, notePath);
            }
            return { key, path: notePath };
        } catch (e) {
            console.error(
                `[LocalNoteService] Failed to ensure note for ${key}`,
                e,
            );
            return undefined;
        }
    }

    /**
     * ============================================================
     * Execution Helpers
     * ============================================================
     */

    private async performCreate(
        key: string,
        fileInfo: LocalFileInfo,
        notePath: string,
    ) {
        // Create empty file first (optional, but follows NoteService pattern if needed for indexing)
        // But writeTextFile handles creation usually.
        // NoteService does:
        // await this.parentHost.writeTextFile(path, "");
        // await this.parentHost.indexFile(path);
        // Then writes content.

        // We'll generate content first.
        const content = await this.templateService.renderLocalNote(
            key,
            fileInfo.filename,
            fileInfo.path,
        );

        await this.parentHost.writeTextFile(notePath, content);
        await this.parentHost.indexFile(notePath);

        console.log(`[LocalNoteService] Created note: ${notePath}`);
    }

    private async performUpdate(
        key: string,
        fileInfo: LocalFileInfo,
        notePath: string,
        fileCheck: any,
        forceUpdate: boolean,
    ) {
        // Local note update logic
        // For now, we only update if forced, or if we want to sync metadata.
        // NoteService checks version. Local files don't have version yet.
        // We can check if `file-path` in frontmatter matches `fileInfo.path`.

        const currentFilePath = fileCheck.frontmatter?.["file-path"];
        // If file path changed (e.g. user moved the PDF), we might want to update the note to point to new location?
        // This is a "Migrate" scenario.

        if (
            forceUpdate ||
            (currentFilePath && currentFilePath !== fileInfo.path)
        ) {
            const content = await this.templateService.renderLocalNote(
                key,
                fileInfo.filename,
                fileInfo.path,
            );
            await this.parentHost.writeTextFile(notePath, content);
            console.log(`[LocalNoteService] Updated note: ${notePath}`);
        }
    }

    /**
     * Calculate MD5 from file slices (Head, Mid, Tail)
     */
    private calculateMD5(slices: ArrayBuffer[]): string {
        const spark = new SparkMD5.ArrayBuffer();
        for (const slice of slices) {
            spark.append(slice);
        }
        return spark.end();
    }
}
