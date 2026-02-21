import type { IParentProxy } from "bridge/types";
import type { BaseTask } from "./base";
import type { ITaskInfo } from "types/tasks";
import type { SyncService } from "worker/services/sync";
import type { NoteService, UpdateOptions } from "worker/services/note";
import type { AttachmentService } from "worker/services/attachment";
import type { PDFProcessWorker } from "worker/services/pdf-processor";
import type { ZotFlowSettings } from "settings/types";
import type { BatchNoteInput } from "./impl/batch-note-task";
import type { BatchExtractImagesInput } from "./impl/batch-extract-images-task";
import type { BatchExtractExternalAnnotationsInput } from "./impl/batch-extract-external-annotations-task";
import type { IDBZoteroItem } from "types/db-schema";
import type { AttachmentData } from "types/zotero-item";
import type { AnnotationJSON } from "types/zotero-reader";

export class TaskManager {
    private tasks: Map<string, BaseTask> = new Map();
    private activeControllers: Map<string, AbortController> = new Map();

    constructor(private parentHost: IParentProxy) {}

    public registerTask(task: BaseTask) {
        // cleanup old tasks (simple policy: keep max 50)
        if (this.tasks.size > 50) {
            const oldest = this.tasks.keys().next().value;
            if (oldest) this.tasks.delete(oldest);
        }

        this.tasks.set(task.id, task);

        // Bind update
        task.onUpdate = (info: ITaskInfo) => {
            this.parentHost.onTaskUpdate(task.id, info);
        };

        // Initial update
        this.parentHost.onTaskUpdate(task.id, task.getInfo());
    }

    public async startTask(task: BaseTask) {
        this.registerTask(task);

        const controller = new AbortController();
        this.activeControllers.set(task.id, controller);

        // Run without awaiting (fire and forget from manager perspective)
        task.execute(controller.signal).finally(() => {
            this.activeControllers.delete(task.id);
        });

        return task.id;
    }

    public cancelTask(taskId: string) {
        const controller = this.activeControllers.get(taskId);
        if (controller) {
            controller.abort();
        }
    }

    // ================================================================
    // Factory methods (dynamic imports to avoid circular deps)
    // ================================================================

    public async createTestTask(duration: number) {
        const { TestTask } = await import("./impl/test-task");
        const task = new TestTask(duration);
        return this.startTask(task);
    }

    public async createSyncTask(syncService: SyncService, libraryId?: number) {
        const { SyncTask } = await import("./impl/sync-task");
        const task = new SyncTask(syncService, libraryId);
        return this.startTask(task);
    }

    public async createBatchNoteTask(
        noteService: NoteService,
        input: BatchNoteInput,
        options: UpdateOptions,
        isUpdate: boolean,
    ) {
        const { BatchNoteTask } = await import("./impl/batch-note-task");
        const type = isUpdate ? "batch-update-notes" : "batch-create-notes";
        const task = new BatchNoteTask(noteService, input, options, type);
        return this.startTask(task);
    }

    public async createBatchExtractImagesTask(
        attachmentService: AttachmentService,
        pdfProcessor: PDFProcessWorker,
        settings: ZotFlowSettings,
        input: BatchExtractImagesInput,
    ) {
        const { BatchExtractImagesTask } =
            await import("./impl/batch-extract-images-task");
        const task = new BatchExtractImagesTask(
            attachmentService,
            pdfProcessor,
            settings,
            input,
        );
        return this.startTask(task);
    }

    /**
     * Create a download attachment task that tracks progress.
     * Returns a promise that resolves with the downloaded Blob.
     */
    public async createDownloadAttachmentTask(
        attachmentService: AttachmentService,
        attachmentItem: IDBZoteroItem<AttachmentData>,
    ): Promise<Blob> {
        const { DownloadAttachmentTask } =
            await import("./impl/download-attachment-task");
        const task = new DownloadAttachmentTask(
            attachmentService,
            attachmentItem,
        );

        this.registerTask(task);

        const controller = new AbortController();
        this.activeControllers.set(task.id, controller);

        try {
            await task.execute(controller.signal);

            const blob = task.getBlob();
            if (!blob) {
                throw new Error(`Download failed for ${attachmentItem.key}`);
            }
            return blob;
        } finally {
            this.activeControllers.delete(task.id);
        }
    }

    /**
     * Create a batch extract external annotations task.
     * Returns a promise that resolves with the extracted AnnotationJSON[].
     */
    public async createBatchExtractExternalAnnotationsTask(
        attachmentService: AttachmentService,
        pdfProcessor: PDFProcessWorker,
        input: BatchExtractExternalAnnotationsInput,
    ): Promise<AnnotationJSON[]> {
        const { BatchExtractExternalAnnotationsTask } =
            await import("./impl/batch-extract-external-annotations-task");
        const task = new BatchExtractExternalAnnotationsTask(
            attachmentService,
            pdfProcessor,
            input,
        );

        this.registerTask(task);

        const controller = new AbortController();
        this.activeControllers.set(task.id, controller);

        try {
            await task.execute(controller.signal);
            return task.getExtractedAnnotations();
        } finally {
            this.activeControllers.delete(task.id);
        }
    }

    public getTasks(): ITaskInfo[] {
        return Array.from(this.tasks.values()).map((t) => t.getInfo());
    }
}
