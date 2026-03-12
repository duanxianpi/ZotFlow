/**
 * Render Template — renders a Liquid template using the `item` context
 * and writes the result to `note.content` and `note.path`.
 *
 * The user configures:
 *   - `templatePath`: vault path to a `.md` template (empty = default)
 *   - `outputPath`: output file path pattern with template expressions
 *
 * Reads `item.*` from context (populated by Fetch Item node).
 */

import { Type } from "@sinclair/typebox";

import { workerBridge } from "bridge";
import { interpolate } from "../../context/interpolate";
import { getNotePath } from "utils/utils";
import {
    PropertySection,
    PropertyField,
    PropertyInput,
} from "../../properties/PropertyControls";
import type { BaseNodeData, NodePropertiesProps, NodeType } from "../../types";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface RenderTemplateNodeData extends BaseNodeData {
    templatePath: string; // vault path to template file (empty = default)
    outputPath: string; // output path pattern, e.g. "Sources/{{item.citationKey}}.md"
}

// ---------------------------------------------------------------------------
// Context output schema
// ---------------------------------------------------------------------------

const RENDER_OUTPUTS = Type.Object({
    note: Type.Object({
        content: Type.String({ description: "Rendered note markdown" }),
        path: Type.String({ description: "Output file path" }),
    }),
});

// ---------------------------------------------------------------------------
// Properties panel
// ---------------------------------------------------------------------------

function RenderTemplateProperties({
    nodeId,
    data,
    updateData,
}: NodePropertiesProps) {
    const d = data as unknown as RenderTemplateNodeData;

    return (
        <>
            <PropertySection title="Template">
                <PropertyField
                    label="Template Path"
                    htmlFor="render-template-path"
                >
                    <PropertyInput
                        contextNodeId={nodeId}
                        value={d.templatePath}
                        placeholder="Leave empty for default template"
                        onChange={(e) =>
                            updateData({ templatePath: e.target.value })
                        }
                    />
                </PropertyField>
            </PropertySection>
            <PropertySection title="Output">
                <PropertyField
                    label="Output Path"
                    htmlFor="render-output-path"
                >
                    <PropertyInput
                        contextNodeId={nodeId}
                        value={d.outputPath}
                        placeholder="e.g. Sources/{{item.citationKey}}.md"
                        onChange={(e) =>
                            updateData({ outputPath: e.target.value })
                        }
                    />
                </PropertyField>
            </PropertySection>
        </>
    );
}

// ---------------------------------------------------------------------------
// Node type definition
// ---------------------------------------------------------------------------

export const renderTemplateNode: NodeType<RenderTemplateNodeData> = {
    type: "render-template",
    category: "action",
    displayName: "Render Template",
    icon: "file-text",
    description: "Renders a Liquid template with the item context",

    contextOutputs: RENDER_OUTPUTS,

    defaultData: {
        label: "Render Template",
        templatePath: "",
        outputPath: "",
    },

    Properties: RenderTemplateProperties,

    validate(data) {
        const errors: string[] = [];
        if (!data.outputPath.trim()) errors.push("Output Path is required.");
        return errors;
    },

    async execute(context, data, _signal) {
        // Read item context from upstream
        const item = context.get("item") as Record<string, unknown> | undefined;

        if (!item || !item.key) {
            throw new Error(
                "Render Template: 'item' context is missing. Add a Fetch Item node upstream.",
            );
        }

        // Resolve output path (interpolate template expressions)
        let outputPath: string;
        if (data.outputPath.trim()) {
            outputPath = String(interpolate(data.outputPath, context));
        } else {
            // Fallback: compute from item context using getNotePath
            outputPath = getNotePath({
                citationKey: item.citationKey as string,
                title: item.title as string,
                key: item.key as string,
                sourceNoteFolder: "Sources",
                libraryName: (item.libraryName as string) || "Unknown",
            });
        }

        // Normalize path extension
        if (!outputPath.endsWith(".md")) {
            outputPath += ".md";
        }

        // Read template file content (null = use default)
        let templateContent: string | null = null;
        if (data.templatePath.trim()) {
            templateContent = await workerBridge.readTextFile(
                data.templatePath.trim(),
            );
        }

        // Check existing file for frontmatter preservation
        const fileCheck = await workerBridge.checkFile(outputPath);
        const existingFrontmatter =
            fileCheck.exists && fileCheck.frontmatter
                ? fileCheck.frontmatter
                : {};

        // Render via worker
        const content = await workerBridge.renderNoteFromContext(
            item as any,
            templateContent,
            existingFrontmatter,
        );

        // Write outputs to context
        context.set("note", {
            content,
            path: outputPath,
        });

        return "flow-out";
    },
};
