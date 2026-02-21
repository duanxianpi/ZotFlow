# ZotFlow — Keep Your Research in Flow

ZotFlow is a community plugin for [Obsidian](https://obsidian.md) that deeply integrates [Zotero](https://www.zotero.org) into your note-taking workflow. It syncs your Zotero libraries, lets you read and annotate PDFs/EPUBs/snapshots directly inside Obsidian, and automatically generates richly-templated source notes — all without leaving your vault.

## Features

### Zotero Library Sync

- **Bidirectional sync** — pull items from Zotero and push local changes (annotations, metadata) back.
- **Per-library control** — configure each library as _Bidirectional_, _Read-Only_, or _Ignored_.
- **Conflict resolution** — field-level diff viewer with _Keep Local_ / _Accept Remote_ actions and batch resolve.
- **WebDAV support** — download attachments from your own WebDAV server in addition to Zotero cloud storage.

### Built-in Reader

- **Read PDFs, EPUBs, and HTML snapshots** inside Obsidian — no external app needed.
- **Full annotation support** — highlights, underlines, notes, text selections, images, and ink drawings.
- **Local reader mode** — open any PDF/EPUB/HTML file in your vault with the same reader.
- **Live annotation refresh** — annotations update automatically after a sync completes.
- Optionally **replace Obsidian's default viewer** for PDF/EPUB/HTML files.

### Source Notes

ZotFlow's source notes follow a **Zettelkasten-inspired** philosophy: each Zotero item gets exactly one atomic note that serves as a permanent reference node in your knowledge graph. The generated note captures bibliographic metadata and your annotations in a structured, reproducible format — acting as a _literature note_ in Zettelkasten terms. Because these notes are auto-generated and locked, they stay faithful to the source material. Your own ideas, interpretations, and connections belong in separate _permanent notes_ that **link back** to the source note, keeping the boundary between "what the author said" and "what I think" clean. This makes source notes stable anchor points you can link to from anywhere in your vault without worrying about drift.

- **Template-powered** — use [LiquidJS](https://liquidjs.com) templates to control exactly how Zotero items are rendered as Markdown notes.
- **Separate templates** for Zotero items and local vault files.
- **Auto-update** — source notes regenerate when annotations change.
- **Annotation images** — visual annotations (image/ink) can be auto-extracted and saved to your vault.
- **Locked notes** — generated notes are marked `zotflow-locked` so they open in preview mode, preventing accidental edits.

### Zotero Tree View

- Browse your entire Zotero library structure (collections, items, attachments) in a sidebar tree.
- Quickly open attachments or source notes from the tree.

### Activity Center

- **Sync tab** — view library statuses, pending changes, conflicts, and trigger syncs.
- **Tasks tab** — monitor running and completed background tasks (sync, batch note creation, image extraction).
- **Telemetry tab** — searchable, filterable in-memory log console with expandable entries and copy support.

### Other

- **Protocol handler** — open notes or attachments via `obsidian://zotflow?type=open-note&libraryID=...&key=...` URIs.
- **Secure credential storage** — API keys and passwords are stored in Obsidian's `SecretStorage`, never in synced `data.json`.
- **Mobile-safe** — designed to work on both desktop and mobile.
- **Offline-first** — all data is cached locally in IndexedDB. Network is only used for Zotero API and WebDAV.

<!-- ## Installation

### From Community Plugins (recommended)

1. Open **Settings → Community plugins → Browse**.
2. Search for **ZotFlow**.
3. Click **Install**, then **Enable**.

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/duanxianpi/obsidian-zotflow/releases).
2. Create a folder at `<your-vault>/.obsidian/plugins/obsidian-zotflow/`.
3. Copy the three files into that folder.
4. Reload Obsidian → **Settings → Community plugins** → enable **ZotFlow**. -->

## Quick Start

1. **Get a Zotero API key** — go to [https://www.zotero.org/settings/keys/new](https://www.zotero.org/settings/keys/new) and create a key with read/write access to your personal library (and any groups you want to sync).
2. **Enter the key** in **Settings → ZotFlow → Sync**.
3. **Run your first sync** — open the Activity Center (ribbon icon or command palette) and click **Sync All**.
4. **Browse your library** — open the Zotero Tree View from the command palette or the left sidebar.
5. **Read & annotate** — click any attachment in the tree to open it in the built-in reader.

## Documentation

| Guide                                                      | Description                                                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **[Getting Started](docs/getting-started.md)**             | Install ZotFlow, connect your Zotero account, configure libraries, and run your first sync.    |
| **[Reading & Annotating](docs/reading-and-annotating.md)** | Open PDFs/EPUBs in the built-in reader, annotate, and use the local reader for vault files.    |
| **[Source Notes](docs/source-notes.md)**                   | Create, customize, and understand auto-generated source notes.                                 |
| **[Template Guide](docs/template-guide.md)**               | Full LiquidJS template reference — all variables, filters, frontmatter handling, and examples. |

## Commands

TODO

<!-- | Command                   | Description                              |
| ------------------------- | ---------------------------------------- |
| **Open Zotero Tree View** | Show the library browser in the sidebar. | -->

## Architecture

ZotFlow uses a **Main Thread + Web Worker** split:

- **Main thread** — Obsidian API interactions, UI rendering (React for complex views, native Obsidian APIs for settings).
- **Web Worker** — Zotero API communication, sync engine, database (IndexedDB via Dexie), template rendering, PDF processing.
- **Reader iframe** — Zotero's PDF/EPUB/HTML reader embedded via penpal for isolated, sandboxed rendering.

Communication flows through [Comlink](https://github.com/GoogleChromeLabs/comlink) (main ↔ worker) and [Penpal](https://github.com/nicmeriano/penpal) (main ↔ reader iframe).

## Development

### Prerequisites

- Node.js ≥ 16
- npm

### Setup

```bash
git clone https://github.com/duanxianpi/obsidian-zotflow.git --recursive
cd obsidian-zotflow
npm install
```

### Build

```bash
npm run build:ci       # Full CI build (PDF.js + reader + plugin)
```

### Development Mode

```bash
npm run dev:plugin     # esbuild watch mode (plugin)
npm run dev:reader     # webpack watch mode (reader, separate terminal)
```

### Lint

```bash
npm run lint
```

### Testing Locally

Copy `main.js`, `manifest.json`, and `styles.css` to:

```
<vault>/.obsidian/plugins/obsidian-zotflow/
```

Reload Obsidian and enable the plugin.

## Privacy

- **No telemetry, no analytics, no tracking.**
- Network requests go only to the Zotero API and your configured WebDAV server.
- Credentials are stored in Obsidian's platform-native `SecretStorage`.
- The reader iframe communicates only via structured-clone messaging (no `eval`, no remote code).

## License

[AGPL-3.0-only](LICENSE)

## Author

**Xianpi Duan** — [GitHub](https://github.com/duanxianpi/)

## Sponsor

Thanks for checking out the plugin! I’m currently a student and working on this plugin nights and weekends. If it’s useful to you, a small tip will help me keep shipping features.

<div>
	<a href="https://www.buymeacoffee.com/duanxianpi" target="_blank" title="buymeacoffee">
	  <img src="https://iili.io/JoQ0zN9.md.png"  alt="buymeacoffee-orange-badge" style="width: 200px;">
	</a>
</div>

---

## Roadmap / Feedback

Have ideas or found a bug? Please join the discord server!
<a href="https://discord.gg/7vNrR6qhVr"> <img alt="Join our Discord" src="https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white&style=for-the-badge"> </a>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=duanxianpi/obsidian-zotflow&type=date&legend=top-left)](https://www.star-history.com/#duanxianpi/obsidian-zotflow&type=date&legend=top-left)
