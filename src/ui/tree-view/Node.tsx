import type { NodeRendererProps } from "react-arborist";
import { Menu, Notice, setIcon } from "obsidian";
import type { ViewNode } from "./TreeView";
import { ObsidianIcon } from "./ObsidianIcon";
import { getAttachmentFileIcon, getItemTypeIcon } from "ui/icons";
import { services } from "services/services";
import { workerBridge } from "bridge";

import { openAttachment } from "ui/viewer";
import { getNotePath } from "utils/utils";

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
    const isTopLevelItem =
        nodeType === "item" &&
        (node.parent?.data.nodeType === "library" ||
            node.parent?.data.nodeType === "collection");
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
        console.log("node", node);

        if (nodeType === "collection" || nodeType === "library") {
            menu.addItem((item) => {
                item.setTitle("Create source note for all items")
                    .setIcon("file-plus")
                    .onClick(async () => {
                        new Notice("Batch creation not fully implemented yet.");
                        // await services.note.batchCreateNotes([]);
                    });
            });
        } else if (isTopLevelItem && node.data.itemType !== "note") {
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
            (isTopLevelItem && node.data.itemType !== "note")
        ) {
            menu.showAtMouseEvent(e.nativeEvent);
        }
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        let link = "";
        let dragText = "";
        if (node.data.itemType === "attachment") {
            const url = `obsidian://zotflow?type=open-attachment&libraryID=${node.data.libraryID}&key=${node.data.key}`;
            link = `[${node.data.name}](${url})`;
            dragText = node.data.name;
        } else if (nodeType === "item" && node.data.itemType !== "attachment") {
            // Try force update the source note
            workerBridge.note.triggerUpdate(node.data.libraryID, node.data.key);

            const file = services.indexService.getFileByKey(node.data.key);
            if (file) {
                link = services.app.fileManager.generateMarkdownLink(
                    file,
                    "",
                    "",
                    file.name.split(".").shift(),
                );
                dragText = file.name;
            } else {
                const path = getNotePath({
                    citationKey: node.data.citationKey,
                    title: node.data.name,
                    key: node.data.key,
                    sourceNoteFolder: services.settings.sourceNoteFolder,
                    libraryName: node.data.libraryName,
                });
                console.log({
                    citationKey: node.data.citationKey,
                    title: node.data.name,
                    key: node.data.key,
                    sourceNoteFolder: services.settings.sourceNoteFolder,
                    libraryName: node.data.libraryName,
                });
                const filename = path.split("/").pop()!;
                const alias = filename.split(".").shift()!;
                link = `[[${path}|${alias}]]`;
                dragText = filename;
            }
        }

        // Custom Drag Ghost using Obsidian classes
        const ghost = document.createElement("div");
        ghost.addClass("drag-ghost");

        const self = document.createElement("div");
        self.addClass("drag-ghost-self");

        let iconName = "";
        if (nodeType === "library") iconName = "landmark";
        else if (nodeType === "collection") iconName = "folder";
        else if (node.data.itemType === "attachment") {
            iconName = getAttachmentFileIcon(node.data.contentType);
        } else {
            iconName = getItemTypeIcon(node.data.itemType);
        }

        setIcon(self, iconName || "file");

        const titleSpan = document.createElement("span");
        titleSpan.textContent = dragText || "Untitled";

        self.appendChild(titleSpan);

        const action = document.createElement("div");
        action.addClass("drag-ghost-action");
        action.textContent = "Insert link here";

        ghost.appendChild(self);
        ghost.appendChild(action);

        document.body.appendChild(ghost);

        // Set data for drag
        e.dataTransfer.setData("text/plain", link);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        e.dataTransfer.effectAllowed = "copy";

        // requestAnimationFrame(() => {
        //     document.body.removeChild(ghost);
        // });
    };

    return (
        <div
            style={style}
            className={`zotflow-node ${node.isSelected ? "selected" : ""}`}
            onClick={handleOnClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            draggable={nodeType === "item" && node.data.itemType !== "note"}
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
