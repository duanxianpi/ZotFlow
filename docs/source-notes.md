# Source Notes

ZotFlow generates **source notes** — structured Markdown files that capture an item's metadata and annotations. Each Zotero item gets exactly one note, which acts as a stable reference node in your knowledge graph.

---

## Philosophy

Source notes follow a **Zettelkasten-inspired** approach:

- **One note per source** — each Zotero item maps to exactly one Markdown file.
- **Locked & auto-generated** — source notes are marked `zotflow-locked` and open in reading view. They regenerate automatically when annotations change, so they always reflect the latest state of the source.
- **Link, don't edit** — write your own thoughts and interpretations in separate notes that **link back** to the source note. This keeps the boundary between "what the author said" and "what I think" clean.

---

## Creating Source Notes

### From the Tree View

1. Open the **Zotero Tree View**.
2. **Right-click** any item → **Open source note**.
    - If the note doesn't exist yet, it's created using your template (or the built-in default).
    - If it already exists, it's updated to the latest version and opened.

### Batch Creation

Right-click a **collection** or **library** in the Tree View → **Create source note for all child items**. This starts a background task that creates/updates notes for every item in that collection.

Progress is visible in the **Activity Center → Tasks** tab.

### From a Protocol URI

```
obsidian://zotflow?type=open-note&libraryID=<id>&key=<key>
```

This finds (or creates) the source note for the given item and opens it.

### Local Source Notes

When using the **Local Reader** (for vault PDFs/EPUBs), source notes are created automatically when you make annotations. These use a separate template and folder from Zotero source notes.

---

## Settings

Configure source notes in **Settings → ZotFlow → General**:

### Zotero Source Notes

| Setting                        | Description                                                                              | Example                           |
| ------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------- |
| **Template Path**              | Path to a LiquidJS template file (vault-relative). Leave empty for the built-in default. | `templates/SourceNoteTemplate.md` |
| **Default Source Note Folder** | Folder where notes are created.                                                          | `Source/ZotFlow`                  |

### Local Source Notes

| Setting                        | Description                                                   | Example                                |
| ------------------------------ | ------------------------------------------------------------- | -------------------------------------- |
| **Local Source Note Template** | Template for local vault file notes. Leave empty for default. | `templates/LocalSourceNoteTemplate.md` |
| **Local Source Note Folder**   | Folder where local source notes are created.                  | `Source/ZotFlow/Local`                 |

### Annotation Images

| Setting                           | Description                                          | Example               |
| --------------------------------- | ---------------------------------------------------- | --------------------- |
| **Auto Import Annotation Images** | Automatically extract image/ink annotations as PNGs. | Toggle                |
| **Annotation Image Folder**       | Where extracted images are saved.                    | `Attachments/ZotFlow` |

---

## How Source Notes Work

### Zotero Source Notes

When you create or update a source note for a Zotero item:

1. ZotFlow reads your template file (or uses the built-in default).
2. The item's metadata, child notes, attachments, and annotations are gathered from the local database.
3. The template is rendered with LiquidJS, producing the Markdown content.
4. **Frontmatter is merged**: if the file already exists, any custom frontmatter fields you added are preserved — only template-defined fields are overwritten.
5. **Mandatory fields are injected**:
    - `zotflow-locked: true` — marks the note as locked (opens in reading view).
    - `zotero-key` — links the note to the Zotero item.
    - `item-version` — used for update detection; the note is only regenerated when the version changes.
6. The file is written to disk.

### Local Source Notes

Same pipeline, but with different context variables and mandatory fields:

- `zotflow-locked: true`
- `zotflow-local-attachment: [[path/to/file.pdf]]`

Local templates use `%% ZOTFLOW_ANNO_..._BEG %%` / `%% ZOTFLOW_ANNO_..._END %%` comment markers to round-trip annotation data. **These markers are mandatory** — see the [Template Guide](template-guide.md#local-source-note-template) for details.

---

## Auto-Update Behavior

Source notes update automatically during sync:

1. A sync pulls updated items from Zotero.
2. For each changed item that already has a source note in the vault, the note is re-rendered.
3. The update is **version-aware**: if the file's `item-version` frontmatter matches the item's current version, no re-render happens (unless forced).

You can also force an update by right-clicking an item in the Tree View → **Open source note** — this always re-renders.

---

## Locked Notes

Source notes include `zotflow-locked: true` in their frontmatter. This activates a CodeMirror 6 extension that makes the editor **read-only** for that file — the note opens in preview/reading mode to prevent accidental edits.

Your own ideas and connections belong in **separate notes** that link back to the source note.

---

## Annotation Callouts

The default templates render annotations as Obsidian callouts with type and color information:

```markdown
> [!zotflow-highlight-#ffd400] [paper.pdf, p.5](obsidian://zotflow?type=open-attachment&libraryID=1&key=ABC12345&navigation=...)
>
> > The highlighted text goes here
>
> Your comment about this annotation
> ^ANNOTATION_KEY
```

- The callout type follows the pattern `zotflow-<type>-<color>` (e.g., `zotflow-highlight-#ffd400`).
- Clicking the callout title opens the reader and navigates to that exact annotation.
- The `^ANNOTATION_KEY` block reference allows linking to specific annotations from other notes.

You can style these callouts in CSS using selectors like:

```css
.callout[data-callout="zotflow-highlight-#ffd400"] {
    /* ... */
}
```

---

## Customizing Templates

Both template types use [LiquidJS](https://liquidjs.com) syntax. You can create custom templates to control exactly what appears in your source notes.

### Quick Example (Zotero)

Create a file at `templates/SourceNoteTemplate.md`:

```liquid
---
citationKey: {{ item.citationKey | json }}
title: {{ item.title | json }}
authors: [{% for c in item.creators %}"{{ c.name }}"{% unless forloop.last %}, {% endunless %}{% endfor %}]
year: {{ item.date | slice: 0, 4 }}
---
# {{ item.title }}

**Authors:** {% for c in item.creators %}{{ c.name }}{% unless forloop.last %}, {% endunless %}{% endfor %}

{%- if item.abstractNote %}

## Abstract

> {{ item.abstractNote }}
{%- endif %}

{%- if item.attachmentAnnotations.length > 0 %}

## Annotations

{%- for annotation in item.attachmentAnnotations %}
- **p.{{ annotation.pageLabel }}**: {{ annotation.text }}{% if annotation.comment != "" %} — _{{ annotation.comment }}_{% endif %}
{%- endfor %}
{%- endif %}
```

Then set **Settings → ZotFlow → General → Template Path** to `templates/SourceNoteTemplate.md`.

### Full Reference

See the **[Template Guide](template-guide.md)** for:

- All available context variables (`item`, `attachment`, `annotation`, `note`, `settings`)
- Custom filters (`process_nav_info`, `process_raw_anno_json`)
- Frontmatter rendering pipeline
- Tips and patterns for common use cases

---

## What's Next?

- **[Template Guide](template-guide.md)** — Full template variable and filter reference.
- **[Getting Started](getting-started.md)** — Setup and sync instructions.
- **[Reading & Annotating](reading-and-annotating.md)** — Using the built-in reader.
