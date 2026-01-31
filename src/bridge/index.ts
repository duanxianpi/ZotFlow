import * as Comlink from "comlink";
// @ts-ignore
import workerCode from "virtual:worker";
import { ParentHost } from "./parent-host";
import { PDFProcessWorker } from "worker/services/pdf-processor";
import { getBlobUrls } from "bundle-assets/inline-assets";

import type { WorkerAPI } from "worker/worker";
import type { ZotFlowSettings } from "settings/types";
import type { AttachmentService } from "worker/services/attachment";
import type { SyncService } from "worker/services/sync";
import type { ZoteroAPIService } from "worker/services/zotero";
import type { WebDavService } from "worker/services/webdav";
import type { TreeViewService } from "worker/services/tree-view";
import type { NoteService } from "worker/services/note";
import type { LocalNoteService } from "worker/services/local-note";
import type { App } from "obsidian";

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

    constructor() {
        // Create a blob from the inlined worker code
        const blob = new Blob([workerCode], { type: "application/javascript" });
        const url = URL.createObjectURL(blob);

        this._worker = new Worker(url);
        this._api = Comlink.wrap<WorkerAPI>(this._worker);
    }

    async initialize(settings: ZotFlowSettings, app: App) {
        // Worker settings update / initialization
        const blobUrls = getBlobUrls();
        this._api.init(settings, Comlink.proxy(new ParentHost(app)), blobUrls);

        this._attachment = await this._api.attachment;
        this._sync = await this._api.sync;
        this._zotero = await this._api.zotero;
        this._webdav = await this._api.webdav;
        this._treeView = await this._api.treeView;
        this._note = await this._api.note;
        this._localNote = await this._api.localNote;
        this._pdfProcessor = await this._api.pdfProcessor;

        console.log("[ZotFlow] Client services initialized.");
    }

    get attachment() {
        return this._attachment;
    }

    get sync() {
        return this._sync;
    }

    get zotero() {
        return this._zotero;
    }

    get webdav() {
        return this._webdav;
    }

    get treeView() {
        return this._treeView;
    }

    get note() {
        return this._note;
    }

    get localNote() {
        return this._localNote;
    }

    get pdfProcessWorker() {
        return this._pdfProcessor;
    }

    updateSettings(newSettings: ZotFlowSettings) {
        this._api.updateSettings(newSettings);
    }

    terminate() {
        this._worker.terminate();
    }
}

export const workerBridge = new WorkerBridge();
