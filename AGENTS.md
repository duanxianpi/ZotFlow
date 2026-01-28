# Obsidian community plugin

## Project overview

- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Entry point: `main.ts` compiled to `main.js` and loaded by Obsidian.
- Required release artifacts: `main.js`, `manifest.json`, and optional `styles.css`.

# Project Architecture Summary

## 1. Architecture Overview

**ZotFlow** is an Obsidian plugin designed to integrate Zotero into Obsidian. It uses a **Client-Server** like architecture where the main thread (Obsidian UI) acts as the client and a Web Worker acts as the server/backend to handle heavy processing and external communications.

### Key Components

- **Main Thread (Obsidian Plugin)**:
    - Handles UI rendering (Settings, Tree View, PDF Reader, Modals).
    - Interacts with Obsidian API (Workspace, Vault, Editor).
    - Delegates heavy tasks to the Worker via `workerBridge`.
    - **Entry Point**: `src/main.ts`

- **Web Worker (`src/worker`)**:
    - Handles "Heavy" business logic.
    - **Zotero API Interaction**: Fetching libraries, items, collections.
    - **Sync Logic**: Synchronizing Zotero data with local database.
    - **WebDAV**: Downloading/Uploading attachments.
    - **PDF Processing**: Extracting annotations (via `pdf-worker.js`).
    - **Database**: Manages IndexedDB (Dexie) for caching Zotero data.

- **Bridge (`src/bridge`)**:
    - Facilitates communication between Main Thread and Web Worker using `comlink`.
    - `parent-host.ts`: Proxies requests from Worker to Main Thread (e.g., for `fetch` to bypass CORs or access Obsidian Vault).

- **Database (`src/db`)**:
    - Uses **Dexie.js** (IndexedDB wrapper).
    - Stores Zotero Items, Collections, Libraries, and Sync status locally for offline access and performance.

### Data Flow

1.  **User Action** (e.g., Sync Library) -> **Main Thread** (`main.ts`).
2.  **Command** -> `workerBridge` -> **Worker** (`worker.ts`).
3.  **Worker** -> `SyncService` -> `ZoteroAPIService` (Fetch data).
4.  **Worker** -> `ZotFlowDB` (Store data).
5.  **Main Thread** -> `TreeView` -> `workerBridge` (Query data) -> **UI Update**.

---

## 2. File Responsibilities (src)

### Root `src/`

- `main.ts`: Plugin entry point. Initializes services, worker bridge, registers views (Reader, Tree), icons, and settings.
- `utils.ts`: General utility functions.

### `src/bridge/`

- `index.ts`: Exports for the bridge module.
- `parent-host.ts`: `ParentHost` class. Exposes methods for the Worker to call back to the Main thread (e.g., `request` for network calls, `notify` for UI messages).
- `pdf-processor.ts`: specialized worker/logic for processing PDFs (likely separate from the main worker to isolate PDF.js implementation).
- `types.ts`: Type definitions for the bridge communication protocols.

### `src/bundle-assets/`

Handling of static assets (likely for the PDF worker).

- `inline-assets.ts`: Logic to inline assets.
- `patch-inlined-assets.ts`: Script/logic to patch assets into the bundle.

### `src/db/`

Database Layer.

- `db.ts`: `ZotFlowDB` class extending Dexie. Defines the schema for `items`, `collections`, `libraries`, `tags`, etc.
- `annotation.ts`: Logic/Types related to storing/processing annotations in DB.
- `normalize.ts`: Utilities to normalize Zotero API responses before storing in DB.

### `src/services/`

Main Thread Services.

- `services.ts`: `ServiceLocator` singleton. Initializes and provides access to `TemplateService` and `NoteService`.
- `note-service.ts`: Handles creating/updating Obsidian notes from Zotero items (importing metadata, etc.).
- `template-service.ts`: Manages Eta/EJS templates for generating note content.

### `src/settings/`

Plugin Settings.

- `settings.ts`: `ZotFlowSettingTab` class. The main settings page UI.
- `types.ts`: `ZotFlowSettings` interface definitions.
- `sections/`:
    - `general-section.ts`: General settings UI.
    - `sync-section.ts`: Sync configuration UI.
    - `cache-section.ts`: Cache management UI.
    - `webdav-section.ts`: WebDAV configuration UI.

### `src/types/`

TypeScript Definitions.

- `db-schema.d.ts`: Interfaces for IndexedDB tables.
- `zotero-api.d.ts`: Interfaces for Zotero Web API responses.
- `zotero-item.d.ts`, `zotero-types.d.ts`: Detailed types for Zotero objects.

### `src/ui/`

User Interface Components.

- `view.ts`, `viewer.ts`: Generic view helpers?
- `icons.ts`: SVG icon definitions.
- `zotflow-lock-extension.ts`: Editor extension (CodeMirror) for locking parts of the note?
- `modals/`:
    - `suggest.ts`: `ZoteroSuggestModal`. The "Quick Switcher" style modal to search and insert Zotero items.
