import { BaseTask } from "../base";
import { db } from "db/db";
import type { SyncService } from "worker/services/sync";
import type { TaskStatus } from "types/tasks";

export class SyncTask extends BaseTask {
    constructor(
        private syncService: SyncService,
        private libraryId?: number,
    ) {
        super("sync");
        this.displayText = libraryId
            ? `Syncing Library ${libraryId}`
            : "Syncing Libraries";
    }

    protected async run(signal: AbortSignal): Promise<void> {
        // Populate input context for Activity Center display
        if (this.libraryId !== undefined) {
            const lib = await db.libraries.get(this.libraryId);
            this.taskInput = {
                library: lib?.name ?? String(this.libraryId),
                libraryId: this.libraryId,
            };
            if (lib) {
                this.displayText = `Syncing: ${lib.name}`;
            }
        } else {
            this.taskInput = { scope: "all" };
        }

        this.reportProgress(0, 1, "Starting sync...");

        const { successCount, failCount } = await this.syncService.startSync(
            signal,
            (completed, total, message) => {
                this.reportProgress(completed, total, message);
            },
            this.libraryId,
        );

        this.result = {
            successCount,
            failCount,
            details: {
                libraries: successCount + failCount,
                synced: successCount,
                failed: failCount,
            },
        };
    }

    protected getTerminalDisplayText(status: TaskStatus): string {
        if (status === "cancelled") return "Sync — Cancelled";
        if (status === "failed") return "Sync — Failed";
        const r = this.result;
        if (r && r.failCount > 0) {
            return `Synced ${r.successCount} libraries (${r.failCount} failed)`;
        }
        return `Synced ${r?.successCount ?? 0} libraries`;
    }
}
