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
    _syncedAt?: number;

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
    downloadedAt: number; // LRU cleanup strategy
}

export interface IndexedDBZoteroCollection extends ZoteroCollection { }

export interface IndexedDBZoteroLibrary extends ZoteroLibrary { }

// Mutation Task
export interface MutationTask {
    id?: number;         // Auto-increment ID
    libraryID: number;
    actionType: 'create' | 'update' | 'delete';
    dataType: 'item' | 'collection';
    key: string;         // Key to perform action on
    payload: any;        // JSON Body to send to API
    createdAt: number;
    retryCount: number;
    error?: string;      // Last failure reason
}
