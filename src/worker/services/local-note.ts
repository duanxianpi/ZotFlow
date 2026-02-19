import type { IParentProxy } from "bridge/types";
import type { ZotFlowSettings } from "settings/types";
import type { LocalTemplateService } from "./local-template";
import type { AnnotationJSON } from "types/zotero-reader";
import type { TFileWithoutParentAndVault } from "types/zotflow";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";

export class LocalNoteService {
    private debouncers: Map<string, ReturnType<typeof setTimeout>> = new Map();

    // Regex for parsing legacy OZRP annotations
    private readonly OZRP_REGEX =
        /%% OZRP-ANNO-BEGIN\s*({[\s\S]*?})\s*%%[\s\S]*?%% OZRP-ANNO-END %%/g;

    // Regex for parsing ZotFlow annotations
    private readonly ZOTFLOW_REGEX =
        /%% ZOTFLOW_ANNO_(\w+)_BEG\s*([\s\S]*?)\s*%%[\s\S]*?%% ZOTFLOW_ANNO_\1_END %%/g;

    constructor(
        private settings: ZotFlowSettings,
        private parentHost: IParentProxy,
        private templateService: LocalTemplateService,
    ) {}

    public updateSettings(settings: ZotFlowSettings) {
        this.settings = settings;
        this.templateService.updateSettings(settings);
    }

    /**
     * Clear all pending debounced operations.
     */
    public dispose() {
        for (const timer of this.debouncers.values()) {
            clearTimeout(timer);
        }
        this.debouncers.clear();
    }

    /**
     * ============================================================
     * Public API
     * ============================================================
     */

    /**
     * Open note (core entry point)
     * Automatically find or create note -> Open file in Obsidian
     */
    async openNote(localAttachment: TFileWithoutParentAndVault) {
        try {
            const result =
                await this.parentHost.getLinkedSourceNote(localAttachment);

            if (result) {
                this.parentHost.log(
                    "info",
                    `Opening existing note: ${result.path}`,
                    "LocalNoteService",
                );
                await this.parentHost.openFile(result.path, true);
            } else {
                this.parentHost.log(
                    "info",
                    `Note not found, creating new for: ${localAttachment.basename}`,
                    "LocalNoteService",
                );
                const path = await this.performCreate(localAttachment, []);
                await this.parentHost.openFile(path, true);
            }
        } catch (e) {
            throw ZotFlowError.wrap(
                e,
                ZotFlowErrorCode.FILE_OPEN_FAILED,
                "LocalNoteService",
                `Failed to open note: ${(e as Error).message}`,
            );
        }
    }

    /**
     * Trigger update (for background sync or manual refresh)
     * Support immediate execution or debounced execution
     */
    async triggerUpdate(
        localAttachment: TFileWithoutParentAndVault,
        annotations: AnnotationJSON[],
        debounce: boolean = false,
    ) {
        // Immediate execution
        if (!debounce) {
            try {
                return await this.ensureNote(localAttachment, annotations);
            } catch (e) {
                throw ZotFlowError.wrap(
                    e,
                    ZotFlowErrorCode.FILE_WRITE_FAILED,
                    "LocalNoteService",
                    `Immediate update failed: ${(e as Error).message}`,
                );
            }
        }

        // Debounced execution
        const debounceId = localAttachment.path;
        if (this.debouncers.has(debounceId)) {
            clearTimeout(this.debouncers.get(debounceId)!);
            this.debouncers.delete(debounceId);
        }

        const timer = setTimeout(async () => {
            this.debouncers.delete(debounceId);
            try {
                await this.ensureNote(localAttachment, annotations);
            } catch (e) {
                this.parentHost.log(
                    "error",
                    "Debounced update failed: " + (e as Error).message,
                    "LocalNoteService",
                    e,
                );
            }
        }, 2000);

        this.debouncers.set(debounceId, timer);
    }

