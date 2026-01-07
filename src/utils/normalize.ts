import { IndexedDBZoteroCollection, IndexedDBZoteroItem } from '../types/db-schema';

/**
 * Normalize a raw Zotero collection from the API into our IndexedDB schema.
 * @param raw - The raw collection object from Zotero API (containing .data, .key, etc.)
 * @param libraryID - The library ID this collection belongs to
 */
export function normalizeCollection(raw: any, libraryID: number): IndexedDBZoteroCollection {
    const collection: IndexedDBZoteroCollection = {
        key: raw.key,
        libraryID: libraryID,
        version: raw.version,
        name: raw.name,
        parentCollection: raw.parentCollection || undefined,
        trashed: raw.deleted,
        _syncStatus: 'synced' as const,
        _syncedAt: new Date().toISOString(),
    };
    return collection;
}


/**
 * Normalize a raw Zotero item from the API into our IndexedDB schema.
 * @param raw - The raw item object from Zotero API (containing .data, .key, etc.)
 * @param libraryID - The library ID this item belongs to
 */
export function normalizeItem(raw: any, libraryID: number): IndexedDBZoteroItem {
    // The Zotero API Client typically returns the full item object.
    // The actual item data is in the `data` property.
    const data = raw.data || raw;

    // Safety check for title
    let title = data.title || '';
    if (!title) {
        if (data.itemType === 'attachment') {
            title = data.title || data.filename || `Attachment ${data.key}`;
        } else if (data.itemType === 'note') {
            // Strip HTML tags for the title preview
            const plainText = data.note ? data.note.replace(/<[^>]+>/g, ' ') : '';
            title = plainText.slice(0, 50).trim() || `Note ${data.key}`;
        }
    }

    // Flatten creators for search
    const searchCreators: string[] = [];
    if (data.creators && Array.isArray(data.creators)) {
        data.creators.forEach((c: any) => {
            if (c.name) {
                searchCreators.push(c.name);
            } else if (c.firstName || c.lastName) {
                searchCreators.push(`${c.firstName || ''} ${c.lastName || ''}`.trim());
            }
        });
    }

    // Flatten tags for search
    const searchTags: string[] = [];
    if (data.tags && Array.isArray(data.tags)) {
        data.tags.forEach((t: any) => {
            if (t.tag) searchTags.push(t.tag);
        });
    }

    const item: IndexedDBZoteroItem = {
        key: data.key,
        libraryID: libraryID,
        itemType: data.itemType,
        parentItem: data.parentItem,
        collections: data.collections || [],
        title: title,
        trashed: data.deleted,
        dateAdded: data.dateAdded,
        dateModified: data.dateModified,
        version: data.version,
        _searchCreators: searchCreators,
        _searchTags: searchTags,
        _syncStatus: 'synced',
        _syncedAt: new Date().toISOString(),
        local: {},
        data: data
    };

    return item;
}

