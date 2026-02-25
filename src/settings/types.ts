/** Per-library sync mode. */
export type LibrarySyncMode = "bidirectional" | "readonly" | "ignored";

/** Settings tab identifier. */
export type TabSection = "sync" | "webdav" | "cache" | "general";

/** Per-library sync configuration. */
export interface LibraryConfig {
    mode: LibrarySyncMode;
}

/** Full plugin settings shape persisted to `data.json`. */
export interface ZotFlowSettings {
    zoteroapikey: string;
    librariesConfig: Record<string, LibraryConfig>;
    syncInterval: number; // in minutes
    autoSync: boolean;
    useWebDav: boolean;
    webDavUrl?: string;
    webDavUser?: string;
    webdavpassword?: string;
    useCache: boolean;
    maxCacheSizeMB: number;
    sourceNoteTemplatePath: string;
    localSourceNoteTemplatePath: string;
    localSourceNoteFolder: string;
    sourceNoteFolder: string;
    autoImportAnnotationImages: boolean;
    annotationImageFolder: string;
    overwriteViewer: boolean;
}

/** Persisted reader view state for a single attachment (local or zotero). */
export interface ViewStateEntry {
    primaryViewState?: Record<string, unknown>;
    secondaryViewState?: Record<string, unknown>;
}

/**
 * Full shape of data.json.
 * Settings and non-settings data are stored as separate top-level keys.
 *
 * `viewStates` is keyed by file path (local) or `"libraryID:itemKey"` (zotero).
 */
export interface ZotFlowPluginData {
    settings: ZotFlowSettings;
    viewStates: Record<string, ViewStateEntry>;
}

/** Default values for all `ZotFlowSettings` fields. */
export const DEFAULT_SETTINGS: ZotFlowSettings = {
    zoteroapikey: "",
    librariesConfig: {},
    syncInterval: 30,
    autoSync: false,
    useWebDav: false,
    useCache: true,
    maxCacheSizeMB: 500,
    sourceNoteTemplatePath: "",
    sourceNoteFolder: "",
    localSourceNoteTemplatePath: "",
    localSourceNoteFolder: "",
    autoImportAnnotationImages: false,
    annotationImageFolder: "",
    overwriteViewer: false,
};

/** Default shape of the full `data.json` blob (settings + view states). */
export const DEFAULT_PLUGIN_DATA: ZotFlowPluginData = {
    settings: { ...DEFAULT_SETTINGS },
    viewStates: {},
};
