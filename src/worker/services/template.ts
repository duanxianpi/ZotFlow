import { Liquid } from "liquidjs";
import type { AnyIDBZoteroItem, IDBZoteroItem } from "types/db-schema";
import { db, getCombinations } from "db/db";
import type {
    ItemTemplateContext,
    NoteTemplateContext,
    AnnotationTemplateContext,
    AttachmentTemplateContext,
} from "types/template-context";
import type {
    AnnotationData,
    AttachmentData,
    NoteData,
} from "types/zotero-item";
import type { ZotFlowSettings } from "settings/types";

const DEFAULT_ITEM_TEMPLATE = `---
citationKey: {{ item.citationKey }}
title: {{ item.title | json }}
itemType: {{ item.itemType }}
creators: [{% for c in item.creators %}"{{ c.name }}"{% unless forloop.last %}, {% endunless %}{% endfor %}]
publication: "{{ item.publicationTitle | default: item.publisher }}"
date: {{ item.date }}
year: {{ item.date | slice: 0, 4 }}
url: {{ item.url }}
doi: {{ item.DOI }}
---
# {{ item.title }}
{% if item.abstractNote %}
## Abstract
> {{ item.abstractNote }}
{% endif %}

{% if item.attachments.length > 0 -%}
## Attachments
{% for attachment in item.attachments -%}
- [{{ attachment.filename }}](obsidian://zotflow?type=open-attachment&libraryID={{ attachment.libraryID }}&key={{ attachment.key }})
{% endfor %}
{% endif -%}

{% if item.notes.length > 0 -%}
## Notes
{% for note in item.notes -%}
### {{ note.title | default: "Note" }}
{{ note.note }}
{% endfor %}
{% endif -%}

{%- capture newline %}
{% endcapture -%}
{%- capture quote_string %}{{ newline }}> {% endcapture -%}
{%- capture quote_string_2 %}{{ newline }}> >{% endcapture -%}

{% if item.attachments.length > 0 -%}
## Annotations
{% for attachment in item.attachments -%}
{% if attachment.annotations.length > 0 -%}
### {{ attachment.filename }}
{% for annotation in attachment.annotations %}
> [!zotflow-{{ annotation.type }}-{{ annotation.color }}] [{{ attachment.filename }}, p.{{ annotation.pageLabel }}](obsidian://zotflow?type=open-attachment&libraryID={{ attachment.libraryID }}&key={{ attachment.key }}&navigation={{ annotation.key | process_nav_info}})
{% if annotation.type == "ink" or annotation.type == "image"-%}
> > ![[{{settings.annotationImageFolder}}/{{ annotation.key }}.png]]
{%- else -%}
> > {{ annotation.text | replace: newline, quote_string_2 }}
{%- endif %}
{% if annotation.comment != "" -%}
>
> {{ annotation.comment | replace: newline, quote_string }}
{% endif %}^{{ annotation.key }}
{% endfor %}
{% endif %}
{% endfor %}
{% endif %}
`;

export class TemplateService {
    private settings: ZotFlowSettings;
    private engine: Liquid;

    constructor(settings: ZotFlowSettings) {
        this.settings = settings;
        this.initialize();
    }

    initialize() {
        this.engine = new Liquid({
            extname: ".md",
        });
        this.engine.registerFilter("process_nav_info", (input: string) => {
            const navInfo = {
                annotationID: input,
            };
            return encodeURIComponent(JSON.stringify(navInfo));
        });
    }

    updateSettings(newSettings: ZotFlowSettings) {
        this.settings = newSettings;
    }

    async renderItem(
        item: AnyIDBZoteroItem,
        templateContent: string | null,
    ): Promise<string> {
        const context = await this.prepareItemContext(item);

        try {
            let template = templateContent || DEFAULT_ITEM_TEMPLATE;
            template = this.ensureMandatoryFrontmatter(template);

            const res = await this.engine.parseAndRender(template, context);
            return res as string;
        } catch (err) {
            console.error("ZotFlow: Template rendering error", err);
            // We cannot show Notice here directly, caller (NoteService) should handle error or use parentHost to notify
            throw err;
        }
    }

    private ensureMandatoryFrontmatter(template: string): string {
        const frontmatterRegex = /^---\s*([\s\S]*?)\s*---/;
        const match = template.match(frontmatterRegex);

        let frontmatterContent = "";
        let body = template;

        if (match) {
            frontmatterContent = match[1] || "";
            body = template.substring(match[0].length);
        } else {
            // If no frontmatter, just add empty one at start
            body = template;
        }

        const lines = frontmatterContent.split("\n");
        const newLines: string[] = [];

        // Mandatory keys map: key -> required complete line
        const mandatory = new Map([
            ["zotflow-locked", "zotflow-locked: true"],
            ["zotero-key", "zotero-key: {{ item.key }}"],
            ["item-version", "item-version: {{ item.version }}"],
        ]);

        const foundKeys = new Set<string>();

        // Process existing lines
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                // Preserve empty lines if needed, or just skip.
                // To behave like previous code which reconstructed, we can skip or add empty.
                // Let's add empty if it's not the very beginning/end to preserve spacing if desired,
                // but checking for "ensured" fields is priority.
                if (
                    newLines.length > 0 &&
                    newLines[newLines.length - 1] !== ""
                ) {
                    newLines.push("");
                }
                continue;
            }

