/**
 * Fetch Item — retrieves a Zotero item from the local database and
 * writes the full `ItemTemplateContext` into the workflow context under
 * the `item` namespace.
 *
 * Reads `trigger.libraryID` and `trigger.itemKey` from context.
 */

import { Type } from "@sinclair/typebox";

import { workerBridge } from "bridge";
import { interpolate } from "../../context/interpolate";
import { extractPaths } from "../../context/schema";
import {
    PropertySection,
    PropertyField,
    PropertyInput,
} from "../../properties/PropertyControls";
import type { BaseNodeData, NodePropertiesProps, NodeType } from "../../types";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface FetchItemNodeData extends BaseNodeData {
    libraryID: string; // template expression, e.g. "{{trigger.libraryID}}"
    itemKey: string; // template expression, e.g. "{{trigger.itemKey}}"
}

// ---------------------------------------------------------------------------
// Context output schema
// ---------------------------------------------------------------------------

const TAG_SCHEMA = Type.Object({
    tag: Type.String(),
    type: Type.Optional(Type.Number()),
});

const ANNOTATION_SCHEMA = Type.Object({
    key: Type.String(),
    libraryID: Type.Number(),
    type: Type.String(),
    authorName: Type.Optional(Type.String()),
    text: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    comment: Type.Optional(Type.String()),
    color: Type.Optional(Type.String()),
    pageLabel: Type.Optional(Type.String()),
    tags: Type.Array(TAG_SCHEMA),
    dateAdded: Type.String(),
    dateModified: Type.String(),
});

const ATTACHMENT_SCHEMA = Type.Object({
    key: Type.String(),
    libraryID: Type.Number(),
    title: Type.Optional(Type.String()),
    contentType: Type.Optional(Type.String()),
    filename: Type.Optional(Type.String()),
    tags: Type.Array(TAG_SCHEMA),
    dateAdded: Type.String(),
    dateModified: Type.String(),
    annotations: Type.Array(ANNOTATION_SCHEMA),
});

const NOTE_SCHEMA = Type.Object({
    key: Type.String(),
    libraryID: Type.Number(),
    note: Type.String(),
    title: Type.String(),
    tags: Type.Array(TAG_SCHEMA),
    dateAdded: Type.String(),
    dateModified: Type.String(),
});

const CREATOR_SCHEMA = Type.Object({
    creatorType: Type.Optional(Type.String()),
    firstName: Type.Optional(Type.String()),
    lastName: Type.Optional(Type.String()),
    name: Type.Optional(Type.String()),
});

const ITEM_OUTPUTS = Type.Object({
    item: Type.Object({
        key: Type.String(),
        version: Type.Number(),
        citationKey: Type.String(),
        libraryID: Type.Number(),
        libraryName: Type.String(),
        itemType: Type.String(),
        title: Type.String(),
        creators: Type.Array(CREATOR_SCHEMA),
        date: Type.Union([Type.String(), Type.Null()]),
        dateAdded: Type.String(),
        dateModified: Type.String(),
        abstractNote: Type.Optional(Type.String()),
        publicationTitle: Type.Optional(Type.String()),
        publisher: Type.Optional(Type.String()),
        place: Type.Optional(Type.String()),
        volume: Type.Optional(Type.String()),
        issue: Type.Optional(Type.String()),
        pages: Type.Optional(Type.String()),
        series: Type.Optional(Type.String()),
        seriesNumber: Type.Optional(Type.String()),
        edition: Type.Optional(Type.String()),
        url: Type.Optional(Type.String()),
        DOI: Type.Optional(Type.String()),
        ISBN: Type.Optional(Type.String()),
        ISSN: Type.Optional(Type.String()),
        tags: Type.Array(TAG_SCHEMA),
        attachments: Type.Array(ATTACHMENT_SCHEMA),
        annotations: Type.Array(ANNOTATION_SCHEMA),
        attachmentAnnotations: Type.Array(ANNOTATION_SCHEMA),
        notes: Type.Array(NOTE_SCHEMA),
    }),
});

// ---------------------------------------------------------------------------
// Properties panel
// ---------------------------------------------------------------------------

function FetchItemProperties({
    nodeId,
    data,
    updateData,
}: NodePropertiesProps) {
    const d = data as unknown as FetchItemNodeData;
    const paths = extractPaths(ITEM_OUTPUTS);
    const leaves = paths.filter((p) => p.type !== "object");

    return (
        <>
            <PropertySection title="Input">
                <PropertyField label="Library ID" htmlFor="fetch-item-lib">
                    <PropertyInput
                        contextNodeId={nodeId}
                        value={d.libraryID}
                        placeholder="{{trigger.libraryID}}"
                        onChange={(e) =>
                            updateData({ libraryID: e.target.value })
                        }
                    />
                </PropertyField>
                <PropertyField label="Item Key" htmlFor="fetch-item-key">
                    <PropertyInput
                        contextNodeId={nodeId}
                        value={d.itemKey}
                        placeholder="{{trigger.itemKey}}"
                        onChange={(e) =>
                            updateData({ itemKey: e.target.value })
                        }
                    />
                </PropertyField>
            </PropertySection>

            <PropertySection title="Context Outputs">
                {leaves.slice(0, 10).map((p) => (
                    <PropertyField key={p.path} label={p.path} readOnly>
                        <span>
                            {p.type}
                            {p.optional ? " (optional)" : ""}
                        </span>
                    </PropertyField>
                ))}
                {leaves.length > 10 && (
                    <PropertyField label="" readOnly>
                        <span className="zotflow-wf-text-muted">
                            … and {leaves.length - 10} more
                        </span>
                    </PropertyField>
                )}
            </PropertySection>
        </>
    );
}

// ---------------------------------------------------------------------------
// Node type definition
// ---------------------------------------------------------------------------

export const fetchItemNode: NodeType<FetchItemNodeData> = {
    type: "fetch-item",
    category: "action",
    displayName: "Fetch Item",
    icon: "download",
    description: "Fetches a Zotero item and writes it to context",

    contextOutputs: ITEM_OUTPUTS,

    defaultData: {
        label: "Fetch Item",
        libraryID: "{{trigger.libraryID}}",
        itemKey: "{{trigger.itemKey}}",
    },

    Properties: FetchItemProperties,

    validate(data) {
        const errors: string[] = [];
        if (!data.libraryID.trim()) errors.push("Library ID is required.");
        if (!data.itemKey.trim()) errors.push("Item Key is required.");
        return errors;
    },

    async execute(context, data, _signal) {
        const libraryID = Number(interpolate(data.libraryID, context));
        const itemKey = String(interpolate(data.itemKey, context));

        if (!libraryID || !itemKey) {
            throw new Error(
                "Fetch Item: libraryID and itemKey are required at runtime.",
            );
        }

        const itemContext = await workerBridge.getItemContext(
            libraryID,
            itemKey,
        );

        // Write the full item context into the workflow context
        context.set("item", itemContext);

        return "flow-out";
    },
};
