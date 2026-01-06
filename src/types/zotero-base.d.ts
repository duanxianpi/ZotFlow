export interface ZoteroItemBase {
    key: string;
    version: number;
    library: { type: string; id: number; name: string };
    links: { [key: string]: { href: string; type: string } };
    data: {
        key: string;
        version: number;
        itemType: string;
        dateAdded: string;
        dateModified: string;
        tags: Array<{ tag: string; type?: number }>;
        collections: string[];
        relations: { [key: string]: string | string[] };
    };
}

export interface ZoteroCollection {
    key: string;
    libraryID: number;
    version: number;
    name: string;
    parentCollection?: string;
    _syncStatus: 'synced' | 'created' | 'updated' | 'deleted';
}

// Zotero Library
export interface ZoteroLibrary {
    id: number;          // Library ID
    type: 'user' | 'group';
    name: string;
    version: number;
    lastSyncAttempt: number;
}