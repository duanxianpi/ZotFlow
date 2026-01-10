import Dexie, { Table } from 'dexie';
import { MutationTask, IDBZoteroFile, IDBZoteroCollection, IDBZoteroLibrary, AnyIDBZoteroItem, IDBZoteroKey, IDBZoteroGroup } from 'types/db-schema';

export class ZotFlowDB extends Dexie {
    keys!: Table<IDBZoteroKey, string>;
    groups!: Table<IDBZoteroGroup, number>;
    items!: Table<AnyIDBZoteroItem, [number, string]>;
    collections!: Table<IDBZoteroCollection, [number, string]>;
    libraries!: Table<IDBZoteroLibrary, number>;
    files!: Table<IDBZoteroFile, [number, string]>;
    mutationQueue!: Table<MutationTask, number>;

    constructor() {
        super('zotflow');

        // Schema Definition
        this.version(1).stores({
            // Zotero Key
            keys: '&key',

            // Zotero Group
            groups: '&id',

            // Zotero Libraries
            libraries: '&id',

            // Zotero Collections
            collections: `
                &[libraryID+key], 
                trashed,
                name,
                parentCollection, 
                syncStatus,
                [libraryID+version]
            `,

            // Zotero Items
            items: `
                &[libraryID+key], 
                itemType, 
                parentItem, 
                trashed,
                *collections, 
                *searchCreators, 
                *searchTags, 
                dateModified, 
                syncStatus, 
                lastAccessedAt, 
                [libraryID+version]
            `,

            // Zotero Files
            files: '&[libraryID+key], lastAccessedAt',

            // Mutation Queue
            mutationQueue: '++id, libraryID, key'
        });
    }
}

export const db = new ZotFlowDB();