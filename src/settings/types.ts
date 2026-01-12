export type LibrarySyncMode = "bidirectional" | "readonly" | "ignored";
export type TabSection = "sync" | "webdav" | "cache";

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
}

export const DEFAULT_SETTINGS: ZotFlowSettings = {
    zoteroApiKey: "",
    librariesConfig: {},
    syncInterval: 30, // Default 30 minutes
    autoSync: false,
    useWebDav: false,
    useCache: true,
    maxCacheSizeMB: 500,
};
