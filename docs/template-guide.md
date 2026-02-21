# ZotFlow — Template Guide

ZotFlow uses [LiquidJS](https://liquidjs.com) templates to render **source notes** — Obsidian markdown files generated from Zotero items or local attachments. This document covers both template types, all available variables, built-in filters, and the rendering pipeline.

---

## Table of Contents

- [Overview](#overview)
- [Settings](#settings)
- [Template Syntax](#template-syntax)
- [Zotero Source Note Template](#zotero-source-note-template)
    - [Context Variables](#zotero-context-variables)
    - [Default Template](#default-zotero-template)
- [Local Source Note Template](#local-source-note-template)
    - [Context Variables](#local-context-variables)
    - [Default Template](#default-local-template)
- [Custom Filters](#custom-filters)
- [Frontmatter Handling](#frontmatter-handling)
- [Tips & Examples](#tips--examples)

---

## Overview

There are **two independent template systems**:

| Template Type          | Service                | Renders notes for…                                  |
| ---------------------- | ---------------------- | --------------------------------------------------- |
| **Zotero Source Note** | `TemplateService`      | Items synced from Zotero (books, papers, etc.)      |
| **Local Source Note**  | `LocalTemplateService` | Local vault files opened in the Local Zotero Reader |

Both use the same LiquidJS engine, but expose different context variables. If no custom template file is configured, a built-in default template is used.

---

## Settings

Configure templates in **Settings → General**:

| Setting                           | Description                                                       | Example                                |
| --------------------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| **Template Path**                 | Vault-relative path to a Zotero source note template file         | `templates/SourceNoteTemplate.md`      |
| **Default Source Note Folder**    | Folder where Zotero source notes are created                      | `Source/ZotFlow`                       |
| **Local Source Note Template**    | Vault-relative path to a local source note template file          | `templates/LocalSourceNoteTemplate.md` |
| **Local Source Note Folder**      | Folder where local source notes are created                       | `Source/ZotFlow/Local`                 |
| **Auto Import Annotation Images** | Extract area/ink annotation images from PDFs during note creation | Toggle                                 |
| **Annotation Image Folder**       | Folder where extracted annotation images are saved                | `Attachments/ZotFlow`                  |

If **Template Path** or **Local Source Note Template** is left empty, the built-in default template is used.

---

## Template Syntax

Templates use [LiquidJS syntax](https://liquidjs.com/tutorials/intro-to-liquid.html):

- **Output tags:** `{{ variable }}` — insert a value
- **Logic tags:** `{% if condition %} ... {% endif %}` — conditional blocks
- **Loops:** `{% for item in array %} ... {% endfor %}` — iterate over arrays
- **Filters:** `{{ value | filter_name }}` — transform values (e.g., `| json`, `| default: "fallback"`)
- **Whitespace control:** `{%-` and `-%}` trim surrounding whitespace

### Global Variables

Available in both template types:

| Variable  | Type     | Description                                                                        |
| --------- | -------- | ---------------------------------------------------------------------------------- |
| `newline` | `string` | A literal newline character (`"\n"`). Useful for `replace` filters in blockquotes. |

---

## Zotero Source Note Template

Used when creating/updating source notes for **Zotero library items** (journal articles, books, conference papers, etc.).

### Zotero Context Variables

The template context is an object with two top-level keys: `item` and `settings`.

#### `item` — The Zotero Item

| Variable                     | Type                      | Description                                                           |
| ---------------------------- | ------------------------- | --------------------------------------------------------------------- |
| `item.key`                   | `string`                  | Zotero item key (e.g., `"ABC12345"`)                                  |
| `item.version`               | `number`                  | Zotero item version number                                            |
| `item.libraryID`             | `number`                  | Zotero library ID                                                     |
| `item.citationKey`           | `string`                  | Citation key (e.g., from Better BibTeX), empty string if unset        |
| `item.itemType`              | `string`                  | Zotero item type (e.g., `"journalArticle"`, `"book"`, `"attachment"`) |
| `item.title`                 | `string`                  | Item title                                                            |
| `item.creators`              | `Array<{ name: string }>` | List of creators with a combined `name` field                         |
| `item.date`                  | `string \| null`          | Publication date string (as entered in Zotero)                        |
| `item.dateAdded`             | `string`                  | ISO timestamp when item was added to Zotero                           |
| `item.dateModified`          | `string`                  | ISO timestamp when item was last modified                             |
| `item.abstractNote`          | `string \| undefined`     | Abstract text                                                         |
| `item.publicationTitle`      | `string \| undefined`     | Journal/conference name                                               |
| `item.publisher`             | `string \| undefined`     | Publisher name                                                        |
| `item.place`                 | `string \| undefined`     | Place of publication                                                  |
| `item.volume`                | `string \| undefined`     | Volume number                                                         |
| `item.issue`                 | `string \| undefined`     | Issue number                                                          |
| `item.pages`                 | `string \| undefined`     | Page range                                                            |
| `item.series`                | `string \| undefined`     | Series name                                                           |
| `item.seriesNumber`          | `string \| undefined`     | Series number                                                         |
| `item.edition`               | `string \| undefined`     | Edition                                                               |
| `item.url`                   | `string \| undefined`     | URL                                                                   |
| `item.DOI`                   | `string \| undefined`     | DOI                                                                   |
| `item.ISBN`                  | `string \| undefined`     | ISBN                                                                  |
| `item.ISSN`                  | `string \| undefined`     | ISSN                                                                  |
| `item.tags`                  | `Array<{ tag, type? }>`   | Tags attached to the item                                             |
| `item.attachments`           | `AttachmentContext[]`     | Child attachment items (PDFs, etc.) — see below                       |
| `item.annotations`           | `AnnotationContext[]`     | Direct child annotations (for standalone attachment items)            |
| `item.attachmentAnnotations` | `AnnotationContext[]`     | All annotations across all attachments (flattened)                    |
| `item.notes`                 | `NoteContext[]`           | Child Zotero notes — see below                                        |

#### `item.attachments[]` — Attachment Children

| Variable                  | Type                    | Description                           |
| ------------------------- | ----------------------- | ------------------------------------- |
| `attachment.key`          | `string`                | Attachment item key                   |
| `attachment.libraryID`    | `number`                | Library ID                            |
| `attachment.filename`     | `string`                | Filename (e.g., `"paper.pdf"`)        |
| `attachment.contentType`  | `string`                | MIME type (e.g., `"application/pdf"`) |
| `attachment.tags`         | `Array<{ tag, type? }>` | Tags                                  |
| `attachment.dateAdded`    | `string`                | ISO timestamp                         |
| `attachment.dateModified` | `string`                | ISO timestamp                         |
| `attachment.annotations`  | `AnnotationContext[]`   | Annotations on this attachment        |

#### `item.notes[]` — Note Children

| Variable            | Type                    | Description                      |
| ------------------- | ----------------------- | -------------------------------- |
| `note.key`          | `string`                | Note item key                    |
| `note.libraryID`    | `number`                | Library ID                       |
| `note.title`        | `string`                | Note title (first line or empty) |
| `note.note`         | `string`                | Full note HTML content           |
| `note.tags`         | `Array<{ tag, type? }>` | Tags                             |
| `note.dateAdded`    | `string`                | ISO timestamp                    |
| `note.dateModified` | `string`                | ISO timestamp                    |

#### `item.annotations[]` / `attachment.annotations[]` — Annotations

| Variable                  | Type                    | Description                                                  |
| ------------------------- | ----------------------- | ------------------------------------------------------------ |
| `annotation.key`          | `string`                | Annotation item key                                          |
| `annotation.libraryID`    | `number`                | Library ID                                                   |
| `annotation.type`         | `string`                | Annotation type: `"highlight"`, `"note"`, `"image"`, `"ink"` |
| `annotation.authorName`   | `string \| undefined`   | Author of the annotation                                     |
| `annotation.text`         | `string \| null`        | Highlighted text (for highlights; `>` and `<` are escaped)   |
| `annotation.comment`      | `string \| undefined`   | User comment on the annotation (`>` and `<` are escaped)     |
| `annotation.color`        | `string \| undefined`   | Hex color code (e.g., `"#ffd400"`)                           |
| `annotation.pageLabel`    | `string \| undefined`   | Page label where the annotation appears                      |
| `annotation.tags`         | `Array<{ tag, type? }>` | Tags                                                         |
| `annotation.dateCreated`  | `string`                | ISO timestamp                                                |
| `annotation.dateModified` | `string`                | ISO timestamp                                                |

#### `settings` — Plugin Settings

The entire `ZotFlowSettings` object is available under `settings`. Commonly used:

| Variable                         | Type     | Description                                               |
| -------------------------------- | -------- | --------------------------------------------------------- |
| `settings.annotationImageFolder` | `string` | Folder path for annotation images (trailing `/` stripped) |
| `settings.sourceNoteFolder`      | `string` | Default source note folder                                |

### Default Zotero Template

If no custom template is configured, the following built-in template is used:

```liquid
---
citationKey: {{ item.citationKey | json }}
title: {{ item.title | json }}
itemType: {{ item.itemType | json }}
creators: [{% for c in item.creators %}"{{ c.name }}"{% unless forloop.last %}, {% endunless %}{% endfor %}]
publication: {{ item.publicationTitle | default: item.publisher | json }}
date: {{ item.date | json }}
year: {{ item.date | slice: 0, 4 }}
url: {{ item.url | json }}
doi: {{ item.DOI | json }}
---
{%- capture quote_string %}{{ newline }}> {% endcapture -%}
{%- capture quote_string_2 %}{{ newline }}> >{% endcapture -%}
# {{ item.title }}
{%- if item.abstractNote -%}
## Abstract
> {{ item.abstractNote | replace: newline, quote_string }}

{%- endif -%}
{%- if item.attachments.length > 0 -%}
## Attachments
{%- for attachment in item.attachments -%}
- [{{ attachment.filename }}](obsidian://zotflow?type=open-attachment&libraryID={{ attachment.libraryID }}&key={{ attachment.key }})
{%- endfor -%}

{%- endif -%}
{%- if item.notes.length > 0 -%}
## Notes
{%- for note in item.notes -%}
### {{ note.title | default: "Note" }}
{{ note.note }}
{%- endfor -%}

{%- endif -%}
{%- if item.attachments.length > 0 and item.attachmentAnnotations.length > 0 -%}
## Annotations
{%- for attachment in item.attachments -%}
{%- if attachment.annotations.length > 0 -%}
### {{ attachment.filename }}
{%- for annotation in attachment.annotations -%}
> [!zotflow-{{ annotation.type }}-{{ annotation.color }}] [{{ attachment.filename }}, p.{{ annotation.pageLabel }}](obsidian://zotflow?type=open-attachment&libraryID={{ attachment.libraryID }}&key={{ attachment.key }}&navigation={{ annotation.key | process_nav_info}})
{%- if annotation.type == "ink" or annotation.type == "image"-%}
> > ![[{{settings.annotationImageFolder}}/{{ annotation.key }}.png]]
{%- else -%}
> > {{ annotation.text | replace: newline, quote_string_2 }}
{%- endif -%}
{%- if annotation.comment != "" -%}
>
> {{ annotation.comment | replace: newline, quote_string }}
{%- endif -%}^{{ annotation.key }}

{%- endfor -%}
{%- endif -%}
{%- endfor -%}
{%- endif -%}
```

---

## Local Source Note Template

Used when creating/updating source notes for **local vault files** (PDFs, EPUBs, HTMLs) opened in the Local Zotero Reader.

### Local Context Variables

The template context has three top-level keys: `item`, `settings`, and `path`.

#### `item` — The Local Attachment

| Variable           | Type                | Description                                        |
| ------------------ | ------------------- | -------------------------------------------------- |
| `item.name`        | `string`            | Full filename with extension (e.g., `"paper.pdf"`) |
| `item.path`        | `string`            | Vault-relative path (e.g., `"Articles/paper.pdf"`) |
| `item.extension`   | `string`            | File extension (e.g., `"pdf"`)                     |
| `item.basename`    | `string`            | Filename without extension (e.g., `"paper"`)       |
| `item.annotations` | `LocalAnnotation[]` | Annotations made in the local reader — see below   |

#### `item.annotations[]` — Local Annotations

| Variable                  | Type                    | Description                                                                  |
| ------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `annotation.key`          | `string`                | Annotation ID                                                                |
| `annotation.libraryID`    | `number`                | Always `0` for local files                                                   |
| `annotation.type`         | `string`                | Annotation type: `"highlight"`, `"note"`, `"image"`, `"ink"`                 |
| `annotation.authorName`   | `string \| undefined`   | Author name                                                                  |
| `annotation.text`         | `string \| null`        | Highlighted text (`>` is escaped)                                            |
| `annotation.comment`      | `string \| undefined`   | User comment                                                                 |
| `annotation.color`        | `string \| undefined`   | Hex color code                                                               |
| `annotation.pageLabel`    | `string \| undefined`   | Page label                                                                   |
| `annotation.tags`         | `Array<{ tag, type? }>` | Tags                                                                         |
| `annotation.dateCreated`  | `string \| undefined`   | ISO timestamp                                                                |
| `annotation.dateModified` | `string \| undefined`   | ISO timestamp                                                                |
| `annotation.raw`          | `AnnotationJSON`        | Raw annotation object (for advanced use with `process_raw_anno_json` filter) |

#### `path` — Top-Level Variable

| Variable | Type     | Description                                    |
| -------- | -------- | ---------------------------------------------- |
| `path`   | `string` | Same as `item.path` — vault-relative file path |

#### `settings` — Plugin Settings

Same as the Zotero template. `settings.annotationImageFolder` is the most commonly used.

### Default Local Template

```liquid
---
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
```

> **Important:** The `%% ZOTFLOW_ANNO_..._BEG %%` and `%% ZOTFLOW_ANNO_..._END %%` comment markers are **mandatory** in local source note templates. They are used internally by the local annotation system to track and round-trip annotation data — the raw annotation JSON is encoded inside the `_BEG` marker so annotations can be reconstructed when the note is re-read. If you omit these markers in a custom local template, ZotFlow will not be able to parse annotations back from the note, and annotation syncing between the reader and the note will break.

---

## Custom Filters

In addition to all [built-in LiquidJS filters](https://liquidjs.com/filters/overview.html), ZotFlow registers these custom filters:

### `process_nav_info`

Available in: **Both** template types

Converts an annotation key string into a URL-encoded JSON navigation parameter. Used to construct `obsidian://zotflow` deep links.

```liquid
{{ annotation.key | process_nav_info }}
```

**Input:** `"ABC12345"` (annotation key)
**Output:** `%7B%22annotationID%22%3A%22ABC12345%22%7D` (URL-encoded `{"annotationID":"ABC12345"}`)

### `process_raw_anno_json`

Available in: **Local** template only

Encodes the raw annotation JSON object into a URL-encoded string (with image data stripped for compactness). Used inside the `%% ZOTFLOW_ANNO_..._BEG %%` comment markers.

```liquid
{{ annotation.raw | process_raw_anno_json }}
```

---

## Frontmatter Handling

Both template types process frontmatter through a specific pipeline:

### Rendering Pipeline

1. **Parse template** — extract the frontmatter block (between `---` delimiters) and the body separately.
2. **Render frontmatter** — the frontmatter section is processed through LiquidJS first (so you can use `{{ item.title }}` etc. in your frontmatter).
3. **Parse YAML** — the rendered frontmatter string is parsed as YAML.
4. **Merge** — the parsed template frontmatter is merged with any **existing frontmatter** from the file (during updates). Template keys **overwrite** existing keys.
5. **Inject mandatory fields** — ZotFlow adds required fields automatically:
    - **Zotero notes:** `zotflow-locked: true`, `zotero-key`, `item-version`
    - **Local notes:** `zotflow-locked: true`, `zotflow-local-attachment`
6. **Stringify** — the final merged frontmatter is converted back to YAML.
7. **Render body** — the body portion is rendered through LiquidJS.
8. **Combine** — frontmatter + body are joined into the final markdown file.

### Mandatory Frontmatter Fields

These fields are **always injected** regardless of your template. Do not remove them from generated notes.

| Field                      | Template Type | Description                                                    |
| -------------------------- | ------------- | -------------------------------------------------------------- |
| `zotflow-locked`           | Both          | Always `true`. Enables the CM6 readonly extension.             |
| `zotero-key`               | Zotero        | The Zotero item key. Used to link the note to the Zotero item. |
| `item-version`             | Zotero        | The Zotero item version. Used for update detection.            |
| `zotflow-local-attachment` | Local         | Wiki-link to the source file (e.g., `[[Articles/paper.pdf]]`). |

---

## Tips & Examples

### Extracting a Year from a Date

```liquid
year: {{ item.date | slice: 0, 4 }}
```

### Formatting Creators as a Comma-Separated List

```liquid
authors: [{% for c in item.creators %}"{{ c.name }}"{% unless forloop.last %}, {% endunless %}{% endfor %}]
```

### Wrapping Text in Blockquotes (Multi-line Safe)

Use the `capture` + `replace` pattern to handle multi-line text inside blockquotes:

```liquid
{%- capture quote_string %}{{ newline }}> {% endcapture -%}
> {{ item.abstractNote | replace: newline, quote_string }}
```

### Conditionally Showing Sections

```liquid
{%- if item.DOI -%}
DOI: [{{ item.DOI }}](https://doi.org/{{ item.DOI }})
{%- endif -%}
```

### Rendering Tags

```liquid
{%- if item.tags.length > 0 -%}
tags:
{%- for tag in item.tags -%}
  - {{ tag.tag }}
{%- endfor -%}
{%- endif -%}
```

### Deep-Linking to Attachments

```liquid
[Open PDF](obsidian://zotflow?type=open-attachment&libraryID={{ attachment.libraryID }}&key={{ attachment.key }})
```

### Navigating to a Specific Annotation

```liquid
[Jump to annotation](obsidian://zotflow?type=open-attachment&libraryID={{ attachment.libraryID }}&key={{ attachment.key }}&navigation={{ annotation.key | process_nav_info }})
```

### Annotation Callouts with Color

The default template uses Obsidian callouts with type-and-color information:

```liquid
> [!zotflow-{{ annotation.type }}-{{ annotation.color }}] Title text
> > Quoted annotation text
```

You can style these callouts in CSS using classes like `callout[data-callout="zotflow-highlight-#ffd400"]`.

### Using `| json` for Safe YAML Values

Always use `| json` for frontmatter values that may contain special characters:

```liquid
title: {{ item.title | json }}
```

This wraps the value in quotes and escapes special characters, preventing YAML parsing errors.

### Accessing Nested Annotations by Attachment

```liquid
{%- for attachment in item.attachments -%}
{%- if attachment.annotations.length > 0 -%}
### {{ attachment.filename }}
{%- for annotation in attachment.annotations -%}
- p.{{ annotation.pageLabel }}: {{ annotation.text }}
{%- endfor -%}
{%- endif -%}
{%- endfor -%}
```

### Using the Flattened `attachmentAnnotations`

If you want all annotations regardless of which attachment they belong to:

```liquid
{%- for annotation in item.attachmentAnnotations -%}
- {{ annotation.text }} ({{ annotation.color }})
{%- endfor -%}
```
