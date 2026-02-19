import { BaseTask } from "../base";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";

import type { AttachmentService } from "worker/services/attachment";
import type { IDBZoteroItem } from "types/db-schema";
import type { AttachmentData } from "types/zotero-item";

/**
 * Input for download attachment task.
 */
export interface DownloadAttachmentInput {
    libraryID: number;
    itemKey: string;
}

/**
 * DownloadAttachmentTask — wraps AttachmentService.getFileBlob() as a tracked background task.
 *
 * Progress is reported as a 3-step flow: validating → downloading → complete.
 * The resulting Blob is stored internally and can be retrieved via `getBlob()`
 * after the task completes.
 */
export class DownloadAttachmentTask extends BaseTask {
    private blob: Blob | null = null;

    constructor(
        private attachmentService: AttachmentService,
        private attachmentItem: IDBZoteroItem<AttachmentData>,
    ) {
        super("download-attachment");
    }

    protected async run(signal: AbortSignal): Promise<void> {
        const filename =
            this.attachmentItem.raw.data.filename || this.attachmentItem.key;

        this.reportProgress(0, 2, `Downloading ${filename}...`);

        if (signal.aborted) throw new Error("Aborted");

        try {
            const blob = await this.attachmentService.getFileBlob(
                this.attachmentItem,
            );

            if (signal.aborted) throw new Error("Aborted");

            if (!blob) {
                throw new ZotFlowError(
                    ZotFlowErrorCode.RESOURCE_MISSING,
                    "DownloadAttachmentTask",
                    `Failed to download ${filename}`,
                );
            }

            this.blob = blob;
            this.reportProgress(2, 2, `Downloaded ${filename}`);
            this.result = { successCount: 1, failCount: 0 };
        } catch (e) {
            if (signal.aborted) throw new Error("Aborted");
            this.result = { successCount: 0, failCount: 1 };
            throw e;
        }
    }

    /**
     * Retrieve the downloaded blob after task completion.
     * Returns null if the task hasn't completed successfully.
     */
    public getBlob(): Blob | null {
        return this.blob;
    }
}
