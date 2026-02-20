export type LibrarySyncMode = "bidirectional" | "readonly" | "ignored";
export type TabSection = "sync" | "webdav" | "cache" | "general";

export interface LibraryConfig {
    mode: LibrarySyncMode;
}

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

export const DEFAULT_SETTINGS: ZotFlowSettings = {
    zoteroapikey: "",
    librariesConfig: {},
    syncInterval: 30, // Default 30 minutes
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