    /**
     * Save annotation image asset
     */
    async saveBase64Image(image: string, annotationKey: string) {
        try {
            const base64 = image.split(",")[1]!;
            const binaryString = atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const folder = this.settings.annotationImageFolder.replace(
                /\/$/,
                "",
            );
            const path = `${folder}/${annotationKey}.png`;

            await this.parentHost.writeBinaryFile(path, bytes.buffer);
        } catch (e) {
            throw ZotFlowError.wrap(
                e,
                ZotFlowErrorCode.FILE_WRITE_FAILED,
                "LocalNoteService",
                `Failed to save image ${annotationKey}: ${(e as Error).message}`,
            );
        }
    }

    /**
     * Clean up orphaned annotation images
     */
    async deleteAnnotationImage(annotationKey: string) {
        try {
            const filename = `${annotationKey}.png`;
            const folder = this.settings.annotationImageFolder.replace(
                /\/$/,
                "",
            );
            const path = `${folder}/${filename}`;

            const exists = await this.parentHost.checkFile(path);
            if (exists.exists) {
                await this.parentHost.deleteFile(path);
                console.log(`[ZotFlow] Deleted orphaned image: ${path}`);
            }
        } catch (e: any) {
            throw ZotFlowError.wrap(
                e,
                ZotFlowErrorCode.FILE_WRITE_FAILED,
                "LocalNoteService",
                `Failed to delete image ${annotationKey}: ${e.message}`,
            );
        }
    }

    /**
     * ============================================================
     * Core Logic (Flow Control)
     * ============================================================
     */

    /**
     * Core logic: Ensure note is ready
     * Responsible for routing logic: Index lookup -> Default path fallback -> Existence check -> Create/Update
     */
    private async ensureNote(
        localAttachment: TFileWithoutParentAndVault,
        annotations: AnnotationJSON[],
    ) {
        const notePath =
            await this.parentHost.getLinkedSourceNote(localAttachment);

        if (notePath) {
            const fileCheck = await this.parentHost.checkFile(notePath.path);

            // Case A: File exists -> Update
            await this.performUpdate(localAttachment, annotations, fileCheck);
        } else {
            // Case B: Linked but missing file -> Re-create or warn?
            // Currently treating as "Create new" logic would be complex due to linking.
            // For now, let's treat it as a broken link and create new at default location.
            this.parentHost.log(
                "info",
                `Linked note for ${localAttachment.basename} missing. Creating new.`,
                "LocalNoteService",
            );
            await this.performCreate(localAttachment, annotations);
        }
    }

    /**
     * ============================================================
     * Execution Helpers
     * ============================================================
     */

