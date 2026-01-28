import type { NodeRendererProps } from "react-arborist";
import { Menu, Notice } from "obsidian";
import type { ViewNode } from "./TreeView";
import { ObsidianIcon } from "./ObsidianIcon";
import { getAttachmentFileIcon, getItemTypeIcon } from "ui/icons";
import { services } from "../../services/services";
import { workerBridge } from "bridge";

import { openAttachment } from "ui/viewer";

export const INDENT_SIZE = 20;

const Highlight = ({ text, term }: { text: string; term: string }) => {
    if (!term) return <>{text}</>;
    const parts = text.split(new RegExp(`(${term})`, "gi"));
    return (
        <>
            {parts.map((p, i) =>
                p.toLowerCase() === term.toLowerCase() ? (
                    <span key={i} className="search-result-file-matched-text">
                        {p}
                    </span>
                ) : (
                    p
                ),
            )}
        </>
    );
};

export const NodeItem = ({
    node,
    style,
    tree,
}: NodeRendererProps<ViewNode>) => {
    const { nodeType, name, children } = node.data;
    const isFolder = children.length > 0;

    if (nodeType === "spacer") {
        return <div style={style} className="zotflow-spacer" />;
    }

    // Icon Selection using Obsidian icons
    let iconName = "";
    switch (nodeType) {
        case "library":
            iconName = "landmark";
            break;
        case "collection":
            iconName = "folder";
            break;
        case "item":
            if (node.data.itemType === "attachment") {
                iconName = getAttachmentFileIcon(node.data.contentType);
            } else {
                iconName = getItemTypeIcon(node.data.itemType);
            }
            break;
    }

    const handleOnClick = (e: React.MouseEvent) => {
        node.toggle();
    };

    const handleDoubleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        node.toggle();

        if (nodeType === "item" && node.data.itemType === "attachment") {
            // Attachment: Open PDF
            await openAttachment(
                node.data.libraryID,
                node.data.key,
                services.app,
            );
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        node.select();

        const menu = new Menu();

        if (nodeType === "collection" || nodeType === "library") {
            menu.addItem((item) => {
                item.setTitle("Create source note for all items")
                    .setIcon("file-plus")
                    .onClick(async () => {
                        new Notice("Batch creation not fully implemented yet.");
                        // await services.note.batchCreateNotes([]);
                    });
            });
        } else if (
            nodeType === "item" &&
            node.data.itemType !== "attachment" &&
            node.data.itemType !== "note"
        ) {
            menu.addItem((item) => {
                item.setTitle("Open source note")
                    .setIcon("file-badge")
                    .onClick(async () => {
                        try {
                            await workerBridge.note.openNote(
                                node.data.libraryID,
                                node.data.key,
                            );
                        } catch (err) {
                            console.error("Failed to create/open note", err);
                        }
                    });
            });
            menu.addItem((item) => {
                item.setTitle("Force update note (with images)")
                    .setIcon("rotate-cw")
                    .onClick(async () => {
                        try {
                            await workerBridge.note.openNote(
                                node.data.libraryID,
                                node.data.key,
                                {
                                    forceUpdateContent: true,
                                    forceUpdateImages: true,
                                },
                            );
                        } catch (err) {
                            console.error("Failed to update note", err);
                        }
                    });
            });
        }

        if (
            nodeType === "collection" ||
            nodeType === "library" ||
            (nodeType === "item" && node.data.itemType !== "attachment")
        ) {
            menu.showAtMouseEvent(e.nativeEvent);
        }
    };

    const handleDragStart = (e: React.DragEvent) => {
        if (
            node.data.itemType === "attachment" &&
            node.data.contentType === "application/pdf"
        ) {
            const link = `[[${node.data.name}]]`;
            e.dataTransfer.setData("text/plain", link);
            e.dataTransfer.effectAllowed = "copy";
        }
    };

    return (
        <div
            style={style}
            className={`zotflow-node ${node.isSelected ? "selected" : ""}`}
            onClick={handleOnClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            draggable={node.data.itemType === "attachment"}
            onDragStart={handleDragStart}
        >
            {/* Indent Lines */}
            {Array.from({ length: node.level }).map((_, i) => (
                <div
                    key={i}
                    className="zotflow-indent-line"
                    style={{ left: `${i * INDENT_SIZE + 10}px` }}
                />
            ))}

            {/* Arrow */}
            <div className="zotflow-arrow-box">
                <ObsidianIcon
                    icon={node.isOpen ? "chevron-down" : "chevron-right"}
                    style={{
                        visibility: isFolder ? "visible" : "hidden",
                    }}
                />
            </div>

            {iconName !== "" && (
                <ObsidianIcon
                    icon={iconName}
                    className={
                        isFolder ? "zotflow-folder-icon" : "zotflow-file-icon"
                    }
                />
            )}
            <span
                style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                }}
            >
                <Highlight text={name} term={tree.props.searchTerm || ""} />
            </span>

            {/* File Tag */}
            {node.data.itemType === "attachment" && (
                <div className="nav-file-tag">
                    {node.data.name.split(".").pop()}
                </div>
            )}

            {/* Note Tag */}
            {node.data.itemType === "note" && (
                <div className="nav-file-tag">Note</div>
            )}
        </div>
    );
};
