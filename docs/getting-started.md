# Getting Started

This guide walks you through installing ZotFlow, connecting your Zotero account, and running your first library sync.

---

## 1. Install ZotFlow

<!-- ### From Community Plugins (Recommended)

1. Open **Settings → Community plugins → Browse**.
2. Search for **ZotFlow**.
3. Click **Install**, then **Enable**. -->

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the discord.
2. Create a folder at `<your-vault>/.obsidian/plugins/obsidian-zotflow/`.
3. Copy the three files into that folder.
4. Reload Obsidian → **Settings → Community plugins** → enable **ZotFlow**.

---

## 2. Create a Zotero API Key

1. Go to [https://www.zotero.org/settings/keys/new](https://www.zotero.org/settings/keys/new).
2. Give the key a descriptive name (e.g., "ZotFlow").
3. Under **Personal Library**, check **Allow library access** and **Allow write access** (required for bidirectional sync).
4. If you use group libraries, grant access to the groups you want to sync under **Default Group Permissions** or per-group settings.
5. Click **Save Key** and copy the generated key.

---

## 3. Connect ZotFlow to Zotero

1. Open **Settings → ZotFlow → Sync**.
2. Paste your API key into the **API Key** field.
3. Click **Verify Key**.
    - ZotFlow will validate the key, fetch your user info, and discover all accessible libraries (personal + groups).
    - On success, you'll see a green **Verified** badge next to the key field.
4. A **Library Synchronization** table appears showing all available libraries.

### Configure Library Sync Modes

Each library can be set to one of three modes:

| Mode              | Description                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------- |
| **Bidirectional** | Push local annotation changes back to Zotero and pull remote changes. Requires write access. |
| **Read Only**     | Pull items and annotations from Zotero, but never push changes back.                         |
| **Ignored**       | Skip this library entirely during sync.                                                      |

Set the desired mode for each library using the dropdown in the table.

---

## 4. Run Your First Sync

1. Click the **ZotFlow icon** (Zotero logo) in the left ribbon to open the **Activity Center**.
2. Go to the **Sync** tab.
3. Click **Sync All** to sync every non-ignored library, or click the **Sync** button next to a specific library.
4. Watch the progress in the **Tasks** tab — you'll see a sync task with a progress bar.
5. Once complete, your Zotero items are cached locally in IndexedDB. You can now browse them offline.

---

## 5. Browse Your Library

1. Open the **Zotero Tree View**:
    - Use the command palette: `ZotFlow: Open Zotero Tree View`
    - Or look for the Library icon in the left sidebar
2. The tree shows your libraries → collections → items → attachments in a familiar hierarchy.
3. Use the **search bar** at the top to filter items by name.
4. Click any node to expand/collapse it.

---

## 6. Optional: WebDAV Setup

If your Zotero attachments are stored on a WebDAV server (instead of Zotero cloud storage):

1. Go to **Settings → ZotFlow → WebDAV**.
2. Enable the **WebDAV Sync** toggle.
3. Enter your **Server URL**, **Username**, and **Password**.
4. Click **Verify & Connect**.
    - On success, you'll see "WebDAV Connected!" and the fields become read-only.
    - Use the **Disconnect** button to clear WebDAV settings later.

---

## 7. Optional: Caching

ZotFlow caches downloaded attachment files locally for fast reopening.

- **Toggle**: **Settings → ZotFlow → Cache → Enable Cache** (default: on).
- **Size limit**: Set a maximum cache size in MB (default: 500 MB). Oldest files are evicted first when the limit is reached.
- **Purge**: Click **Purge Cache** to clear all cached files immediately.

---

## What's Next?

- **[Reading & Annotating](reading-and-annotating.md)** — Open attachments in the built-in reader and start highlighting.
- **[Source Notes](source-notes.md)** — Auto-generate linked Markdown notes from your Zotero items.
- **[Template Guide](template-guide.md)** — Customize how source notes are rendered with LiquidJS templates.
