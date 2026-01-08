import { ZoteroItemData } from 'types/zotero-item';
import { IndexedDBZoteroCollection, AnyIndexedDBZoteroItem } from '../types/db-schema';
import { ZoteroCollection, AnyZoteroItem } from 'types/zotero';

/**
 * Normalize a raw Zotero collection from the API into our IndexedDB schema.
 * @param raw - The raw collection object from Zotero API (containing .data, .key, etc.)
 * @param libraryID - The library ID this collection belongs to
 */
export function normalizeCollection(raw: ZoteroCollection, libraryID: number): IndexedDBZoteroCollection {
    console.log(raw);
    const collection: IndexedDBZoteroCollection = {
        key: raw.key,
        libraryID: libraryID,
        version: raw.version,
        name: raw.data.name,
        parentCollection: raw.data.parentCollection || false,
        trashed: raw.data.deleted,
        _syncStatus: 'synced' as const,
        _syncedAt: new Date().toISOString(),
        raw: raw
    };
    return collection;
}


/**
 * Normalize a raw Zotero item from the API into our IndexedDB schema.
 * @param raw - The raw item object from Zotero API (containing .data, .key, etc.)
 * @param libraryID - The library ID this item belongs to
 */
/**
 * Normalize a raw Zotero item from the API into our IndexedDB schema.
 * @param raw - The raw item object from Zotero API (containing .data, .key, etc.)
 * @param libraryID - The library ID this item belongs to
 */
export function normalizeItem(raw: AnyZoteroItem, libraryID: number): AnyIndexedDBZoteroItem {
    // Safety check for title
    let title = '';

    // We can access common properties
    const commonData = raw.data as ZoteroItemData;

    if (raw.data.itemType === 'attachment') {
        title = raw.data.filename || raw.data.title || '';
    } else if (raw.data.itemType === 'note') {
        const plainText = raw.data.note ? raw.data.note.replace(/<[^>]+>/g, ' ') : '';
        title = plainText.slice(0, 50).trim() || `Note ${raw.data.key}`;
    } else if (raw.data.itemType !== 'annotation') { // Exclude annotation which doesn't have title
        // For other types that might have title
        const maybeTitle = (raw.data as any).title;
        if (maybeTitle) title = maybeTitle;
    }

    // Flatten creators for search
    const searchCreators: string[] = [];
    let creators: any[] = [];

    if (raw.data.itemType === 'attachment' || raw.data.itemType === 'note' || raw.data.itemType === 'annotation') {
        creators = [];
    } else {
        creators = raw.data.creators || [];
    }

    creators.forEach((c: any) => {
        if (c.name) {
            searchCreators.push(c.name);
        } else if (c.firstName || c.lastName) {
            searchCreators.push(`${c.firstName || ''} ${c.lastName || ''}`.trim());
        }
    });

    // Flatten tags for search
    const searchTags: string[] = [];
    if (commonData.tags && Array.isArray(commonData.tags)) {
        commonData.tags.forEach((t: any) => {
            if (t.tag) searchTags.push(t.tag);
        });
    }

    const item: AnyIndexedDBZoteroItem = {
        key: raw.data.key,
        libraryID: libraryID,
        itemType: raw.data.itemType,
        parentItem: raw.data.parentItem,
        collections: raw.data.collections,
        title: title,
        trashed: raw.data.deleted,
        dateAdded: raw.data.dateAdded,
        dateModified: raw.data.dateModified,
        version: raw.data.version,
        _searchCreators: searchCreators,
        _searchTags: searchTags,
        _syncStatus: 'synced',
        _syncedAt: new Date().toISOString(),
        _lastAccessed: new Date().toISOString(),
        _readingProgress: 0,

        raw: raw
    } as AnyIndexedDBZoteroItem;

    return item;
}

