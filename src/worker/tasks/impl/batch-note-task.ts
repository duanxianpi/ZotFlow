import { BaseTask } from "../base";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";
import { db } from "db/db";

import type { NoteService, UpdateOptions } from "worker/services/note";
import type { TaskType } from "types/tasks";

/**
 * Input descriptor for batch note operations.
 * Items are queried from IDB at task start to ensure freshness.
 */
export interface BatchNoteInput {
    /** Library IDs to include. If empty, all synced libraries are used. */
    libraryIDs?: number[];
    /** Specific item keys. If provided, only these items are processed. */
    itemKeys?: string[];
}

/**
 * BatchNoteTask — handles both batch-create and batch-update note flows.
 *
 * - `batch-create-notes`: creates/updates notes without forcing content refresh.
 * - `batch-update-notes`: forces content refresh (template re-render) for every item.
 */
export class BatchNoteTask extends BaseTask {
    constructor(
        private noteService: NoteService,
        private input: BatchNoteInput,
        private options: UpdateOptions,
        type: TaskType = "batch-create-notes",
    ) {
        super(type);
    }

    protected async run(signal: AbortSignal): Promise<void> {
        // Resolve items to process
        const items = await this.resolveItems();

        if (items.length === 0) {
            this.reportProgress(0, 0, "No items to process");
            return;
        }

        const total = items.length;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < items.length; i++) {
            if (signal.aborted) throw new Error("Aborted");

            const item = items[i]!;
            const label = item.title || item.key;

            this.reportProgress(
                i,
                total,
                `Processing ${i + 1}/${total}: ${label}`,
            );

            try {
                await this.noteService.triggerUpdate(
                    item.libraryID,
                    item.key,
                    this.options,
                    false, // no debounce for batch operations
                );
                successCount++;
            } catch (e) {
                failCount++;
                // Log but don't abort — continue with remaining items
                this.log(
                    "error",
                    `Failed to update note for item ${item.key}: ${
                        e instanceof Error ? e.message : String(e)
                    }`,
                    "BatchNoteTask",
                    { itemKey: item.key, libraryID: item.libraryID },
                );
            }
        }

        // Store result summary
        this.result = { successCount, failCount };

        if (failCount > 0) {
            this.reportProgress(
                total,
                total,
                `Finished: ${successCount} success, ${failCount} failed`,
            );
        } else {
            this.reportProgress(total, total, "All notes processed");
        }
    }

    /**
     * Resolve the item list from database based on input descriptor.
     */
    private async resolveItems() {
        // If specific keys are provided, fetch those directly
        if (this.input.itemKeys && this.input.itemKeys.length > 0) {
            const libraryIDs = this.input.libraryIDs;
            if (!libraryIDs || libraryIDs.length === 0) {
                throw new ZotFlowError(
                    ZotFlowErrorCode.CONFIG_MISSING,
                    "BatchNoteTask",
                    "libraryIDs required when itemKeys specified",
                );
            }

            const items = [];
            for (const key of this.input.itemKeys) {
                for (const libID of libraryIDs) {
                    const item = await db.items.get([libID, key]);
                    if (item) {
                        items.push(item);
                        break; // found in this library, no need to check others
                    }
                }
            }
            return items;
        }

        // Otherwise, fetch all top-level items from specified libraries
        const libraryIDs =
            this.input.libraryIDs && this.input.libraryIDs.length > 0
                ? this.input.libraryIDs
                : (await db.libraries.toArray()).map((l) => l.id);

        const results = [];
        for (const libID of libraryIDs) {
            // Top-level, non-trashed items (exclude attachments and annotations)
            const items = await db.items
                .where({
                    libraryID: libID,
                    parentItem: "",
                    itemType: "journalArticle",
                    trashed: 0,
                })
                .toArray();

            // Also include other top-level item types (book, thesis, etc.)
            // Use a broader query: parentItem="" and trashed=0, then filter
            const allTopLevel = await db.items
                .where("[libraryID+parentItem+itemType+trashed]")
                .between([libID, "", "", 0], [libID, "", "\uffff", 0])
                .toArray();

            // Exclude attachments and annotations (they are child items)
            const filtered = allTopLevel.filter(
                (item) =>
                    item.itemType !== "attachment" &&
                    item.itemType !== "annotation" &&
                    item.itemType !== "note",
            );

            results.push(...filtered);
        }

        return results;
    }
}
