import { ZoteroCollection, ZoteroItem, ZoteroLibrary } from "./zotero";
import { ZoteroItemData, ZoteroItemDataTypeMap } from "./zotero-item";

// Zotero Library
export interface IndexedDBZoteroLibrary extends ZoteroLibrary {
    collectionVersion?: number; // For collection sync, indicates the global version of the library
    itemVersion?: number; // For item sync, indicates the global version of the library
}

// Zotero Collection
export interface IndexedDBZoteroCollection {
    key: string;
    libraryID: number;
    version: number;
    name: string;
    parentCollection: false | string;
    trashed: boolean;         // Whether the collection is trashed

    // Sync State
    _syncStatus: 'synced' | 'created' | 'updated' | 'deleted';
    _syncedAt?: string;

    // Raw Payload
    raw: ZoteroCollection;
}

// Zotero Item
interface _IndexedDBZoteroItem<T extends ZoteroItemData> {
    // Core Zotero Data
    key: string;              // Zotero Item Key (8 chars)
    libraryID: number;        // Library ID (User or Group ID)

    // Core Indexed Fields
    itemType: T['itemType']; // 'journalArticle', 'attachment', 'annotation', etc.
    parentItem: string;      // Parent Item Key
    trashed: boolean;        // Whether the item is trashed

    // Sorting & Versioning
    title?: string;            // Title (normalized for sorting)
    collections?: string[];    // Collection Key Array
    dateAdded: string;        // ISO String
    dateModified: string;     // ISO String (Zotero Cloud's last modified time)
    version: number;          // Zotero Cloud Version (for optimistic locking)

    // Derived Fields for Search
    _searchCreators: string[];
    _searchTags: string[];

    // Sync State
    _syncStatus: 'synced' | 'created' | 'updated' | 'deleted';
    _syncedAt?: string;
    _lastAccessed?: string;
    _readingProgress?: number;

    // Raw Payload
    raw: ZoteroItem<T>;
}

export type IndexedDBZoteroItem<T extends ZoteroItemData> = _IndexedDBZoteroItem<T>;
export type AnyIndexedDBZoteroItem = { [K in keyof ZoteroItemDataTypeMap]: IndexedDBZoteroItem<ZoteroItemDataTypeMap[K]> }[keyof ZoteroItemDataTypeMap];

// Zotero File
export interface IndexedDBZoteroFile {
    key: string;         // Zotero Item Key (itemType='attachment')
    blob: Blob;          // File Blob
    mimeType: string;
    md5: string;         // File MD5 (API returned), used to determine if re-download is needed
    downloadedAt: string; // LRU cleanup strategy
}

export interface MutationTask {
    id?: number;         // Auto-increment ID
    libraryID: number;
    actionType: 'create' | 'update' | 'delete';
    dataType: 'item' | 'collection';
    key: string;         // Key to perform action on
    payload: any;        // JSON Body to send to API
    createdAt: string;
    retryCount: number;
    error?: string;      // Last failure reason
}