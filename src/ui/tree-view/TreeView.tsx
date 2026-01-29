import React, {
    useState,
    useRef,
    useLayoutEffect,
    useEffect,
    useMemo,
} from "react";
import { NodeApi, Tree } from "react-arborist";
import { workerBridge } from "bridge";
import { ObsidianIcon } from "./ObsidianIcon";
import { NodeItem, INDENT_SIZE } from "./Node";

import type { TreeTransferPayload } from "worker/services/tree-view";

// --- TYPES ---

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

export default function ZotFlowTreeView() {
    const [rawData, setRawData] = useState<TreeTransferPayload | null>(null);
    const [term, setTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dims, setDims] = useState({ w: 300, h: 500 });

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
                console.error("Failed to load tree", err);
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
            console.error("Failed to refresh tree", err);
        } finally {
            setLoading(false);
        }
    };

    const treeData = useMemo(() => {
        if (!rawData) return [];
        return rebuildTreeFromWorker(rawData);
    }, [rawData]);

    const handleSearch = (node: NodeApi<ViewNode>, term: string) => {
        const lowerTerm = term.toLowerCase();

        // ==================================================
        // Case A: Item (Parent Node)
        // ==================================================
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

        // ==================================================
        // Case B: Child Node (Source Note or PDF)
        // ==================================================
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

        // ==================================================
        // Case C: Standalone Attachment
        // ==================================================
        return node.data.name.toLowerCase().includes(lowerTerm);
    };

    return (
        <div className="zotflow-tree-view-layout">
            <div className="zotflow-tree-view-header">
                <div className="search-input-container global-search-input-container">
                    <input
                        className="zotflow-search-input"
                        placeholder="Search..."
                        type="search"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                    />
                    <div
                        className="search-input-clear-button"
                        aria-label="Clear search"
                        onClick={() => setTerm("")}
                    ></div>
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
}
