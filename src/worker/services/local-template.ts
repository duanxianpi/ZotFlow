import { Liquid } from "liquidjs";
import type { ZotFlowSettings } from "settings/types";

export const DEFAULT_LOCAL_NOTE_TEMPLATE = `---
zotflow-locked: true
zotero-key: {{ key }}
file-path: "[[{{ filePath }}]]"
---
s
# {{ title }}

`;

export class LocalTemplateService {
    private settings: ZotFlowSettings;
    private engine: Liquid;

    constructor(settings: ZotFlowSettings) {
        this.settings = settings;
        this.initialize();
    }

    initialize() {
        this.engine = new Liquid({
            extname: ".md",
            greedy: false,
            globals: {
                newline: "\n",
            },
        });
    }

    updateSettings(newSettings: ZotFlowSettings) {
        this.settings = newSettings;
    }

    async renderLocalNote(
        key: string,
        filename: string,
        filePath: string,
    ): Promise<string> {
        const context = {
            key,
            title: filename,
            filePath,
            settings: this.settings,
        };

        try {
            const template = DEFAULT_LOCAL_NOTE_TEMPLATE;
            const res = await this.engine.parseAndRender(template, context);
            return res as string;
        } catch (err) {
            console.error("ZotFlow: Local Template rendering error", err);
            throw err;
        }
    }
}
