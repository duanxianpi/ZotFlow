import Dexie, { Table } from "dexie";
import {
    IDBZoteroFile,
    IDBZoteroCollection,
    IDBZoteroLibrary,
    AnyIDBZoteroItem,
    IDBZoteroKey,
    IDBZoteroGroup,
} from "types/db-schema";

export class ZotFlowDB extends Dexie {
    keys!: Table<IDBZoteroKey, string>;
    groups!: Table<IDBZoteroGroup, number>;
    items!: Table<AnyIDBZoteroItem, [number, string]>;
    collections!: Table<IDBZoteroCollection, [number, string]>;
    libraries!: Table<IDBZoteroLibrary, number>;
    files!: Table<IDBZoteroFile, [number, string]>;

    constructor() {
        super("zotflow-dev");

        // Schema Definition
        this.version(1).stores({
            // Zotero Key
            keys: "&key",

            // Zotero Group
            groups: "&id",

            // Zotero Libraries
            libraries: "&id",

            // Zotero Collections
            collections: `
                &[libraryID+key], 
                [libraryID+parentCollection],
                [libraryID+syncStatus],
                [libraryID+trashed]
            `,

            // Zotero Items
            items: `
                &[libraryID+key], 
                [libraryID+syncStatus],
                [libraryID+itemType+trashed],
                [libraryID+parentItem+itemType+trashed],
                *collections, 
                *searchCreators, 
                *searchTags, 
                lastAccessedAt,
                dateModified
            `,

            // Zotero Files
            files: "&[libraryID+key], md5, lastAccessedAt",
        });
    }
}

/**
 * Generate the Cartesian product of an array of arrays.
 * @param {Array<Array<any>>} arrays - The input array of arrays, e.g. [[1, 2], ['a', 'b']]
 * @returns {Array<Array<any>>} - All possible combinations
 */
export function getCombinations(arrays: any[][]) {
    return arrays.reduce(
        (acc, currList) => {
            return acc.flatMap((prevCombination) => {
                return currList.map((item) => {
                    return [...prevCombination, item];
                });
            });
        },
        [[]],
    );
}

export const db = new ZotFlowDB();
