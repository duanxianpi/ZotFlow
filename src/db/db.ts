import Dexie, { Table } from 'dexie';
import { MutationTask, IndexedDBZoteroFile, IndexedDBZoteroItem, IndexedDBZoteroCollection, IndexedDBZoteroLibrary } from 'types/db-schema';
import { ZoteroItemData } from 'types/zotero-item';

export class ZotFlowDB extends Dexie {
    items!: Table<IndexedDBZoteroItem<ZoteroItemData>, string>;
    collections!: Table<IndexedDBZoteroCollection, string>;
    libraries!: Table<IndexedDBZoteroLibrary, number>;
    files!: Table<IndexedDBZoteroFile, string>;
    mutationQueue!: Table<MutationTask, number>;

    constructor() {
        super('zotflow');

        // Schema Definition
        this.version(1).stores({
            // Zotero Libraries
            libraries: '&id',

            // Zotero Collections
            collections: `
                &key, 
                libraryID, 
                trashed,
                name,
                parentCollection, 
                _syncStatus,
                [libraryID+version]
            `,

            // Zotero Items
            items: `
                &key, 
                libraryID, 
                itemType, 
                parentItem, 
                trashed,
                *collections, 
                *_searchCreators, 
                *_searchTags, 
                dateModified, 
                _syncStatus, 
                _lastAccessed, 
                [libraryID+version]
            `,

            // Zotero Files
            files: '&key, downloadedAt',

            // Mutation Queue
            mutationQueue: '++id, libraryID, key'
        });
    }
}

export const db = new ZotFlowDB();