import { Liquid } from "liquidjs";
import type { TFileWithoutParentAndVault } from "types/zotflow";
import type { ZotFlowSettings } from "settings/types";
import type { AnnotationJSON } from "types/zotero-reader";
import type { IParentProxy } from "bridge/types";

export const DEFAULT_LOCAL_NOTE_TEMPLATE = `---
zotflow-locked: true
zotflow-local-attachment: [[{{ path }}]]
---
# {{ item.basename }}
{%- if item.annotations.length > 0 -%}
## Annotations
{%- for annotation in item.annotations -%}
%% ZOTFLOW_ANNO_{{ annotation.key }}_BEG {{ annotation.raw | process_raw_anno_json }} %%
> [!zotflow-{{ annotation.type }}-{{ annotation.color }}] [[{{item.path}}#page={{ annotation.pageLabel }}#annotation={{ annotation.key | process_nav_info }}|{{ item.name }}, p.{{ annotation.pageLabel }}]]
{%- if annotation.type == "ink" or annotation.type == "image"-%}
> > ![[{{settings.annotationImageFolder}}/{{ annotation.key }}.png]]
{%- else -%}
> > {{ annotation.text | replace: newline, quote_string_2 }}
{%- endif -%}
{%- if annotation.comment != "" -%}
>
> {{ annotation.comment | replace: newline, quote_string }}
{%- endif -%}
^{{ annotation.key }}

%% ZOTFLOW_ANNO_{{ annotation.key }}_END %%

{%- endfor -%}
{%- endif -%}
`;

export class LocalTemplateService {
    private engine: Liquid;

    constructor(
        private settings: ZotFlowSettings,
        private parentHost: IParentProxy,
    ) {
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
        this.engine.registerFilter("process_nav_info", (input: string) => {
            const navInfo = {
                annotationID: input,
            };
            return encodeURIComponent(JSON.stringify(navInfo));
        });
        this.engine.registerFilter("process_raw_anno_json", (input: string) => {
            const anno = JSON.parse(input);
            anno.image = "";
            return encodeURIComponent(JSON.stringify(anno));
        });
    }

    updateSettings(newSettings: ZotFlowSettings) {
        this.settings = newSettings;
    }

    async renderLocalNote(
        localAttachment: TFileWithoutParentAndVault,
        annotations: AnnotationJSON[],
        templateContent: string | null,
        originalFrontmatter: Record<string, any> = {},
    ): Promise<string> {
        const context = await this.prepareLocalAttachmentContext(
            localAttachment,
            annotations,
        );

        try {
            const template = templateContent || DEFAULT_LOCAL_NOTE_TEMPLATE;

            // Separate Frontmatter and Body
            const frontmatterRegex = /^---\s*([\s\S]*?)\s*---\n/;
            const match = template.match(frontmatterRegex);

            let templateFrontmatterRaw = "";
            let body = template;

            if (match) {
                templateFrontmatterRaw = match[1] || "";
                body = template.substring(match[0].length);
            } else {
                body = template;
            }

            // Parse Template Frontmatter
            let templateFrontmatter: any = {};
            if (templateFrontmatterRaw.trim()) {
                try {
                    // Render the frontmatter raw string first (as it may contain liquid tags)
                    const renderedFrontmatterRaw =
                        await this.engine.parseAndRender(
                            templateFrontmatterRaw,
                            context,
                        );

                    // Then parse the rendered string as YAML
                    templateFrontmatter = await this.parentHost.parseYaml(
                        renderedFrontmatterRaw,
                    );
                } catch (e) {
                    console.error("Failed to parse template frontmatter", e);
                }
            }

            // Merge Frontmatter (Original + Rendered Template)
            // Merge = Original + Template. Template keys overwrite Original keys.
            const finalFrontmatter = {
                ...originalFrontmatter,
                ...templateFrontmatter,
            };

            // Ensure Mandatory Fields
            finalFrontmatter["zotflow-locked"] = true;
            finalFrontmatter["zotflow-local-attachment"] =
                `[[${localAttachment.path}]]`;

            // Stringify Frontmatter
            const frontmatterString =
                await this.parentHost.stringifyYaml(finalFrontmatter);

            // Render Body
            const renderedBody = await this.engine.parseAndRender(
                body,
                context,
            );
            return `---\n${frontmatterString}---\n${renderedBody}`;
        } catch (err) {
            console.error("ZotFlow: Template rendering error", err);
            throw err;
        }
    }

    private sanitizeQuotesString(str: string | null | undefined): string {
        if (!str) return "";
        // Escape >, < into \>, \<
        return str.replace(/>/g, "\\>").replace(/</g, "\\<");
    }

    public async prepareLocalAttachmentContext(
        localAttachment: TFileWithoutParentAndVault,
        annotations: AnnotationJSON[],
    ): Promise<any> {
        const processedAnnotations = annotations.map((annotation) => {
            return {
                key: annotation.id,
                libraryID: 0,
                type: annotation.type,
                authorName: annotation.authorName,
                text: this.sanitizeQuotesString(annotation.text),
                comment: annotation.comment,
                color: annotation.color,
                pageLabel: annotation.pageLabel,
                tags:
                    annotation.tags.map((tag: any) => {
                        return {
                            tag: tag.tag,
                            type: tag.type,
                        };
                    }) || [],
                dateCreated: annotation.dateCreated,
                dateModified: annotation.dateModified,
                raw: JSON.stringify(annotation),
            };
        });
        const item = {
            name: localAttachment.name,
            path: localAttachment.path,
            extension: localAttachment.extension,
            basename: localAttachment.basename,
            annotations: processedAnnotations,
        };

        return {
            item,
            settings: {
                ...this.settings,
                annotationImageFolder:
                    this.settings.annotationImageFolder.replace(/\/$/, ""),
            },
        };
    }
}
