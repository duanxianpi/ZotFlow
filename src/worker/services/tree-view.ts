export type EntityMap = Record<
    string,
    {
        name: string;
        itemType: string;
        libraryID: number;
        contentType?: string;
    }
>;

export type TopologyNode = {
    id: string; // UI Unique ID
    key: string; // Zotero Key (used to query entities)
    parentId: string | null; // Parent UI ID
    nodeType: "library" | "collection" | "item";
};

export type TreeTransferPayload = {
    entities: EntityMap;
    topology: TopologyNode[];
};

import { db, getCombinations } from "db/db";
import type { AnyIDBZoteroItem, IDBZoteroCollection } from "types/db-schema";
import type { ZotFlowSettings } from "settings/types";
import type { IParentProxy } from "bridge/types";
import { Zotero_Item_Types } from "types/zotero-item-const";

export class TreeViewService {
    private treeTransferPayload: TreeTransferPayload | null;

    constructor(
        private settings: ZotFlowSettings,
        private parentHost: IParentProxy,
    ) {}

    get tree() {
        return this.getOptimizedTree();
    }

    public updateSettings(settings: ZotFlowSettings) {
        this.settings = settings;
    }

    public async refreshTree() {
        this.treeTransferPayload = null;
        this.treeTransferPayload = await this.getOptimizedTree();
    }

    public async getOptimizedTree(): Promise<TreeTransferPayload> {
        if (this.treeTransferPayload) {
            return this.treeTransferPayload;
        }

        const keyInfo = await db.keys.get(this.settings.zoteroApiKey);
        if (!keyInfo) {
            this.parentHost.notify("error", "ZotFlow: Invalid Zotero API key.");
            return {
                entities: {},
                topology: [],
            };
        }

        // Filter Library
        const filteredLibraryIDs = keyInfo.joinedGroups
            .concat([keyInfo.userID])
            .filter(
                (id) =>
                    this.settings.librariesConfig[id]?.mode &&
                    this.settings.librariesConfig[id]?.mode !== "ignored",
            );

        // Valid Item Types
        const validItemTypes = Zotero_Item_Types.filter(
            (t) => t !== "annotation",
        );

        // Fetch all data
        const [libraries, allCollections, allItems] = await Promise.all([
            db.libraries.where("id").anyOf(filteredLibraryIDs).toArray(),
            db.collections
                .where(["libraryID", "trashed"])
                .anyOf(getCombinations([filteredLibraryIDs, [0]]))
                .toArray(),
            db.items
                .where(["libraryID", "itemType", "trashed"])
                .anyOf(
                    getCombinations([filteredLibraryIDs, validItemTypes, [0]]),
                )
                .filter((i) => i.trashed === 0)
                .toArray(),
        ]);

        // Index Construction (CPU)
        const collectionsByLib = new Map<number, IDBZoteroCollection[]>();
        allCollections.forEach((c) => {
            const list = collectionsByLib.get(c.libraryID) || [];
            list.push(c);
            collectionsByLib.set(c.libraryID, list);
        });

        // Group Items
        const itemsByCollection = new Map<string, AnyIDBZoteroItem[]>();
        const unfiledItemsByLib = new Map<number, AnyIDBZoteroItem[]>();
        const subItemsByParent = new Map<string, AnyIDBZoteroItem[]>();

        allItems.forEach((item) => {
            // Handle Sub-items
            if (["attachment", "note"].includes(item.itemType)) {
                if (item.parentItem) {
                    const list = subItemsByParent.get(item.parentItem) || [];
                    list.push(item);
                    subItemsByParent.set(item.parentItem, list);
                    return; // It is a sub-item, not processed separately
                }
            }

            // Handle Top-level Item
            const isInCollection =
                item.collections && item.collections.length > 0;

            if (isInCollection) {
                item.collections.forEach((colKey) => {
                    const list = itemsByCollection.get(colKey) || [];
                    list.push(item);
                    itemsByCollection.set(colKey, list);
                });
            } else {
                // Unfiled
                const list = unfiledItemsByLib.get(item.libraryID) || [];
                list.push(item);
                unfiledItemsByLib.set(item.libraryID, list);
            }
        });

        // Build Optimized Tree (Flattening & Separating)

        const entities: EntityMap = {};
        const topology: TopologyNode[] = [];

        // Helper: Register Entity Data (De-duplication)
        const registerEntity = (
            key: string,
            name: string,
            itemType: string,
            libraryID: number,
            contentType?: string,
        ) => {
            // Only register when the key is not registered
            if (!entities[key]) {
                entities[key] = { name, itemType, libraryID, contentType };
            }
        };

        // Recursive function: Process Item (and its attachments)
        const processItem = (item: AnyIDBZoteroItem, parentId: string) => {
            const itemId = `${parentId}-i-${item.key}`; // Construct unique UI ID
            const attachments = subItemsByParent.get(item.key) || [];

            // Register data
            // Add contentType for attachments
            if (item.itemType === "attachment") {
                registerEntity(
                    item.key,
                    item.title,
                    item.itemType,
                    item.libraryID,
                    item.raw.data.contentType,
                );
            } else {
                registerEntity(
                    item.key,
                    item.title,
                    item.itemType,
                    item.libraryID,
                );
            }

            // Push skeleton
            topology.push({
                id: itemId,
                key: item.key,
                parentId: parentId,
                nodeType: "item",
            });

            // Process attachments
            attachments.forEach((att) => {
                const attId = `${itemId}-att-${att.key}`;
                // Attachment name logic
                let attName = att.title;
                let attContentType;
                if (att.itemType === "attachment") {
                    attContentType = att.raw.data.contentType;
                }

                registerEntity(
                    att.key,
                    attName || "Untitled",
                    att.itemType,
                    att.libraryID,
                    attContentType,
                );

                topology.push({
                    id: attId,
                    key: att.key,
                    parentId: itemId,
                    nodeType: "item",
                });
            });
        };

        // Recursive function: Process Collection
        const processCollection = (
            col: IDBZoteroCollection,
            parentId: string,
            libCols: IDBZoteroCollection[],
        ) => {
            const colId = `col-${col.key}`;
            const childCols = libCols.filter(
                (c) => c.parentCollection === col.key,
            );
            const childItems = itemsByCollection.get(col.key) || [];

            registerEntity(col.key, col.name, "collection", col.libraryID);

            topology.push({
                id: colId,
                key: col.key,
                parentId: parentId,
                nodeType: "collection",
            });

            // Recursive call (Pre-order)
            childCols.forEach((c) => processCollection(c, colId, libCols));
            childItems.forEach((i) => processItem(i, colId));
        };

        // Entry: Iterate Libraries
        libraries.forEach((lib) => {
            const libId = `lib-${lib.id}`;
            const libCols = collectionsByLib.get(lib.id) || [];
            const topCols = libCols.filter((c) => !c.parentCollection);
            const unfiled = unfiledItemsByLib.get(lib.id) || [];

            const libName =
                lib.type === "user"
                    ? "My Library"
                    : lib.name || `Group ${lib.id}`;
            registerEntity(lib.id.toString(), libName, "library", lib.id);

            topology.push({
                id: libId,
                key: lib.id.toString(),
                parentId: null,
                nodeType: "library",
            });

            topCols.forEach((c) => processCollection(c, libId, libCols));
            unfiled.forEach((i) => processItem(i, libId));
        });

        this.treeTransferPayload = { entities, topology };
        return this.treeTransferPayload;
    }
}