- `reader/`:
    - `view.ts`: `ZoteroReaderView`. The PDF Reader interface within Obsidian.
    - `bridge.ts`: Bridge specifically for the Reader view (communication with PDF viewer).
- `tree-view/`: (React-based Library View)
    - `view.tsx`: `ZotFlowTreeView` (Obsidian View wrapper).
    - `TreeView.tsx`: Main React component for the library tree.
    - `Node.tsx`: React component for a single tree node (Collection/Item).
    - `ObsidianIcon.tsx`: Helper to render Obsidian icons in React.

### `src/worker/`

Web Worker Implementation.

- `worker.ts`: Worker entry point. Uses `comlink` to expose `WorkerAPI`. Initializes worker services.
- `services/`:
    - `zotero.ts`: `ZoteroAPIService`. Wraps Zotero Web API calls.
    - `webdav.ts`: `WebDavService`. Handles WebDAV operations.
    - `sync.ts`: `SyncService`. core logic for syncing Zotero -> DB.
    - `attachment.ts`: `AttachmentService`. Downloads/Uploads attachments.
    - `tree-view.ts`: `TreeViewService`. logic for constructing/querying the tree structure for the UI.

## Environment & tooling

- Node.js: use current LTS (Node 18+ recommended).
- **Package manager: npm** (required for this sample - `package.json` defines npm scripts and dependencies).
- **Bundler: esbuild** (required for this sample - `esbuild.config.mjs` and build scripts depend on it). Alternative bundlers like Rollup or webpack are acceptable for other projects if they bundle all external dependencies into `main.js`.
- Types: `obsidian` type definitions.

**Note**: This sample project has specific technical dependencies on npm and esbuild. If you're creating a plugin from scratch, you can choose different tools, but you'll need to replace the build configuration accordingly.

### Install

```bash
npm install
```

### Dev (watch)

```bash
npm run dev
```

### Production build

```bash
npm run build
```

## Linting

- To use eslint install eslint from terminal: `npm install -g eslint`
- To use eslint to analyze this project use this command: `eslint main.ts`
- eslint will then create a report with suggestions for code improvement by file and line number.
- If your source code is in a folder, such as `src`, you can use eslint with this command to analyze all files in that folder: `eslint ./src/`

## File & folder conventions

- **Organize code into multiple files**: Split functionality across separate modules rather than putting everything in `main.ts`.
- Source lives in `src/`. Keep `main.ts` small and focused on plugin lifecycle (loading, unloading, registering commands).
- **Example file structure**:
    ```
    src/
      main.ts           # Plugin entry point, lifecycle management
      settings.ts       # Settings interface and defaults
      commands/         # Command implementations
        command1.ts
        command2.ts
      ui/              # UI components, modals, views
        modal.ts
        view.ts
      utils/           # Utility functions, helpers
        helpers.ts
        constants.ts
      types.ts         # TypeScript interfaces and types
    ```
- **Do not commit build artifacts**: Never commit `node_modules/`, `main.js`, or other generated files to version control.
- Keep the plugin small. Avoid large dependencies. Prefer browser-compatible packages.
- Generated output should be placed at the plugin root or `dist/` depending on your build setup. Release artifacts must end up at the top level of the plugin folder in the vault (`main.js`, `manifest.json`, `styles.css`).

## Manifest rules (`manifest.json`)

- Must include (non-exhaustive):
    - `id` (plugin ID; for local dev it should match the folder name)
    - `name`
    - `version` (Semantic Versioning `x.y.z`)
    - `minAppVersion`
    - `description`
    - `isDesktopOnly` (boolean)
    - Optional: `author`, `authorUrl`, `fundingUrl` (string or map)
- Never change `id` after release. Treat it as stable API.
- Keep `minAppVersion` accurate when using newer APIs.
- Canonical requirements are coded here: https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml

## Testing

- Manual install for testing: copy `main.js`, `manifest.json`, `styles.css` (if any) to:
    ```
    <Vault>/.obsidian/plugins/<plugin-id>/
    ```
- Reload Obsidian and enable the plugin in **Settings → Community plugins**.

## Commands & settings

- Any user-facing commands should be added via `this.addCommand(...)`.
- If the plugin has configuration, provide a settings tab and sensible defaults.
- Persist settings using `this.loadData()` / `this.saveData()`.
- Use stable command IDs; avoid renaming once released.

## Versioning & releases

- Bump `version` in `manifest.json` (SemVer) and update `versions.json` to map plugin version → minimum app version.
- Create a GitHub release whose tag exactly matches `manifest.json`'s `version`. Do not use a leading `v`.
- Attach `manifest.json`, `main.js`, and `styles.css` (if present) to the release as individual assets.
- After the initial release, follow the process to add/update your plugin in the community catalog as required.

## Security, privacy, and compliance

