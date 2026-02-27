import React, {
    useState,
    useRef,
    useLayoutEffect,
    useEffect,
    useMemo,
    useCallback,
} from "react";
import { Menu } from "obsidian";
import { NodeApi, Tree } from "react-arborist";
import { workerBridge } from "bridge";
import { ObsidianIcon } from "../ObsidianIcon";
import { NodeItem, INDENT_SIZE } from "./Node";
import { services } from "services/services";

import type { TreeTransferPayload } from "worker/services/tree-view";
import type { CollectionSortOrder, ItemSortOrder } from "settings/types";

/* ================================================================ */
/*  Types                                                          */
/* ================================================================ */

/** Tree node representing a library, collection, item, or spacer in the tree view. */
export type ViewNode = {
    id: string;
    parent?: string | null;
    children: ViewNode[];
    name: string;
    itemType: string;
    contentType?: string;
    libraryID: number;
    libraryName: string;
    citationKey?: string;
    key: string;
    nodeType: "library" | "collection" | "item" | "spacer";
    dateAdded?: string;
    dateModified?: string;
};

function rebuildTreeFromWorker(payload: TreeTransferPayload): ViewNode[] {
    const { entities, topology } = payload;

    // Lookup table for quick parent node lookup
    const nodeMap = new Map<string, ViewNode>();

    // Root nodes collection
    const roots: ViewNode[] = [];

    // Single pass
    for (let i = 0; i < topology.length; i++) {
        const nodeRef = topology[i]!;

        // Get metadata O(1)
        const entity = entities[nodeRef.key];

        // If data is missing (extreme case), skip
        if (!entity) continue;

        // Create complete ViewNode object
        const node: ViewNode = {
            id: nodeRef.id,
            key: nodeRef.key,
            parent: nodeRef.parentId,
            nodeType: nodeRef.nodeType,

            // Mix in Entity data
            name: entity.name,
            itemType: entity.itemType,
            libraryID: entity.libraryID,
            libraryName: entity.libraryName,
            citationKey: entity.citationKey,
            contentType: entity.contentType,
            dateAdded: entity.dateAdded,
            dateModified: entity.dateModified,

            // Initialize Children
            children: [],
        };

        // Store in Map
        nodeMap.set(node.id, node);

        // Mount logic
        if (nodeRef.parentId) {
            // Since Worker is DFS generated, when processing child nodes, parent node must already be in Map
            const parent = nodeMap.get(nodeRef.parentId);
            if (parent) {
                parent.children.push(node);
            } else {
                // If parent node not found (possible data consistency issue), handle gracefully by placing at root
                roots.push(node);
            }
        } else {
            // No parentId means root node (Libraries)
            roots.push(node);
        }
    }

    // Add 1 spacer nodes at the bottom
    roots.push({
        id: `spacer`,
        key: `spacer`,
        parent: null,
        nodeType: "spacer",
        name: "",
        itemType: "",
        libraryName: "",
        libraryID: 0,
        children: [],
    });

    return roots;
}

/* ================================================================ */
/*  Sorting                                                        */
/* ================================================================ */

const COLLECTION_SORT_OPTIONS: {
    label: string;
    value: CollectionSortOrder;
}[] = [
    { label: "Name (A to Z)", value: "name-asc" },
    { label: "Name (Z to A)", value: "name-desc" },
];

const ITEM_SORT_OPTIONS: { label: string; value: ItemSortOrder }[] = [
    { label: "Title (A to Z)", value: "title-asc" },
    { label: "Title (Z to A)", value: "title-desc" },
    { label: "Modified time (new to old)", value: "modified-new" },
    { label: "Modified time (old to new)", value: "modified-old" },
    { label: "Created time (new to old)", value: "added-new" },
    { label: "Created time (old to new)", value: "added-old" },
];

/** Compare two strings using natural sort (numeric-aware, case-insensitive). */
function cmpStr(a: string, b: string): number {
    return a.localeCompare(b, undefined, {
        sensitivity: "base",
        numeric: true,
    });
}

