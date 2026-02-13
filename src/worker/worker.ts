import * as Comlink from "comlink";
import { ZoteroAPIService } from "./services/zotero";
import { SyncService } from "./services/sync";
import { AttachmentService } from "./services/attachment";
import { WebDavService } from "./services/webdav";
import { TreeViewService } from "./services/tree-view";
import { TemplateService } from "./services/template";
import { NoteService } from "./services/note";
import { PDFProcessWorker } from "./services/pdf-processor";
import { LocalNoteService } from "./services/local-note";
import { LocalTemplateService } from "./services/local-template";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";

import type { ZotFlowSettings } from "settings/types";
import type { IParentProxy } from "bridge/types";

/**
 * Worker API definition
 * This interface defines the methods exposed by the worker
 */
export interface WorkerAPI {
    init(
        settings: ZotFlowSettings,
        parentHost: IParentProxy,
        blobUrls: Record<string, string>,
    ): void;
    zotero: ZoteroAPIService;
    sync: SyncService;
    attachment: AttachmentService;
    webdav: WebDavService;
    treeView: TreeViewService;
    note: NoteService;

    localNote: LocalNoteService;
    pdfProcessor: PDFProcessWorker;
    updateSettings(settings: ZotFlowSettings): void;
}

// Service instances (Lazy initialized)
let _zotero: ZoteroAPIService | undefined;
let _webdav: WebDavService | undefined;
let _attachment: AttachmentService | undefined;
let _sync: SyncService | undefined;
let _treeView: TreeViewService | undefined;
let _template: TemplateService | undefined;
let _note: NoteService | undefined;

let _localNote: LocalNoteService | undefined;
let _localTemplate: LocalTemplateService | undefined;
let _pdfProcessor: PDFProcessWorker | undefined;

const exposedApi: WorkerAPI = {
    init: (
        settings: ZotFlowSettings,
        parentHost: IParentProxy,
        blobUrls: Record<string, string>,
    ) => {
        // Patch global fetch to proxy through Obsidian Main Thread
        (globalThis as any).originalFetch = (globalThis as any).fetch;
        (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
            try {
                const response = await parentHost.request({
                    url: url,
                    method: init?.method || "GET",
                    headers: init?.headers as Record<string, string>,
                    body: init?.body as string | ArrayBuffer,
                    throw: false, // We handle status codes in Services
                    contentType: "application/json",
                });

                // Handle empty response bodies
                if (
                    !response.arrayBuffer ||
                    response.arrayBuffer.byteLength === 0
                ) {
                    return new Response(null, {
                        status: response.status,
                        headers: new Headers(response.headers),
                    });
                }

                // Convert Obsidian Bridge response to standard Response object
                return new Response(response.arrayBuffer, {
                    status: response.status,
                    headers: new Headers(response.headers),
                });
            } catch (e) {
                throw new TypeError(
                    `Network Request Failed: ${(e as Error).message}`,
                );
            }
        };

        try {
            _zotero = new ZoteroAPIService(settings.zoteroApiKey);
            _webdav = new WebDavService(settings, parentHost);
            _attachment = new AttachmentService(
                _webdav,
                settings,
                _zotero,
                parentHost,
            );
            _sync = new SyncService(_zotero, settings, parentHost);
            _treeView = new TreeViewService(settings, parentHost);

            _pdfProcessor = new PDFProcessWorker(
                settings,
                parentHost,
                blobUrls,
            );

            _template = new TemplateService(settings, parentHost);
            _note = new NoteService(
                settings,
                _template,
                parentHost,
                _attachment,
                _pdfProcessor,
            );

            _localTemplate = new LocalTemplateService(settings, parentHost);
            _localNote = new LocalNoteService(
                settings,
                parentHost,
                _localTemplate,
            );

            // Initialize PDF Worker
            _pdfProcessor._init();

            parentHost.log("info", "Services initialized.", "Worker");
        } catch (e) {
            parentHost.log("error", "Initialization failed", "Worker", e);

            // This error will be caught by the Comlink promise on the main thread
            throw new ZotFlowError(
                ZotFlowErrorCode.UNKNOWN,
                "Worker",
                `Worker Initialization Failed: ${(e as Error).message}`,
            );
        }
    },

    get zotero() {
        if (!_zotero)
            throw new ZotFlowError(
                ZotFlowErrorCode.UNKNOWN,
                "Worker",
                "Worker not initialized",
            );
        return Comlink.proxy(_zotero);
    },

    get sync() {
        if (!_sync)
            throw new ZotFlowError(
                ZotFlowErrorCode.UNKNOWN,
                "Worker",
                "Worker not initialized",
            );
        return Comlink.proxy(_sync);
    },

    get webdav() {
        if (!_webdav)
            throw new ZotFlowError(
                ZotFlowErrorCode.UNKNOWN,
                "Worker",
                "Worker not initialized",
            );
        return Comlink.proxy(_webdav);
    },

    get attachment() {
        if (!_attachment)
            throw new ZotFlowError(
                ZotFlowErrorCode.UNKNOWN,
                "Worker",
                "Worker not initialized",
            );
        return Comlink.proxy(_attachment);
    },

    get treeView() {
        if (!_treeView)
            throw new ZotFlowError(
                ZotFlowErrorCode.UNKNOWN,
                "Worker",
                "Worker not initialized",
            );
        return Comlink.proxy(_treeView);
    },

    get note() {
        if (!_note)
            throw new ZotFlowError(
                ZotFlowErrorCode.UNKNOWN,
                "Worker",
                "Worker not initialized",
            );
        return Comlink.proxy(_note);
    },

    get localNote() {
        if (!_localNote)
            throw new ZotFlowError(
                ZotFlowErrorCode.UNKNOWN,
                "Worker",
                "Worker not initialized",
            );
        return Comlink.proxy(_localNote);
    },

    get pdfProcessor() {
        if (!_pdfProcessor)
            throw new ZotFlowError(
                ZotFlowErrorCode.UNKNOWN,
                "Worker",
                "Worker not initialized",
            );
        return Comlink.proxy(_pdfProcessor);
    },

    updateSettings: (settings: ZotFlowSettings) => {
        if (
            !_zotero ||
            !_webdav ||
            !_attachment ||
            !_sync ||
            !_treeView ||
            !_template ||
            !_note ||
            !_pdfProcessor ||
            !_localNote ||
            !_localTemplate
        ) {
            throw new ZotFlowError(
                ZotFlowErrorCode.UNKNOWN,
                "Worker",
                "Worker not initialized",
            );
        }

        // Safe updates
        _zotero.updateCredentials(settings.zoteroApiKey);
        _webdav.updateSettings(settings);
        _attachment.updateSettings(settings);
        _sync.updateSettings(settings);
        _treeView.updateSettings(settings);
        _template.updateSettings(settings);
        _note.updateSettings(settings);

        _localNote.updateSettings(settings);
        _localTemplate.updateSettings(settings);
        _pdfProcessor.updateSettings(settings);
    },
};

Comlink.expose(exposedApi);
