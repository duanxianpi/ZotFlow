export type LibrarySyncMode = "bidirectional" | "readonly" | "ignored";
export type TabSection = "sync" | "webdav" | "cache" | "general";

export interface LibraryConfig {
    mode: LibrarySyncMode;
}

export interface ZotFlowSettings {
    zoteroApiKey: string;
    librariesConfig: Record<string, LibraryConfig>;
    syncInterval: number; // in minutes
    autoSync: boolean;
    useWebDav: boolean;
    webDavUrl?: string;
    webDavUser?: string;
    webDavPassword?: string;
    useCache: boolean;
    maxCacheSizeMB: number;
    sourceNoteTemplatePath: string;
    sourceNoteFolder: string;
}

export const DEFAULT_SETTINGS: ZotFlowSettings = {
    zoteroApiKey: "",
    librariesConfig: {},
    syncInterval: 30, // Default 30 minutes
    autoSync: false,
    useWebDav: false,
    useCache: true,
    maxCacheSizeMB: 500,
    sourceNoteTemplatePath: "",
    sourceNoteFolder: "",
};
