import { App, Notice, TFile } from "obsidian";
import { Liquid } from "liquidjs";
import { SettingsService } from "./setting-service";
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
zotflow-locked: true
zotero-key: {{ item.key }}
citationKey: {{ item.citationKey }}
title: "{{ item.title | replace: '"', '\"' }}"
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

{% if item.attachments.length > 0 -%}
## Annotations
{% for attachment in item.attachments -%}
{% if attachment.annotations.length > 0 -%}
### {{ attachment.filename }}
{% for annotation in attachment.annotations %}
> [!zotflow-{{ annotation.type }}-{{ annotation.color }}] [{{ attachment.filename }}, p.{{ annotation.pageLabel }}](obsidian://zotflow?type=open-attachment&libraryID={{ attachment.libraryID }}&key={{ attachment.key }}&navigation={{ annotation.key | process_nav_info}})
> > {{ annotation.text }}
{% if annotation.comment != "" -%}
>
> {{ annotation.comment }}
{% endif -%}^{{ annotation.key }}
{% endfor %}
{% endif %}
{% endfor %}
{% endif %}
`;

export class TemplateService {
    private app: App;
    private settings: ZotFlowSettings;
    private engine: Liquid;

    constructor(app: App, settings: ZotFlowSettings) {
        this.app = app;
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

    async renderItem(item: AnyIDBZoteroItem): Promise<string> {
        const context = await this.prepareItemContext(item);

        try {
            let template: string;

            const templateFile = this.app.vault.getAbstractFileByPath(
                this.settings.sourceNoteTemplatePath,
            );
            if (!templateFile || !(templateFile instanceof TFile)) {
                template = DEFAULT_ITEM_TEMPLATE;
            } else {
                template = await this.app.vault.read(templateFile);
            }

            // Make sure zotflow-locked: true is in the frontmatter
            const frontmatterRegex = /---\s*([\s\S]*?)\s*---/;
            const frontmatterMatch = template.match(frontmatterRegex);
            if (frontmatterMatch) {
                const frontmatter = frontmatterMatch[1]!;
                if (frontmatter.includes("zotflow-locked: false")) {
                    template = template.replace(
                        "zotflow-locked: false",
                        "zotflow-locked: true",
                    );
                } else if (!frontmatter.includes("zotflow-locked: true")) {
                    template = template.replace(
                        frontmatterRegex,
                        `---\nzotflow-locked: true\n${frontmatter}\n---`,
                    );
                }
            }

            const res = await this.engine.parseAndRender(template, context);
            return res as string;
        } catch (err) {
            console.error("ZotFlow: Template rendering error", err);
            new Notice("ZotFlow: Template rendering error. Check console.");
            throw err;
        }
    }

    private sanitizeString(str: string): string {
        // Escape >, < into \>, \<
        return str.replace(/>/g, "\\>").replace(/</g, "\\<");
    }

    public async prepareItemContext(item: AnyIDBZoteroItem): Promise<any> {
        return {
            item: await this.mapToItemContext(item),
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
            text: this.sanitizeString(data.annotationText || ""),
            comment: this.sanitizeString(data.annotationComment),
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
        const children = (await db.items
            .where(["libraryID", "parentItem", "itemType", "trashed"])
            .anyOf(
                getCombinations([
                    [item.libraryID],
                    [item.key],
                    ["annotation"],
                    [0],
                ]),
            )
            .toArray()) as IDBZoteroItem<AnnotationData>[];

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
