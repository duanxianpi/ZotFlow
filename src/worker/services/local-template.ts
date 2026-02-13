import { Liquid } from "liquidjs";
import type { TFileWithoutParentAndVault } from "types/zotflow";
import type { ZotFlowSettings } from "settings/types";
import type { AnnotationJSON } from "types/zotero-reader";
import type { IParentProxy } from "bridge/types";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";

export const DEFAULT_LOCAL_NOTE_TEMPLATE = `---
zotflow-locked: true
zotflow-local-attachment: [[{{ path }}]]
---
{%- capture quote_string %}{{ newline }}> {% endcapture -%}
{%- capture quote_string_2 %}{{ newline }}> >{% endcapture -%}
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
            try {
                const anno =
                    typeof input === "string" ? JSON.parse(input) : input;
                if (anno.image) anno.image = "";
                return encodeURIComponent(JSON.stringify(anno));
            } catch (e) {
                return "";
            }
        });
    }

    updateSettings(newSettings: ZotFlowSettings) {
        this.settings = newSettings;
    }

    /**
     * Render the local note content using LiquidJS
     */
    async renderLocalNote(
        localAttachment: TFileWithoutParentAndVault,
        annotations: AnnotationJSON[],
        templateContent: string | null,
        originalFrontmatter: Record<string, any> = {},
    ): Promise<string> {
        try {
            const context = await this.prepareLocalAttachmentContext(
                localAttachment,
                annotations,
            );

            const template = templateContent || DEFAULT_LOCAL_NOTE_TEMPLATE;

            // Separate Frontmatter and Body
            const frontmatterRegex = /^---\s*([\s\S]*?)\s*---\n/;
            const match = template.match(frontmatterRegex);

            let templateFrontmatterRaw = "";
            let body = template;

            if (match) {
                templateFrontmatterRaw = match[1] || "";
                body = template.substring(match[0].length);
            }

            // Parse Template Frontmatter
            let templateFrontmatter: any = {};
            if (templateFrontmatterRaw.trim()) {
                try {
                    // Render the frontmatter raw string first (allow liquid tags in frontmatter)
                    const renderedFrontmatterRaw =
                        await this.engine.parseAndRender(
                            templateFrontmatterRaw,
                            context,
                        );

                    // Then parse the rendered string as YAML via Main Thread
                    templateFrontmatter = await this.parentHost.parseYaml(
                        renderedFrontmatterRaw,
                    );
                } catch (e) {
                    this.parentHost.log(
                        "error",
                        "Failed to parse template frontmatter",
                        "LocalTemplateService",
                        e,
                    );
                    // Continue execution, just without template frontmatter
                }
            }

            // Merge Frontmatter (Original + Rendered Template)
            // Template keys overwrite Original keys
            const finalFrontmatter = {
                ...originalFrontmatter,
                ...templateFrontmatter,
            };

            // Ensure Mandatory Fields
            finalFrontmatter["zotflow-locked"] = true;
            finalFrontmatter["zotflow-local-attachment"] =
                `[[${localAttachment.path}]]`;

            // Stringify Frontmatter via Main Thread
            const frontmatterString =
                await this.parentHost.stringifyYaml(finalFrontmatter);

            // Render Body
            const renderedBody = await this.engine.parseAndRender(
                body,
                context,
            );

            return `---\n${frontmatterString}---\n${renderedBody}`;
        } catch (err) {
            throw ZotFlowError.wrap(
                err,
                ZotFlowErrorCode.PARSE_ERROR,
                "LocalTemplateService",
                `Failed to render note template: ${(err as Error).message}`,
            );
        }
    }

    private sanitizeQuotesString(str: string | null | undefined): string {
        if (!str) return "";
        // Escape > into \> to prevent breaking blockquotes structure in Markdown
        return str.replace(/>/g, "\\>");
    }

    public async prepareLocalAttachmentContext(
        localAttachment: TFileWithoutParentAndVault,
        annotations: AnnotationJSON[],
    ): Promise<any> {
        const processedAnnotations = annotations.map((annotation) => {
            return {
                key: annotation.id,
                libraryID: 0, // Local files imply simplified library context
                type: annotation.type,
                authorName: annotation.authorName,
                text: this.sanitizeQuotesString(annotation.text),
                comment: annotation.comment,
                color: annotation.color,
                pageLabel: annotation.pageLabel,
                tags:
                    annotation.tags?.map((tag: any) => ({
                        tag: tag.tag,
                        type: tag.type,
                    })) || [],
                dateCreated: annotation.dateCreated,
                dateModified: annotation.dateModified,
                // Provide raw object for filter usage, ensuring it's an object, not string
                raw: annotation,
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
