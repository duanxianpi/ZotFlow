import Dexie, { Table } from 'dexie';
import { MutationTask, IndexedDBZoteroFile, IndexedDBZoteroItem, IndexedDBZoteroCollection, IndexedDBZoteroLibrary } from 'types/db-schema';

export class ZotFlowDB extends Dexie {
    items!: Table<IndexedDBZoteroItem, string>;
    collections!: Table<IndexedDBZoteroCollection, string>;
    libraries!: Table<IndexedDBZoteroLibrary, number>;
    files!: Table<IndexedDBZoteroFile, string>;
    mutationQueue!: Table<MutationTask, number>;

    constructor() {
        super('ZotFlowDB');

        // Schema Definition
        this.version(1).stores({
            // Zotero Items
            items: `
                &key, 
                libraryID, 
                itemType, 
                parentItem, 
                *collections, 
                *_searchCreators, 
                *_searchTags, 
                dateModified, 
                local.lastAccessed, 
                _syncStatus, 
                [libraryID+version]
            `,

            // Zotero Collections
            collections: `
                &key, 
                libraryID, 
                parentCollection, 
                name,
                _syncStatus,
                [libraryID+version]
            `,

            // Zotero Libraries
            libraries: '&id',

            // Zotero Files
            files: '&key, downloadedAt',

            // Mutation Queue
            mutationQueue: '++id, libraryID, key'
        });
    }
}

export const db = new ZotFlowDB();