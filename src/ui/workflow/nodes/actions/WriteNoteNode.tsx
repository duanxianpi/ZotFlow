/**
 * Write Note — writes the rendered note content to the vault.
 *
 * Reads `note.content` and `note.path` from context (populated by
 * Render Template node). Creates or overwrites the target file.
 */

import { Type } from "@sinclair/typebox";

import { workerBridge } from "bridge";
import { interpolate } from "../../context/interpolate";
import {
    PropertySection,
    PropertyField,
    PropertyInput,
} from "../../properties/PropertyControls";
import type { BaseNodeData, NodePropertiesProps, NodeType } from "../../types";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface WriteNoteNodeData extends BaseNodeData {
    contentExpr: string; // template expression for content, default "{{note.content}}"
    pathExpr: string; // template expression for path, default "{{note.path}}"
}

// ---------------------------------------------------------------------------
// Properties panel
// ---------------------------------------------------------------------------

function WriteNoteProperties({
    nodeId,
    data,
    updateData,
}: NodePropertiesProps) {
    const d = data as unknown as WriteNoteNodeData;

    return (
        <PropertySection title="Configuration">
            <PropertyField label="File Path" htmlFor="write-note-path">
                <PropertyInput
                    contextNodeId={nodeId}
                    value={d.pathExpr}
                    placeholder="{{note.path}}"
                    onChange={(e) => updateData({ pathExpr: e.target.value })}
                />
            </PropertyField>
            <PropertyField label="Content" htmlFor="write-note-content">
                <PropertyInput
                    contextNodeId={nodeId}
                    value={d.contentExpr}
                    placeholder="{{note.content}}"
                    onChange={(e) =>
                        updateData({ contentExpr: e.target.value })
                    }
                />
            </PropertyField>
        </PropertySection>
    );
}

// ---------------------------------------------------------------------------
// Node type definition
// ---------------------------------------------------------------------------

export const writeNoteNode: NodeType<WriteNoteNodeData> = {
    type: "write-note",
    category: "action",
    displayName: "Write Note",
    icon: "save",
    description: "Writes rendered content to a vault file",

    contextOutputs: Type.Object({}),

    defaultData: {
        label: "Write Note",
        contentExpr: "{{note.content}}",
        pathExpr: "{{note.path}}",
    },

    Properties: WriteNoteProperties,

    validate(data) {
        const errors: string[] = [];
        if (!data.pathExpr.trim()) errors.push("File Path is required.");
        if (!data.contentExpr.trim()) errors.push("Content is required.");
        return errors;
    },

    async execute(context, data, _signal) {
        const content = String(interpolate(data.contentExpr, context) ?? "");
        const path = String(interpolate(data.pathExpr, context) ?? "");

        if (!path) {
            throw new Error("Write Note: file path resolved to empty string.");
        }

        // Check if file already exists
        const fileCheck = await workerBridge.checkFile(path);

        if (!fileCheck.exists) {
            // Create empty file first, then index, then write content
            await workerBridge.writeTextFile(path, "");
            await workerBridge.indexFile(path);
        }

        // Write (create or overwrite) the file
        await workerBridge.writeTextFile(path, content);

        return "flow-out";
    },
};