/** Compare two ISO date strings. Missing dates sort last. */
function cmpDate(a: string | undefined, b: string | undefined): number {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Recursively sort every `children` array in-place-free (returns new arrays).
 * Libraries (roots) keep their original order.
 * Within a parent: collections always appear before items, then each group is
 * sorted independently by the matching sort order.
 * Spacers always stay at the end.
 */
function sortTree(
    roots: ViewNode[],
    collectionSort: CollectionSortOrder,
    itemSort: ItemSortOrder,
): ViewNode[] {
    const sortChildren = (nodes: ViewNode[]): ViewNode[] => {
        // Partition into collections, items, and spacers
        const collections: ViewNode[] = [];
        const items: ViewNode[] = [];
        const spacers: ViewNode[] = [];

        for (const n of nodes) {
            if (n.nodeType === "spacer") spacers.push(n);
            else if (n.nodeType === "collection") collections.push(n);
            else items.push(n);
        }

        // Sort collections by name
        const colDir = collectionSort === "name-asc" ? 1 : -1;
        collections.sort((a, b) => colDir * cmpStr(a.name, b.name));

        // Sort items
        items.sort((a, b) => {
            switch (itemSort) {
                case "title-asc":
                    return cmpStr(a.name, b.name);
                case "title-desc":
                    return -cmpStr(a.name, b.name);
                case "modified-new":
                    return -cmpDate(a.dateModified, b.dateModified);
                case "modified-old":
                    return cmpDate(a.dateModified, b.dateModified);
                case "added-new":
                    return -cmpDate(a.dateAdded, b.dateAdded);
                case "added-old":
                    return cmpDate(a.dateAdded, b.dateAdded);
                default:
                    return 0;
            }
        });

        // Recurse into children (collections have child collections + items)
        const sorted = [...collections, ...items, ...spacers];
        return sorted.map((node) => {
            if (node.children.length === 0) return node;
            return { ...node, children: sortChildren(node.children) };
        });
    };

    // For root level: keep library order, but sort each library's children
    return roots.map((root) => {
        if (root.nodeType === "spacer" || root.children.length === 0)
            return root;
        return { ...root, children: sortChildren(root.children) };
    });
}

/** Root React component for the Zotero library tree with search, refresh, and virtual scrolling. */
export const ZotFlowTree = () => {
    const [rawData, setRawData] = useState<TreeTransferPayload | null>(null);
    const [term, setTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dims, setDims] = useState({ w: 300, h: 500 });

    // Sort state — initialised from persisted settings
    const [collectionSort, setCollectionSort] = useState<CollectionSortOrder>(
        () => services.settings.treeCollectionSort,
    );
    const [itemSort, setItemSort] = useState<ItemSortOrder>(
        () => services.settings.treeItemSort,
    );

    // Resize Observer
    useLayoutEffect(() => {
        if (!containerRef.current) return;
        const obs = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setDims({
                    w: entry.contentRect.width,
                    h: entry.contentRect.height,
                });
            }
        });
        obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    useEffect(() => {
        const loadTree = async () => {
            setLoading(true);
            try {
                const flat = await workerBridge.treeView.getOptimizedTree();
                setRawData(flat);
            } catch (err) {
                services.logService.error(
                    "Failed to load tree",
                    "TreeView",
                    err,
                );
            } finally {
                setLoading(false);
            }
        };

        loadTree();
    }, []);

    // Prevent react-dnd from interfering with global events
    const voidElement = useMemo(() => document.createElement("div"), []);

    const handleRefresh = async () => {
        setLoading(true);
        try {
            await workerBridge.treeView.refreshTree();
            const flat = await workerBridge.treeView.getOptimizedTree();
            setRawData(flat);
        } catch (err) {
            services.logService.error(
                "Failed to refresh tree",
                "TreeView",
                err,
            );
        } finally {
            setLoading(false);
        }
    };

    /** Open the Obsidian-native sort menu with collection and item sort options. */
    const handleSortMenu = useCallback(
        (e: React.MouseEvent) => {
            const menu = new Menu();

            for (const opt of COLLECTION_SORT_OPTIONS) {
                menu.addItem((item) =>
                    item
                        .setTitle(`Collection: ${opt.label}`)
                        .setChecked(collectionSort === opt.value)
                        .setSection("collections")
                        .onClick(() => {
                            setCollectionSort(opt.value);
                            services.settings.treeCollectionSort = opt.value;
                            services.saveSettings();
                        }),
                );
            }

            for (const opt of ITEM_SORT_OPTIONS) {
                menu.addItem((item) =>
                    item
                        .setTitle(`Item: ${opt.label}`)
                        .setChecked(itemSort === opt.value)
                        .setSection("items")
                        .onClick(() => {
                            setItemSort(opt.value);
                            services.settings.treeItemSort = opt.value;
                            services.saveSettings();
                        }),
                );
            }

            menu.showAtMouseEvent(e.nativeEvent);
        },
        [collectionSort, itemSort],
    );

    const treeData = useMemo(() => {
        if (!rawData) return [];
        const tree = rebuildTreeFromWorker(rawData);
        return sortTree(tree, collectionSort, itemSort);
    }, [rawData, collectionSort, itemSort]);

    const handleSearch = (node: NodeApi<ViewNode>, term: string) => {
        const lowerTerm = term.toLowerCase();

        /* ================================================================ */
        /*  Case A: Item (Parent Node)                                     */
        /* ================================================================ */
        if (node.data.nodeType === "item") {
            // Does it match itself?
            if (node.data.name.toLowerCase().includes(lowerTerm)) return true;

            // Only "real attachments" count as a match, Source Note does not count
            if (node.data.children) {
                const hasValidChild = node.data.children.some((child) =>
                    child.name.toLowerCase().includes(lowerTerm),
                );
                if (hasValidChild) return true;
            }

            return false;
        }

        /* ================================================================ */
        /*  Case B: Child Node (Source Note or PDF)                        */
        /* ================================================================ */
        if (node.parent && node.parent.data.nodeType === "item") {
            const parent = node.parent;

            // Does the parent match?
            if (parent.data.name.toLowerCase().includes(lowerTerm)) {
                return true;
            }

            // Check if any sibling matches (or if I match myself)
            const hasValidSibling = parent.data.children.some((sibling) =>
                sibling.name.toLowerCase().includes(lowerTerm),
            );

            if (hasValidSibling) {
                return true;
            }

            return false;
        }

        /* ================================================================ */
        /*  Case C: Standalone Attachment                                  */
        /* ================================================================ */
        return node.data.name.toLowerCase().includes(lowerTerm);
    };

    return (
        <div className="zotflow-tree-view-layout">
            <div className="zotflow-tree-view-header">
                <div className="search-input-container global-search-input-container">
                    <input
                        placeholder="Search..."
                        type="search"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                    />
                    <div
                        aria-label="Clear search"
                        onClick={() => setTerm("")}
                    ></div>
                </div>
                <div
                    className="clickable-icon"
                    aria-label="Change sort order"
                    onClick={handleSortMenu}
                >
                    <ObsidianIcon icon="arrow-up-narrow-wide" />
                </div>
                <div
                    className="clickable-icon"
                    aria-label="Refresh Tree"
                    onClick={handleRefresh}
                >
                    <ObsidianIcon icon="rotate-cw" />
                </div>
            </div>
            <div className="zotflow-tree-view-container" ref={containerRef}>
                {loading && (
                    <div
                        style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            color: "var(--icon-color)",
                        }}
                    >
                        <ObsidianIcon icon="loader" className="zotflow-spin" />
                    </div>
                )}
                {!loading && (
                    <Tree
                        data={treeData}
                        width={dims.w}
                        height={dims.h}
                        rowHeight={28}
                        indent={INDENT_SIZE}
                        searchTerm={term}
                        searchMatch={handleSearch}
                        openByDefault={false}
                        disableDrag={true}
                        disableDrop={true}
                        disableMultiSelection={true}
                        dndRootElement={voidElement}
                    >
                        {NodeItem}
                    </Tree>
                )}
            </div>
        </div>
    );
};
