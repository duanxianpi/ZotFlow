import { BaseTask } from "../base";
import type { SyncService } from "worker/services/sync";

export class SyncTask extends BaseTask {
    constructor(private syncService: SyncService) {
        super("sync");
    }

    protected async run(signal: AbortSignal): Promise<void> {
        this.reportProgress(0, 1, "Starting sync...");

        await this.syncService.startSync(
            signal,
            (completed, total, message) => {
                this.reportProgress(completed, total, message);
            },
        );
    }
}