    private async performCreate(
        localAttachment: TFileWithoutParentAndVault,
        annotations: AnnotationJSON[],
    ): Promise<string> {
        // Construct default path
        const localSourceNoteFolder = this.settings.localSourceNoteFolder;
        const folder = localSourceNoteFolder.replace(/\/$/, "");

        // Base filename
        let baseName = `@${localAttachment.basename}`;
        let notePath = `${folder}/${baseName}.md`.replace(/\/\//g, "/");

        // Check duplicate and resolve naming collision
        let fileCheck = await this.parentHost.checkFile(notePath);
        let counter = 1;
        const maxRetries = 100; // Safety break

        while (fileCheck.exists && counter < maxRetries) {
            notePath = `${folder}/${baseName} (${counter}).md`.replace(
                /\/\//g,
                "/",
            );
            fileCheck = await this.parentHost.checkFile(notePath);
            counter++;
        }

        if (counter >= maxRetries) {
            throw new ZotFlowError(
                ZotFlowErrorCode.FILE_WRITE_FAILED,
                "LocalNoteService",
                `Failed to find unique filename for ${baseName} after ${maxRetries} attempts.`,
            );
        }

        // Render and Write
        const templateContent = await this.parentHost.readTextFile(
            this.settings.localSourceNoteTemplatePath,
        );

        const content = await this.templateService.renderLocalNote(
            localAttachment,
            annotations,
            templateContent,
            {},
        );

        await this.parentHost.writeTextFile(notePath, content);
        this.parentHost.log(
            "info",
            `Created note: ${notePath}`,
            "LocalNoteService",
        );

        return notePath;
    }

    private async performUpdate(
        localAttachment: TFileWithoutParentAndVault,
        annotations: AnnotationJSON[],
        fileCheck: any, // Ideally typed as { exists: boolean, path: string, frontmatter: any }
    ) {
        const templateContent = await this.parentHost.readTextFile(
            this.settings.localSourceNoteTemplatePath,
        );
        const content = await this.templateService.renderLocalNote(
            localAttachment,
            annotations,
            templateContent,
            fileCheck.frontmatter || {},
        );

        await this.parentHost.writeTextFile(fileCheck.path, content);
        console.log(`[LocalNoteService] Updated note: ${fileCheck.path}`);
    }

    /**
     * Parse annotations from local source note content
     * Supports both OZRP and ZOTFLOW formats
     */
    async parseLocalAnnotations(
        localAttachment: TFileWithoutParentAndVault,
    ): Promise<AnnotationJSON[]> {
        const annotations: AnnotationJSON[] = [];

        try {
            const notePath =
                await this.parentHost.getLinkedSourceNote(localAttachment);
            if (!notePath) return annotations;

            const note = await this.parentHost.readTextFile(notePath.path);
            if (!note) return annotations;

            // Reset regex indices
            this.OZRP_REGEX.lastIndex = 0;
            this.ZOTFLOW_REGEX.lastIndex = 0;

            // Parse OZRP format (Legacy)
            let match;
            while ((match = this.OZRP_REGEX.exec(note)) !== null) {
                try {
                    const fullBlock = match[0];
                    const jsonStr = match[1]!;
                    const ann = JSON.parse(jsonStr);

                    // Extract Quote (Text)
                    const quoteMatch =
                        /%% OZRP-ANNO-QUOTE-BEGIN %%([\s\S]*?)[>\s]*%% OZRP-ANNO-QUOTE-END %%/.exec(
                            fullBlock,
                        );
                    if (quoteMatch && quoteMatch[1]) {
                        const rawQuote = quoteMatch[1];
                        ann.text = rawQuote
                            .split("\n")
                            .map((line) => line.replace(/^>\s*> ?/, "").trim())
                            .filter((l) => l !== "")
                            .join("\n");
                    }

                    // Extract Comment
                    const commMatch =
                        /%% OZRP-ANNO-COMM-BEGIN %%([\s\S]*?)%% OZRP-ANNO-COMM-END %%/.exec(
                            fullBlock,
                        );
                    if (commMatch && commMatch[1]) {
                        const rawComm = commMatch[1];
                        ann.comment = rawComm
                            .split("\n")
                            .map((line) => line.replace(/^> ?/, "").trim())
                            .filter((l) => l !== "")
                            .join("\n");
                    }

                    annotations.push(ann);
                } catch (e) {
                    console.warn(
                        "[LocalNoteService] Failed to parse OZRP annotation",
                        e,
                    );
                }
            }

            // Parse ZotFlow format (New)
            while ((match = this.ZOTFLOW_REGEX.exec(note)) !== null) {
                try {
                    const jsonStr = match[2]!; // Group 2 is JSON
                    const decodedJsonStr = decodeURIComponent(jsonStr);
                    const ann = JSON.parse(decodedJsonStr);
                    annotations.push(ann);
                } catch (e) {
                    this.parentHost.log(
                        "warn",
                        "Failed to parse ZotFlow annotation",
                        "LocalNoteService",
                        e,
                    );
                }
            }
        } catch (e) {
            this.parentHost.log(
                "error",
                "Error parsing annotations",
                "LocalNoteService",
                e,
            );
        }

        return annotations;
    }
}