Follow Obsidian's **Developer Policies** and **Plugin Guidelines**. In particular:

- Default to local/offline operation. Only make network requests when essential to the feature.
- No hidden telemetry. If you collect optional analytics or call third-party services, require explicit opt-in and document clearly in `README.md` and in settings.
- Never execute remote code, fetch and eval scripts, or auto-update plugin code outside of normal releases.
- Minimize scope: read/write only what's necessary inside the vault. Do not access files outside the vault.
- Clearly disclose any external services used, data sent, and risks.
- Respect user privacy. Do not collect vault contents, filenames, or personal information unless absolutely necessary and explicitly consented.
- Avoid deceptive patterns, ads, or spammy notifications.
- Register and clean up all DOM, app, and interval listeners using the provided `register*` helpers so the plugin unloads safely.

## UX & copy guidelines (for UI text, commands, settings)

- Prefer sentence case for headings, buttons, and titles.
- Use clear, action-oriented imperatives in step-by-step copy.
- Use **bold** to indicate literal UI labels. Prefer "select" for interactions.
- Use arrow notation for navigation: **Settings → Community plugins**.
- Keep in-app strings short, consistent, and free of jargon.

## Performance

- Keep startup light. Defer heavy work until needed.
- Avoid long-running tasks during `onload`; use lazy initialization.
- Batch disk access and avoid excessive vault scans.
- Debounce/throttle expensive operations in response to file system events.

## Coding conventions

- TypeScript with `"strict": true` preferred.
- **Keep `main.ts` minimal**: Focus only on plugin lifecycle (onload, onunload, addCommand calls). Delegate all feature logic to separate modules.
- **Split large files**: If any file exceeds ~200-300 lines, consider breaking it into smaller, focused modules.
- **Use clear module boundaries**: Each file should have a single, well-defined responsibility.
- Bundle everything into `main.js` (no unbundled runtime deps).
- Avoid Node/Electron APIs if you want mobile compatibility; set `isDesktopOnly` accordingly.
- Prefer `async/await` over promise chains; handle errors gracefully.

## Mobile

- Where feasible, test on iOS and Android.
- Don't assume desktop-only behavior unless `isDesktopOnly` is `true`.
- Avoid large in-memory structures; be mindful of memory and storage constraints.

## Agent do/don't

**Do**

- Add commands with stable IDs (don't rename once released).
- Provide defaults and validation in settings.
- Write idempotent code paths so reload/unload doesn't leak listeners or intervals.
- Use `this.register*` helpers for everything that needs cleanup.

**Don't**

- Introduce network calls without an obvious user-facing reason and documentation.
- Ship features that require cloud services without clear disclosure and explicit opt-in.
- Store or transmit vault contents unless essential and consented.

## Common tasks

### Organize code across multiple files

**main.ts** (minimal, lifecycle only):

```ts
import { Plugin } from "obsidian";
import { MySettings, DEFAULT_SETTINGS } from "./settings";
import { registerCommands } from "./commands";

export default class MyPlugin extends Plugin {
    settings: MySettings;

    async onload() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData(),
        );
        registerCommands(this);
    }
}
```

**settings.ts**:

```ts
export interface MySettings {
    enabled: boolean;
    apiKey: string;
}

export const DEFAULT_SETTINGS: MySettings = {
    enabled: true,
    apiKey: "",
};
```

**commands/index.ts**:

```ts
import { Plugin } from "obsidian";
import { doSomething } from "./my-command";

export function registerCommands(plugin: Plugin) {
    plugin.addCommand({
        id: "do-something",
        name: "Do something",
        callback: () => doSomething(plugin),
    });
}
```

### Add a command

```ts
this.addCommand({
    id: "your-command-id",
    name: "Do the thing",
    callback: () => this.doTheThing(),
});
```

### Persist settings

```ts
interface MySettings { enabled: boolean }
const DEFAULT_SETTINGS: MySettings = { enabled: true };

async onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  await this.saveData(this.settings);
}
```

### Register listeners safely

```ts
this.registerEvent(
    this.app.workspace.on("file-open", (f) => {
        /* ... */
    }),
);
this.registerDomEvent(window, "resize", () => {
    /* ... */
});
this.registerInterval(
    window.setInterval(() => {
        /* ... */
    }, 1000),
);
```

## Troubleshooting

- Plugin doesn't load after build: ensure `main.js` and `manifest.json` are at the top level of the plugin folder under `<Vault>/.obsidian/plugins/<plugin-id>/`.
- Build issues: if `main.js` is missing, run `npm run build` or `npm run dev` to compile your TypeScript source code.
- Commands not appearing: verify `addCommand` runs after `onload` and IDs are unique.
- Settings not persisting: ensure `loadData`/`saveData` are awaited and you re-render the UI after changes.
- Mobile-only issues: confirm you're not using desktop-only APIs; check `isDesktopOnly` and adjust.

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide
