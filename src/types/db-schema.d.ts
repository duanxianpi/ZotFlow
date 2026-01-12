import {
    ZoteroCollection,
    ZoteroGroup,
    ZoteroItem,
    ZoteroKey,
    ZoteroLibrary,
} from "./zotero";
import { ZoteroItemData, ZoteroItemDataTypeMap } from "./zotero-item";

// Zotero Key
export interface IDBZoteroKey extends ZoteroKey {
    joinedGroups: number[]; // Array of Group IDs the key has access to
}

// Zotero Group
export interface IDBZoteroGroup extends ZoteroGroup {}

// Zotero Library
export interface IDBZoteroLibrary extends ZoteroLibrary {
    collectionVersion?: number; // For collection sync, indicates the global version of the library
    itemVersion?: number; // For item sync, indicates the global version of the library

    syncedAt?: string; // ISO String of last successful sync
}

// Zotero Collection
export interface IDBZoteroCollection {
    libraryID: number;
    key: string;
    version: number;
    name: string;
    parentCollection: false | string;
    trashed: 0 | 1; // Whether the collection is trashed

    // Sync State
    syncStatus: "synced" | "created" | "updated" | "deleted";
    syncedAt?: string;

    // Raw Payload
    raw: ZoteroCollection;
}

// Zotero Item
interface _IDBZoteroItem<T extends ZoteroItemData> {
    // Core Zotero Data
    libraryID: number; // Library ID (User or Group ID)
    key: string; // Zotero Item Key (8 chars)

    // Core Indexed Fields
    itemType: T["itemType"]; // 'journalArticle', 'attachment', 'annotation', etc.
    parentItem: string; // Parent Item Key

    // Sorting & Versioning
    title?: string; // Title (normalized for sorting)
    collections?: string[]; // Collection Key Array
    dateAdded: string; // ISO String
    dateModified: string; // ISO String (Zotero Cloud's last modified time)
    version: number; // Zotero Cloud Version (for optimistic locking)

    // Derived Fields for Search
    searchCreators: string[];
    searchTags: string[];

    // Sync State
    syncStatus: "synced" | "created" | "updated" | "deleted" | "ignore";
    syncedAt?: string;
    lastAccessedAt?: string;
    readingProgress?: number;

    // Annotation Extraction Tracking
    annotationExtractionFileMD5?: string;

    // Raw Payload
    raw: ZoteroItem<T>;
}

export type IDBZoteroItem<T extends ZoteroItemData> = _IDBZoteroItem<T>;
export type AnyIDBZoteroItem = {
    [K in keyof ZoteroItemDataTypeMap]: IDBZoteroItem<ZoteroItemDataTypeMap[K]>;
}[keyof ZoteroItemDataTypeMap];

// Zotero File
export interface IDBZoteroFile {
    libraryID: number; // Library ID (User or Group ID)
    key: string; // Zotero Item Key (itemType='attachment')
    blob: Blob; // File Blob
    mimeType: string;
    fileName: string;
    md5: string; // File MD5 (API returned), used to determine if re-download is needed
    lastAccessedAt: string;
    size: number;
}
