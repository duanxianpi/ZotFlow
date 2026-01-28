import * as Comlink from "comlink";
import { db } from "db/db";
import type { ZotFlowSettings } from "settings/types";
import type { IParentProxy } from "bridge/types";
import type { IDBZoteroItem } from "types/db-schema";
import type { AnnotationData } from "types/zotero-item";
import { annotationItemFromJSON } from "db/annotation";

interface PDFWorkerConfig {
    pdfWorkerURL: string;
}

interface WorkerMessage {
    id?: number;
    responseID?: number;
    action?: string;
    data?: any;
    error?: any;
}

type PromiseResolvers = {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
};

type QueueItem = [
    () => Promise<any>,
    (value: any) => void,
    (reason?: any) => void,
];

export class PDFProcessWorker {
    config: PDFWorkerConfig;
    private _worker: Worker | null;
    private _lastPromiseID: number;
    private _waitingPromises: { [key: number]: PromiseResolvers };
    private _queue: QueueItem[];
    private _processingQueue: boolean;
    private _blobUrls: Record<string, string>;

    constructor(
        private settings: ZotFlowSettings,
        private parentHost: IParentProxy,
        blobUrls: Record<string, string>,
    ) {
        this._worker = null;
        this._lastPromiseID = 0;
        this._waitingPromises = {};
        this._queue = [];
        this._processingQueue = false;
        this._blobUrls = blobUrls;

        try {
            const workerUrl = this._blobUrls["pdf/zotero-pdf-worker.js"];
            if (!workerUrl) throw new Error("Worker URL not found");

            this.config = {
                pdfWorkerURL: workerUrl,
            };
            console.log("[ZotFlow Worker] PdfWorkerService initialized");
        } catch (e) {
            console.error(
                "[ZotFlow Worker] Failed to initialize PdfWorkerService",
                e,
            );
            // Default config to avoid crashes, though functionality will be broken
            this.config = { pdfWorkerURL: "" };
        }
    }

    updateSettings(settings: ZotFlowSettings) {
        this.settings = settings;
    }

    async _processQueue() {
        this._init();
        if (this._processingQueue) {
            return;
        }
        this._processingQueue = true;
        let item;
        while ((item = this._queue.shift())) {
            if (item) {
                let [fn, resolve, reject] = item;
                try {
                    resolve(await fn());
                } catch (e) {
                    reject(e);
                }
            }
        }
        this._processingQueue = false;
    }

    async _enqueue<T>(fn: () => Promise<T>, isPriority?: boolean): Promise<T> {
        return new Promise((resolve, reject) => {
            if (isPriority) {
                this._queue.unshift([fn, resolve, reject]);
            } else {
                this._queue.push([fn, resolve, reject]);
            }
            this._processQueue();
        });
    }

