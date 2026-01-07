import { ZoteroCollection, ZoteroLibrary } from "./zotero-base";
import { ZoteroItem, ZoteroItemType } from "./zotero-item-schema";

export interface IndexedDBZoteroItem {
    // Core Zotero Data
    key: string;              // Zotero Item Key (8 chars)
    libraryID: number;        // Library ID (User or Group ID)

    // Core Indexed Fields
    itemType: ZoteroItemType; // 'journalArticle', 'attachment', 'annotation', etc.
    parentItem?: string;      // Parent Item Key
    collections: string[];    // Collection Key Array
    trashed: boolean;         // Whether the item is trashed

    // Sorting & Versioning
    title: string;            // Title (normalized for sorting)
    dateAdded: string;        // ISO String
    dateModified: string;     // ISO String (Zotero Cloud's last modified time)
    version: number;          // Zotero Cloud Version (for optimistic locking)

    // Derived Fields for Search
    _searchCreators: string[];
    _searchTags: string[];

    // Sync State
    _syncStatus: 'synced' | 'created' | 'updated' | 'deleted';
    _syncedAt?: string;

    // Local Extension
    local: {
        lastAccessed?: number;
        readingProgress?: number;
        privateTags?: string[];
        kanbanStatus?: string;
        notes?: string;
        fileSize?: number;
        fileExtension?: string;  // pdf, epub, etc.
    };

    // Raw Payload
    data: ZoteroItem;
}

// Zotero File
export interface IndexedDBZoteroFile {
    key: string;         // Zotero Item Key (itemType='attachment')
    blob: Blob;          // File Blob
    mimeType: string;
    md5: string;         // File MD5 (API returned), used to determine if re-download is needed
    downloadedAt: string; // LRU cleanup strategy
}

export interface IndexedDBZoteroCollection extends ZoteroCollection {
    trashed: boolean;         // Whether the collection is trashed
    _syncStatus: 'synced' | 'created' | 'updated' | 'deleted';
    _syncedAt?: string;
}

export interface IndexedDBZoteroLibrary extends ZoteroLibrary {
    collectionVersion?: number; // For collection sync, indicates the global version of the library
    itemVersion?: number; // For item sync, indicates the global version of the library
}

// Mutation Task
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