            const colonIndex = trimmed.indexOf(":");
            if (colonIndex !== -1) {
                const key = trimmed.substring(0, colonIndex).trim();
                if (mandatory.has(key)) {
                    // Replace with mandatory value
                    newLines.push(mandatory.get(key)!);
                    foundKeys.add(key);
                } else {
                    newLines.push(line);
                }
            } else {
                newLines.push(line);
            }
        }

        // Prepend missing mandatory keys
        const missingLines: string[] = [];
        // Intentionally checking in reverse order of desired appearance if we were unshifting,
        // but here we are pushing to missingLines which will be prepended.
        // Let's decide on an order: zotflow-locked, zotero-key, item-version.
        // We want them at the top.

        if (!foundKeys.has("item-version")) {
            missingLines.unshift(mandatory.get("item-version")!);
        }
        if (!foundKeys.has("zotero-key")) {
            missingLines.unshift(mandatory.get("zotero-key")!);
        }
        if (!foundKeys.has("zotflow-locked")) {
            missingLines.unshift(mandatory.get("zotflow-locked")!);
        }

        const finalFrontmatter = [...missingLines, ...newLines]
            .join("\n")
            .trim();

        // Construct final template
        // Ensure strictly one newline after frontmatter
        const cleanBody = body.startsWith("\n") ? body : `\n${body}`;
        return `---
${finalFrontmatter}
---${cleanBody}`;
    }

    private sanitizeQuotesString(str: string): string {
        // Escape >, < into \>, \<
        return str.replace(/>/g, "\\>").replace(/</g, "\\<");
    }

    public async prepareItemContext(item: AnyIDBZoteroItem): Promise<any> {
        return {
            item: await this.mapToItemContext(item),
            settings: this.settings,
        };
    }

    public async mapToItemContext(
        item: AnyIDBZoteroItem,
    ): Promise<ItemTemplateContext> {
        const raw = item.raw || {};
        const data = raw.data || {};

        const children = await db.items
            .where(["libraryID", "parentItem", "itemType", "trashed"])
            .anyOf(
                getCombinations([
                    [item.libraryID],
                    [item.key],
                    ["note", "annotation", "attachment"],
                    [0],
                ]),
            )
            .toArray();

        const notes = await Promise.all(
            children
                .filter((c) => c.itemType === "note")
                .map((note) => this.mapToNoteContext(note)),
        );

        const attachments = await Promise.all(
            children
                .filter((c) => c.itemType === "attachment")
                .map((att) => this.mapToAttachmentContext(att)),
        );

        const annotations = attachments.map((att) => att.annotations).flat();

        let creatorsObj: { name: string }[] = [];
        if (raw.meta?.creatorsSummary) {
            if (typeof raw.meta.creatorsSummary === "string") {
                creatorsObj = [{ name: raw.meta.creatorsSummary }];
            }
        } else if ((data as any).creators) {
            creatorsObj = (data as any).creators.map((c: any) => ({
                name:
                    c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim(),
            }));
        }

        return {
            key: item.key,
            version: item.version,
            libraryID: item.libraryID,
            citationKey: item.citationKey || "",
            notes,
            annotations,
            attachments,
            itemType: item.itemType,
            title: item.title || "",
            creators: creatorsObj,
            date: (data as any).date || null,
            dateAdded: item.dateAdded,
            dateModified: item.dateModified,
            abstractNote: (data as any).abstractNote,
            publicationTitle: (data as any).publicationTitle,
            publisher: (data as any).publisher,
            place: (data as any).place,
            volume: (data as any).volume,
            issue: (data as any).issue,
            pages: (data as any).pages,
            series: (data as any).series,
            seriesNumber: (data as any).seriesNumber,
            edition: (data as any).edition,
            url: (data as any).url,
            DOI: (data as any).DOI,
            ISBN: (data as any).ISBN,
            ISSN: (data as any).ISSN,
            tags: (data as any).tags || [],
        };
    }

    public async mapToNoteContext(
        item: IDBZoteroItem<NoteData>,
    ): Promise<NoteTemplateContext> {
        const data = item.raw.data || {};
        return {
            key: item.key,
            libraryID: item.libraryID,
            title: item.title || "",
            note: data.note || "",
            tags: data.tags || [],
            dateAdded: item.dateAdded,
            dateModified: item.dateModified,
        };
    }

    public async mapToAnnotationContext(
        item: IDBZoteroItem<AnnotationData>,
    ): Promise<AnnotationTemplateContext> {
        const data = item.raw.data || {};
        return {
            key: item.key,
            libraryID: item.libraryID,
            type: data.annotationType,
            authorName: data.annotationAuthorName,
            text: this.sanitizeQuotesString(data.annotationText || ""),
            comment: this.sanitizeQuotesString(data.annotationComment),
            color: data.annotationColor,
            pageLabel: data.annotationPageLabel,
            tags: data.tags || [],
            dateAdded: item.dateAdded,
            dateModified: item.dateModified,
        };
    }

    public async mapToAttachmentContext(
        item: IDBZoteroItem<AttachmentData>,
    ): Promise<AttachmentTemplateContext> {
        const children = (
            await db.items
                .where(["libraryID", "parentItem", "itemType", "trashed"])
                .anyOf(
                    getCombinations([
                        [item.libraryID],
                        [item.key],
                        ["annotation"],
                        [0],
                    ]),
                )
                .toArray()
        ).filter(
            (i) => i.syncStatus !== "deleted",
        ) as IDBZoteroItem<AnnotationData>[];

        const annotations = await Promise.all(
            children.map((ann) => this.mapToAnnotationContext(ann)),
        );

        const data = item.raw.data || {};
        return {
            key: item.key,
            libraryID: item.libraryID,
            filename: data.filename || "",
            contentType: data.contentType || "",
            tags: data.tags || [],
            dateAdded: item.dateAdded,
            dateModified: item.dateModified,

            annotations,
        };
    }
}