    async _query(
        action: string,
        data: any,
        transfer?: Transferable[],
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            this._lastPromiseID++;
            this._waitingPromises[this._lastPromiseID] = { resolve, reject };
            this._worker!.postMessage(
                { id: this._lastPromiseID, action, data },
                transfer || [],
            );
        });
    }

    _init() {
        if (this._worker) return;
        if (!this.config.pdfWorkerURL) {
            console.error("PdfWorkerService: No worker URL available");
            return;
        }
        this._worker = new Worker(this.config.pdfWorkerURL);
        this._worker.addEventListener(
            "message",
            async (event: MessageEvent<WorkerMessage>) => {
                let message = event.data;
                if (message.responseID) {
                    let resolver = this._waitingPromises[message.responseID];
                    if (resolver) {
                        let { resolve, reject } = resolver;
                        delete this._waitingPromises[message.responseID];
                        if (message.data) {
                            resolve(message.data);
                        } else {
                            reject(new Error(JSON.stringify(message.error)));
                        }
                    }
                    return;
                }
                if (message.id) {
                    let respData: any = null;

                    try {
                        if (message.action === "FetchBuiltInCMap") {
                            const cMapUrl =
                                this._blobUrls[
                                    `pdf/web/cmaps/${message.data}.bcmap`
                                ];
                            if (cMapUrl) {
                                const response = await fetch(cMapUrl);
                                const arrayBuffer =
                                    await response.arrayBuffer();
                                respData = {
                                    isCompressed: true,
                                    cMapData: new Uint8Array(arrayBuffer),
                                };
                            } else {
                                console.warn(`CMap not found: ${message.data}`);
                            }
                        }
                    } catch (e) {
                        console.log("Failed to fetch CMap data:");
                        console.log(e);
                    }

                    try {
                        if (message.action === "FetchStandardFontData") {
                            const fontUrl =
                                this._blobUrls[
                                    `pdf/web/standard_fonts/${message.data}`
                                ];
                            if (fontUrl) {
                                const response = await fetch(fontUrl);
                                const arrayBuffer =
                                    await response.arrayBuffer();
                                respData = new Uint8Array(arrayBuffer);
                            } else {
                                console.warn(
                                    `Standard font not found: ${message.data}`,
                                );
                            }
                        }
                    } catch (e) {
                        console.log("Failed to fetch standard font data:");
                        console.log(e);
                    }

                    try {
                        if (message.action === "SaveRenderedAnnotation") {
                            const { libraryID, annotationKey, buf } =
                                message.data;

                            await db.items
                                .where({ libraryID, key: annotationKey })
                                .modify((item) => {
                                    item.annotationImageVersion = item.version;
                                });
                            const path =
                                this.settings.annotationImageFolder +
                                "/" +
                                annotationKey +
                                ".png";

                            await this.parentHost.writeBinaryFile(
                                path,
                                Comlink.transfer(buf, [buf]),
                            );

                            respData = true;
                        }
                    } catch (e) {
                        console.log("Failed to render annotations:");
                        console.log(e);
                    }

                    this._worker!.postMessage({
                        responseID: message.id,
                        data: respData,
                    });
                }
            },
        );
        this._worker.addEventListener("error", (event) => {
            console.log(
                `PDF Web Worker error (${event.filename}:${event.lineno}): ${event.message}`,
            );
        });
    }

    /**
     * Export PDF file with annotations
     *
     * @param {ArrayBuffer} buf
     * @param {ZoteroItemDataTypeMap["annotation"][]} items
     * @param {Boolean} [isPriority]
     * @returns {Promise<Uint8Array>} PDF buffer
     */
    async export(
        buf: ArrayBuffer,
        items: IDBZoteroItem<AnnotationData>[],
        isPriority?: boolean,
    ): Promise<Uint8Array> {
        return this._enqueue(async () => {
            // ... (Logic extracted from original file, largely database independent logic)
            // Need to verify if `items` are raw objects or Dexie objects depending on worker
            // But they are passed as arguments.

            items = items.filter((x) => !x.raw.data.annotationIsExternal);
            let annotations: any[] = [];
            for (let item of items) {
                annotations.push({
                    id: item.key,
                    type: item.raw.data.annotationType,
                    authorName: item.raw.data.annotationAuthorName || "",
                    comment: (item.raw.data.annotationComment || "").replace(
                        /<\/?(i|b|sub|sup)>/g,
                        "",
                    ),
                    color: item.raw.data.annotationColor,
                    position:
                        typeof item.raw.data.annotationPosition === "string"
                            ? JSON.parse(item.raw.data.annotationPosition)
                            : item.raw.data.annotationPosition,
                    dateModified: item.raw.data.dateModified,
                    tags: item.raw.data.tags.map((x) => x.tag),
                });
            }
            let res: any;
            try {
                res = await this._query("export", { buf, annotations }, [buf]);
            } catch (e: any) {
                let error = new Error(
                    `Worker 'export' failed: ${JSON.stringify({
                        annotations,
                        error: e.message,
                    })}`,
                );
                try {
                    error.name = JSON.parse(e.message).name;
                } catch (e) {
                    console.log(e);
                }
                console.log(error);
                throw error;
            }
            return res.buf;
        }, isPriority);
    }

    /**
     * Import annotations from PDF file
     *
     * @param {ArrayBuffer} buf PDF file
     * @param {Boolean} [isPriority]
     * @returns {Promise<any[]>} Whether any annotations were imported/deleted
     */
    async import(buf: ArrayBuffer, isPriority?: boolean): Promise<any[]> {
        return this._enqueue(async () => {
            let imported: any[];
            try {
                ({ imported } = await this._query(
                    "import",
                    { buf, existingAnnotations: [] },
                    [buf],
                ));
            } catch (e: any) {
                let error = new Error(
                    `Worker 'import' failed: ${JSON.stringify({ error: e.message })}`,
                );
                try {
                    error.name = JSON.parse(e.message).name;
                } catch (e) {
                    console.log(e);
                }
                console.log(error);
                throw error;
            }
            let annotations: any[] = [];
            for (let annotation of imported) {
                annotation.id = Math.round(Math.random() * 4294967295)
                    .toString()
                    .slice(0, 8);
                annotation.isExternal = true;
                annotations.push(annotationItemFromJSON(annotation));
            }
            return annotations;
        }, isPriority);
    }

    /**
     * Rotate pages in PDF attachment
     *
     * @param {ArrayBuffer} buf
     * @param {Array} pageIndexes
     * @param {Integer} degrees 90, 180, 270
     * @param {Boolean} [isPriority]
     * @param {String} [password]
     * @returns {Promise}
     */
    async rotatePages(
        buf: ArrayBuffer,
        pageIndexes: number[],
        degrees: 90 | 180 | 270,
        isPriority?: boolean,
        password?: string,
    ): Promise<ArrayBuffer> {
        return this._enqueue(async () => {
            let modifiedBuf: ArrayBuffer;
            try {
                ({ buf: modifiedBuf } = await this._query(
                    "rotatePages",
                    {
                        buf,
                        pageIndexes,
                        degrees,
                        password,
                    },
                    [buf],
                ));
            } catch (e: any) {
                let error = new Error(
                    `Worker 'rotatePages' failed: ${JSON.stringify({ error: e.message })}`,
                );
                try {
                    error.name = JSON.parse(e.message).name;
                } catch {
                    // ignore
                }
                throw error;
            }

            return modifiedBuf;
        }, isPriority);
    }

    /**
     * Get data for recognizer-server
     *
     * @param {ArrayBuffer} buf PDF file
     * @param {Boolean} [isPriority]
     * @param {String} [password]
     * @returns {Promise}
     */
    async getRecognizerData(
        buf: ArrayBuffer,
        isPriority?: boolean,
        password?: string,
    ): Promise<any> {
        return this._enqueue(async () => {
            let result: any;
            try {
                result = await this._query(
                    "getRecognizerData",
                    { buf, password },
                    [buf],
                );
            } catch (e: any) {
                let error = new Error(
                    `Worker 'getRecognizerData' failed: ${JSON.stringify({ error: e.message })}`,
                );
                try {
                    error.name = JSON.parse(e.message).name;
                } catch (e) {
                    console.log(e);
                }
                console.log(error);
                throw error;
            }
            return result;
        }, isPriority);
    }

    /**
     * Get rendered annotations
     */
    async renderAnnotations(
        libraryID: number,
        buf: ArrayBuffer,
        annotations: any[],
        password?: string,
    ): Promise<any> {
        return this._enqueue(async () => {
            let result: any;
            try {
                result = await this._query(
                    "renderAnnotations",
                    { libraryID, buf, annotations, password },
                    [buf],
                );
            } catch (e: any) {
                let error = new Error(
                    `Worker 'renderAnnotations' failed: ${JSON.stringify({ error: e.message })}`,
                );
                try {
                    error.name = JSON.parse(e.message).name;
                } catch (e) {
                    console.log(e);
                }
                console.log(error);
                throw error;
            }
            return result;
        });
    }
}
