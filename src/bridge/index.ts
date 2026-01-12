import * as Comlink from "comlink";
// @ts-ignore
import workerCode from "virtual:worker";
import type { WorkerAPI } from "worker/worker";
import { PDFProcessWorker } from "./pdf-processor";
import { ZotFlowSettings } from "settings/types";
import { ParentHost } from "./parent-host";
import { AttachmentService } from "worker/services/attachment";
import { SyncService } from "worker/services/sync";
import { ZoteroAPIService } from "worker/services/zotero";
import { WebDavService } from "worker/services/webdav";

export class WorkerBridge {
    private worker: Worker;
    public pdfProcessWorker: PDFProcessWorker;

    public api: Comlink.Remote<WorkerAPI>;

    public attachment: AttachmentService;
    public sync: SyncService;
    public zotero: ZoteroAPIService;
    public webdav: WebDavService;

    constructor() {
        // Create a blob from the inlined worker code
        const blob = new Blob([workerCode], { type: "application/javascript" });
        const url = URL.createObjectURL(blob);

        this.worker = new Worker(url);
        this.api = Comlink.wrap<WorkerAPI>(this.worker);
    }

    async initialize(settings: ZotFlowSettings) {
        // Worker settings update / initialization
        this.api.init(settings, Comlink.proxy(new ParentHost()));

        this.attachment = await this.api.attachment;
        this.sync = await this.api.sync;
        this.zotero = await this.api.zotero;
        this.webdav = await this.api.webdav;

        // Init pdf worker
        this.pdfProcessWorker = new PDFProcessWorker();
        this.pdfProcessWorker._init();

        console.log("[ZotFlow] Client services initialized.");
    }

    updateSettings(newSettings: ZotFlowSettings) {
        this.api.updateSettings(newSettings);
    }

    terminate() {
        this.worker.terminate();
    }
}

export const workerBridge = new WorkerBridge();
