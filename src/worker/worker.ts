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
import { ConflictService } from "./services/conflict";
import { AnnotationService } from "./services/annotation";
import { KeyService } from "./services/key";
import { QueryService } from "./services/query";
import { TaskManager } from "./tasks/manager";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";

import type { ZotFlowSettings } from "settings/types";
import type { IParentProxy } from "bridge/types";
import type { UpdateOptions } from "./services/note";
import type { BatchNoteInput } from "./tasks/impl/batch-note-task";
import type {
    BatchExtractImagesInput,
    ItemIdentifier,
} from "./tasks/impl/batch-extract-images-task";
import type { IDBZoteroItem } from "types/db-schema";
import type { AttachmentData } from "types/zotero-item";
import type { AnnotationJSON } from "types/zotero-reader";
import type { SaveAnnotationsResult } from "./services/annotation";
import type { LibraryRow } from "./services/key";
import type { QueryService as QueryServiceType } from "./services/query";

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
    dispose(): void;
    zotero: ZoteroAPIService;
    sync: SyncService;
    attachment: AttachmentService;
    webdav: WebDavService;
    treeView: TreeViewService;
    note: NoteService;

    localNote: LocalNoteService;
    conflict: ConflictService;
    annotation: AnnotationService;
    key: KeyService;
    query: QueryServiceType;
    pdfProcessor: PDFProcessWorker;
    tasks: TaskManager;
    updateSettings(settings: ZotFlowSettings): void;

    // Task factory methods
    createSyncTask(libraryId?: number): Promise<string>;
    createBatchNoteTask(
        input: BatchNoteInput,
        options: UpdateOptions,
        isUpdate: boolean,
    ): Promise<string>;
    createBatchExtractImagesTask(
        input: BatchExtractImagesInput,
    ): Promise<string>;
    downloadAttachment(
        attachmentItem: IDBZoteroItem<AttachmentData>,
    ): Promise<Blob>;
    extractExternalAnnotations(
        items: ItemIdentifier[],
    ): Promise<AnnotationJSON[]>;
    cancelTask(taskId: string): void;
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
let _conflict: ConflictService | undefined;
let _annotation: AnnotationService | undefined;
let _key: KeyService | undefined;
let _query: QueryService | undefined;
let _pdfProcessor: PDFProcessWorker | undefined;
let _taskManager: TaskManager | undefined;
let _currentSettings: ZotFlowSettings | undefined;

function assertInitialized() {
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
        !_localTemplate ||
        !_conflict ||
        !_annotation ||
        !_key ||
        !_query ||
        !_taskManager ||
        !_currentSettings
    ) {
        throw new ZotFlowError(
            ZotFlowErrorCode.RESOURCE_MISSING,
            "Worker",
            "Worker not initialized",
        );
    }
}

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
            _zotero = new ZoteroAPIService(settings.zoteroapikey);
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

            _conflict = new ConflictService(parentHost);

            _annotation = new AnnotationService(_note, parentHost);
            _key = new KeyService(_zotero, parentHost);
            _query = new QueryService();

            _taskManager = new TaskManager(parentHost);

            _currentSettings = settings;

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

    get conflict() {
        if (!_conflict)
            throw new ZotFlowError(
                ZotFlowErrorCode.UNKNOWN,
                "Worker",
                "Worker not initialized",
            );
        return Comlink.proxy(_conflict);
    },

    get annotation() {
        if (!_annotation)
            throw new ZotFlowError(
                ZotFlowErrorCode.UNKNOWN,
                "Worker",
                "Worker not initialized",
            );
        return Comlink.proxy(_annotation);
    },

    get key() {
        if (!_key)
            throw new ZotFlowError(
                ZotFlowErrorCode.UNKNOWN,
                "Worker",
                "Worker not initialized",
            );
        return Comlink.proxy(_key);
    },

    get query() {
        if (!_query)
            throw new ZotFlowError(
                ZotFlowErrorCode.UNKNOWN,
                "Worker",
                "Worker not initialized",
            );
        return Comlink.proxy(_query);
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

    get tasks() {
        if (!_taskManager)
            throw new ZotFlowError(
                ZotFlowErrorCode.UNKNOWN,
                "Worker",
                "Worker not initialized",
            );
        return Comlink.proxy(_taskManager);
    },

    dispose: () => {
        _note?.dispose();
        _localNote?.dispose();
    },

    // ================================================================
    // Task factory methods
    // ================================================================

    createSyncTask: async (libraryId?: number) => {
        assertInitialized();
        return _taskManager!.createSyncTask(_sync!, libraryId);
    },

    createBatchNoteTask: async (
        input: BatchNoteInput,
        options: UpdateOptions,
        isUpdate: boolean,
    ) => {
        assertInitialized();
        return _taskManager!.createBatchNoteTask(
            _note!,
            input,
            options,
            isUpdate,
        );
    },

    createBatchExtractImagesTask: async (input: BatchExtractImagesInput) => {
        assertInitialized();
        return _taskManager!.createBatchExtractImagesTask(
            _attachment!,
            _pdfProcessor!,
            _currentSettings!,
            input,
        );
    },

    downloadAttachment: async (
        attachmentItem: IDBZoteroItem<AttachmentData>,
    ) => {
        assertInitialized();
        return _taskManager!.createDownloadAttachmentTask(
            _attachment!,
            attachmentItem,
        );
    },

    extractExternalAnnotations: async (items: ItemIdentifier[]) => {
        assertInitialized();
        return _taskManager!.createBatchExtractExternalAnnotationsTask(
            _attachment!,
            _pdfProcessor!,
            { items },
        );
    },

    cancelTask: (taskId: string) => {
        assertInitialized();
        _taskManager!.cancelTask(taskId);
    },

    updateSettings: (settings: ZotFlowSettings) => {
        assertInitialized();

        // Safe updates
        _zotero!.updateCredentials(settings.zoteroapikey);
        _webdav!.updateSettings(settings);
        _attachment!.updateSettings(settings);
        _sync!.updateSettings(settings);
        _treeView!.updateSettings(settings);
        _template!.updateSettings(settings);
        _note!.updateSettings(settings);

        _localNote!.updateSettings(settings);
        _localTemplate!.updateSettings(settings);
        _pdfProcessor!.updateSettings(settings);
        _currentSettings = settings;
    },
};

Comlink.expose(exposedApi);
