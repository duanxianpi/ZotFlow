import { BaseTask } from "../base";
import type { SyncService } from "worker/services/sync";
import type { TaskStatus } from "types/tasks";

export class SyncTask extends BaseTask {
    constructor(private syncService: SyncService) {
        super("sync");
        this.displayText = "Syncing Libraries";
    }

    protected async run(signal: AbortSignal): Promise<void> {
        this.reportProgress(0, 1, "Starting sync...");

        const { successCount, failCount } = await this.syncService.startSync(
            signal,
            (completed, total, message) => {
                this.reportProgress(completed, total, message);
            },
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
