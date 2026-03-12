/**
 * Save Annotation Images — extracts ink/image annotations from PDF
 * attachments and saves them as PNG files to the configured image folder.
 *
 * Reads `trigger.libraryID` and `trigger.itemKey` from context.
 * This is a side-effect-only node (no context outputs).
 */

import { Type } from "@sinclair/typebox";

import { workerBridge } from "bridge";
import { interpolate } from "../../context/interpolate";
import {
    PropertySection,
    PropertyField,
    PropertyInput,
    PropertyCheckbox,
} from "../../properties/PropertyControls";
import type { BaseNodeData, NodePropertiesProps, NodeType } from "../../types";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface SaveAnnotationImagesNodeData extends BaseNodeData {
    libraryID: string; // template expression
    itemKey: string; // template expression
    forceUpdate: boolean;
}

// ---------------------------------------------------------------------------
// Properties panel
// ---------------------------------------------------------------------------

function SaveAnnotationImagesProperties({
    nodeId,
    data,
    updateData,
}: NodePropertiesProps) {
    const d = data as unknown as SaveAnnotationImagesNodeData;

    return (
        <PropertySection title="Configuration">
            <PropertyField label="Library ID" htmlFor="save-images-lib">
                <PropertyInput
                    contextNodeId={nodeId}
                    value={d.libraryID}
                    placeholder="{{trigger.libraryID}}"
                    onChange={(e) =>
                        updateData({ libraryID: e.target.value })
                    }
                />
            </PropertyField>
            <PropertyField label="Item Key" htmlFor="save-images-key">
                <PropertyInput
                    contextNodeId={nodeId}
                    value={d.itemKey}
                    placeholder="{{trigger.itemKey}}"
                    onChange={(e) =>
                        updateData({ itemKey: e.target.value })
                    }
                />
            </PropertyField>
            <PropertyField
                label="Force re-render all images"
                htmlFor="save-images-force"
            >
                <PropertyCheckbox
                    checked={d.forceUpdate}
                    onChange={(e) =>
                        updateData({ forceUpdate: e.target.checked })
                    }
                />
            </PropertyField>
        </PropertySection>
    );
}

// ---------------------------------------------------------------------------
// Node type definition
// ---------------------------------------------------------------------------

export const saveAnnotationImagesNode: NodeType<SaveAnnotationImagesNodeData> =
    {
        type: "save-annotation-images",
        category: "action",
        displayName: "Save Annotation Images",
        icon: "image",
        description: "Extracts and saves ink/image annotation PNGs",

        contextOutputs: Type.Object({}),

        defaultData: {
            label: "Save Annotation Images",
            libraryID: "{{trigger.libraryID}}",
            itemKey: "{{trigger.itemKey}}",
            forceUpdate: false,
        },

        Properties: SaveAnnotationImagesProperties,

        validate(data) {
            const errors: string[] = [];
            if (!data.libraryID.trim())
                errors.push("Library ID is required.");
            if (!data.itemKey.trim()) errors.push("Item Key is required.");
            return errors;
        },

        async execute(context, data, _signal) {
            const libraryID = Number(interpolate(data.libraryID, context));
            const itemKey = String(interpolate(data.itemKey, context));

            if (!libraryID || !itemKey) {
                throw new Error(
                    "Save Annotation Images: libraryID and itemKey are required.",
                );
            }

            await workerBridge.extractAnnotationImagesForItem(
                libraryID,
                itemKey,
                data.forceUpdate,
            );

            return "flow-out";
        },
    };
