import * as Comlink from "comlink";
// @ts-ignore
import workerCode from "virtual:worker";
import { ParentHost } from "./parent-host";
import { PDFProcessWorker } from "worker/services/pdf-processor";
import { getBlobUrls } from "bundle-assets/inline-assets";

import type { WorkerAPI } from "worker/worker";
import type { TaskManager } from "worker/tasks/manager";
import type { ZotFlowSettings } from "settings/types";
import type { AttachmentService } from "worker/services/attachment";
import type { SyncService } from "worker/services/sync";
import type { ZoteroAPIService } from "worker/services/zotero";
import type { WebDavService } from "worker/services/webdav";
import type { TreeViewService } from "worker/services/tree-view";
import type { NoteService, UpdateOptions } from "worker/services/note";
import type { LocalNoteService } from "worker/services/local-note";
import type { BatchNoteInput } from "worker/tasks/impl/batch-note-task";
import type { BatchExtractImagesInput } from "worker/tasks/impl/batch-extract-images-task";
import type { BatchExtractExternalAnnotationsInput } from "worker/tasks/impl/batch-extract-external-annotations-task";
import type { IDBZoteroItem } from "types/db-schema";
import type { AttachmentData } from "types/zotero-item";
import type { AnnotationJSON } from "types/zotero-reader";
import type { App } from "obsidian";
import { services } from "services/services";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";

export class WorkerBridge {
    private _worker: Worker;

    private _api: Comlink.Remote<WorkerAPI>;

    private _attachment: AttachmentService;
    private _sync: SyncService;
    private _zotero: ZoteroAPIService;
    private _webdav: WebDavService;
    private _treeView: TreeViewService;
    private _note: NoteService;
    private _localNote: LocalNoteService;
    private _pdfProcessor: PDFProcessWorker;
    private _tasks: TaskManager;

    private _workerBlobUrl: string;
    private _initialized = false;

    constructor() {
        // Create a blob from the inlined worker code
        const blob = new Blob([workerCode], { type: "application/javascript" });
        this._workerBlobUrl = URL.createObjectURL(blob);

        this._worker = new Worker(this._workerBlobUrl);
        this._api = Comlink.wrap<WorkerAPI>(this._worker);
    }

    async initialize(settings: ZotFlowSettings, app: App) {
        // Worker settings update / initialization
        const blobUrls = getBlobUrls();
        await this._api.init(
            settings,
            Comlink.proxy(new ParentHost(app)),
            blobUrls,
        );

        this._attachment = await this._api.attachment;
        this._sync = await this._api.sync;
        this._zotero = await this._api.zotero;
        this._webdav = await this._api.webdav;
        this._treeView = await this._api.treeView;
        this._note = await this._api.note;
        this._localNote = await this._api.localNote;
        this._pdfProcessor = await this._api.pdfProcessor;
        this._tasks = await this._api.tasks;

        this._initialized = true;
        services.logService.log(
            "info",
            "Worker Client initialized.",
            "WorkerBridge",
        );
    }

    private assertInitialized(): void {
        if (!this._initialized) {
            throw new ZotFlowError(
                ZotFlowErrorCode.RESOURCE_MISSING,
                "WorkerBridge",
                "WorkerBridge not initialized. Call initialize() first.",
            );
        }
    }

    get attachment() {
        this.assertInitialized();
        return this._attachment;
    }

    get sync() {
        this.assertInitialized();
        return this._sync;
    }

    get zotero() {
        this.assertInitialized();
        return this._zotero;
    }

    get webdav() {
        this.assertInitialized();
        return this._webdav;
    }

    get treeView() {
        this.assertInitialized();
        return this._treeView;
    }

    get note() {
        this.assertInitialized();
        return this._note;
    }

    get localNote() {
        this.assertInitialized();
        return this._localNote;
    }

    get pdfProcessWorker() {
        this.assertInitialized();
        return this._pdfProcessor;
    }

    get tasks() {
        this.assertInitialized();
        return this._tasks;
    }

    // ================================================================
    // Task factory methods (delegates to top-level WorkerAPI methods)
    // ================================================================

    async createSyncTask(): Promise<string> {
        this.assertInitialized();
        return this._api.createSyncTask();
    }

    async createBatchNoteTask(
        input: BatchNoteInput,
        options: UpdateOptions,
        isUpdate: boolean,
    ): Promise<string> {
        this.assertInitialized();
        return this._api.createBatchNoteTask(input, options, isUpdate);
    }

    async createBatchExtractImagesTask(
        input: BatchExtractImagesInput,
    ): Promise<string> {
        this.assertInitialized();
        return this._api.createBatchExtractImagesTask(input);
    }

    async downloadAttachment(
        attachmentItem: IDBZoteroItem<AttachmentData>,
    ): Promise<Blob> {
        this.assertInitialized();
        return this._api.downloadAttachment(attachmentItem);
    }

    async extractExternalAnnotations(
        attachmentItems: IDBZoteroItem<AttachmentData>[],
    ): Promise<AnnotationJSON[]> {
        this.assertInitialized();
        return this._api.extractExternalAnnotations(attachmentItems);
    }

    cancelTask(taskId: string): void {
        this.assertInitialized();
        this._api.cancelTask(taskId);
    }

    updateSettings(newSettings: ZotFlowSettings) {
        this._api.updateSettings(newSettings);
    }

    terminate() {
        this._worker.terminate();
        URL.revokeObjectURL(this._workerBlobUrl);
        this._initialized = false;
    }
}

export const workerBridge = new WorkerBridge();
