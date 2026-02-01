import type { IParentProxy } from "bridge/types";
import type { ZotFlowSettings } from "settings/types";
import type { LocalTemplateService } from "./local-template";
import type { UpdateOptions } from "./note";
import type { AnnotationJSON } from "types/zotero-reader"; // Assuming this type exists or needs import
import type { TFileWithoutParentAndVault } from "types/zotflow";

export class LocalNoteService {
    private settings: ZotFlowSettings;
    private parentHost: IParentProxy;
    private templateService: LocalTemplateService;
    private debouncers: Map<string, NodeJS.Timeout> = new Map();

    private readonly OZRP_REGEX =
        /%% OZRP-ANNO-BEGIN\s*({[\s\S]*?})\s*%%[\s\S]*?%% OZRP-ANNO-END %%/g;

    private readonly ZOTFLOW_REGEX =
        /%% ZOTFLOW_ANNO_(\w+)_BEG\s*([\s\S]*?)\s*%%[\s\S]*?%% ZOTFLOW_ANNO_\1_END %%/g;

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
    async openNote(localAttachment: TFileWithoutParentAndVault) {
        const result =
            await this.parentHost.getLinkedSourceNote(localAttachment);

        if (result) {
            console.log(`[ZotFlow] Opening note: ${result.path}`);
            await this.parentHost.openFile(result.path, true);
        } else {
            const path = await this.performCreate(localAttachment, []);
            await this.parentHost.openFile(path, true);
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
        if (!debounce) {
            return await this.ensureNote(localAttachment, annotations);
        }

        const debounceId = localAttachment.path;
        if (this.debouncers.has(debounceId)) {
            clearTimeout(this.debouncers.get(debounceId));
            this.debouncers.delete(debounceId);
        }

        const timer = setTimeout(async () => {
            this.debouncers.delete(debounceId);
            try {
                await this.ensureNote(localAttachment, annotations);
            } catch (e) {
                console.error(
                    `[ZotFlow] Debounced update failed for ${localAttachment.path}`,
                    e,
                );
            }
        }, 2000);
        this.debouncers.set(debounceId, timer);
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
        try {
            let notePath =
                await this.parentHost.getLinkedSourceNote(localAttachment);
            console.log(notePath);

            if (notePath) {
                const fileCheck = await this.parentHost.checkFile(
                    notePath.path,
                );
                console.log(fileCheck);

                // Case A: File exists -> Try update
                await this.performUpdate(
                    localAttachment,
                    annotations,
                    fileCheck,
                );
            } else {
                // Case B: File does not exist -> Create new file
                await this.performCreate(localAttachment, annotations);
            }
        } catch (e) {
            console.error(
                `[LocalNoteService] Failed to ensure note for ${localAttachment.path}`,
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
        localAttachment: TFileWithoutParentAndVault,
        annotations: AnnotationJSON[],
    ) {
        // Construct default path
        const localSourceNoteFolder = this.settings.localSourceNoteFolder;
        // Ensure we don't have double slashes
        const folder = localSourceNoteFolder.replace(/\/$/, "");
        let notePath = `${folder}/@${localAttachment.basename}.md`.replace(
            /\/\//g,
            "/",
        );

        console.log("notePath", notePath);

        // Check duplicate
        let fileCheck = await this.parentHost.checkFile(notePath);
        if (fileCheck.exists) {
            // If we have a duplicate, but the file is not linked to the current local attachment,
            // we create a file with a different name
            let counter = 1;
            while (fileCheck.exists) {
                notePath =
                    `${folder}/@${localAttachment.basename} (${counter}).md`.replace(
                        /\/\//g,
                        "/",
                    );
                fileCheck = await this.parentHost.checkFile(notePath);
                counter++;
            }
        }

        const templateContent = await this.parentHost.readTextFile(
            this.settings.localSourceNoteTemplatePath,
        );
        const content = await this.templateService.renderLocalNote(
            localAttachment,
            annotations,
            templateContent,
            {},
        );

        console.log("content", content);
        await this.parentHost.writeTextFile(notePath, content);

        console.log(`[LocalNoteService] Created note: ${notePath}`);
        return notePath;
    }

    private async performUpdate(
        localAttachment: TFileWithoutParentAndVault,
        annotations: AnnotationJSON[],
        fileCheck: any,
    ) {
        const templateContent = await this.parentHost.readTextFile(
            this.settings.localSourceNoteTemplatePath,
        );

        console.log(annotations);
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

        const notePath =
            await this.parentHost.getLinkedSourceNote(localAttachment);
        if (!notePath) return annotations;

        const note = await this.parentHost.readTextFile(notePath.path);
        if (!note) return annotations;

        // Reset regex indices
        this.OZRP_REGEX.lastIndex = 0;
        this.ZOTFLOW_REGEX.lastIndex = 0;

        // Parse OZRP format
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
                    // Remove "> > " or "> " prefixes
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
                    // Remove "> " prefixes
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

        console.log("Start parsing ZotFlow annotations");
        // Parse ZotFlow format
        while ((match = this.ZOTFLOW_REGEX.exec(note)) !== null) {
            try {
                const jsonStr = match[2]!; // Group 2 is JSON
                const decodedJsonStr = decodeURIComponent(jsonStr);
                const ann = JSON.parse(decodedJsonStr);
                annotations.push(ann);
            } catch (e) {
                console.warn(
                    "[LocalNoteService] Failed to parse ZotFlow annotation",
                    e,
                );
            }
        }

        console.log("ZotFlow annotations:", annotations);

        return annotations;
    }

    async saveBase64Image(image: string, annotationKey: string) {
        const base64 = image.split(",")[1]!;
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const folder = this.settings.annotationImageFolder.replace(/\/$/, "");
        const path = `${folder}/${annotationKey}.png`;

        await this.parentHost.writeBinaryFile(path, bytes.buffer);
    }

    async deleteAnnotationImage(annotationKey: string) {
        // Calculate image path
        const filename = `${annotationKey}.png`;
        const folder = this.settings.annotationImageFolder.replace(/\/$/, "");
        const path = `${folder}/${filename}`;

        // Call main thread to delete file
        try {
            const exists = await this.parentHost.checkFile(path);
            if (exists.exists) {
                await this.parentHost.deleteFile(path);
                console.log(`[ZotFlow] Deleted orphaned image: ${path}`);
            }
        } catch (e) {
            console.warn(
                `[ZotFlow] Failed to delete image for ${annotationKey}:`,
                e,
            );
        }
    }
}
