import * as Comlink from "comlink";
// @ts-ignore
import workerCode from "virtual:worker";
import { ParentHost } from "./parent-host";
import { PDFProcessWorker } from "./pdf-processor";

import type { WorkerAPI } from "worker/worker";
import type { ZotFlowSettings } from "settings/types";
import type { AttachmentService } from "worker/services/attachment";
import type { SyncService } from "worker/services/sync";
import type { ZoteroAPIService } from "worker/services/zotero";
import type { WebDavService } from "worker/services/webdav";
import type { TreeViewService } from "worker/services/tree-view";

export class WorkerBridge {
    private _worker: Worker;
    private _pdfProcessWorker: PDFProcessWorker;

    private _api: Comlink.Remote<WorkerAPI>;

    private _attachment: AttachmentService;
    private _sync: SyncService;
    private _zotero: ZoteroAPIService;
    private _webdav: WebDavService;
    private _treeView: TreeViewService;

    constructor() {
        // Create a blob from the inlined worker code
        const blob = new Blob([workerCode], { type: "application/javascript" });
        const url = URL.createObjectURL(blob);

        this._worker = new Worker(url);
        this._api = Comlink.wrap<WorkerAPI>(this._worker);
    }

    async initialize(settings: ZotFlowSettings) {
        // Worker settings update / initialization
        this._api.init(settings, Comlink.proxy(new ParentHost()));

        this._attachment = await this._api.attachment;
        this._sync = await this._api.sync;
        this._zotero = await this._api.zotero;
        this._webdav = await this._api.webdav;
        this._treeView = await this._api.treeView;

        // Init pdf worker
        this._pdfProcessWorker = new PDFProcessWorker();
        this._pdfProcessWorker._init();

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

    get pdfProcessWorker() {
        return this._pdfProcessWorker;
    }

    updateSettings(newSettings: ZotFlowSettings) {
        this._api.updateSettings(newSettings);
    }

    terminate() {
        this._worker.terminate();
    }
}

export const workerBridge = new WorkerBridge();
