import * as Comlink from "comlink";
import { ZoteroAPIService } from "./services/zotero";
import { SyncService } from "./services/sync";
import { AttachmentService } from "./services/attachment";
import { WebDavService } from "./services/webdav";
import { TreeViewService } from "./services/tree-view";

import type { ZotFlowSettings } from "settings/types";
import type { IParentProxy } from "bridge/types";

/**
 * Worker API definition
 * This interface defines the methods exposed by the worker
 */
export interface WorkerAPI {
    init(settings: ZotFlowSettings, parentHost: IParentProxy): void;
    zotero: ZoteroAPIService;
    sync: SyncService;
    attachment: AttachmentService;
    webdav: WebDavService;
    treeView: TreeViewService;
    updateSettings(settings: ZotFlowSettings): void;
}

// Service instances (Lazy initialized)
let _zotero: ZoteroAPIService | undefined;
let _webdav: WebDavService | undefined;
let _attachment: AttachmentService | undefined;
let _sync: SyncService | undefined;
let _treeView: TreeViewService | undefined;

const exposedApi: WorkerAPI = {
    init: (settings: ZotFlowSettings, parentHost: IParentProxy) => {
        // Patch global fetch
        (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
            const response = await parentHost.request({
                url: url,
                method: init?.method || "GET",
                headers: init?.headers as Record<string, string>,
                body: init?.body as string | ArrayBuffer,
                throw: false,
                contentType: "application/json",
            });
            // Convert Obsidian response to standard Response object
            return new Response(response.arrayBuffer, {
                status: response.status,
                headers: new Headers(response.headers),
            });
        };

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
        console.log("[ZotFlow Worker] Services initialized.");
    },

    get zotero() {
        if (!_zotero)
            throw new Error("[ZotFlow Worker] Worker not initialized");
        return Comlink.proxy(_zotero);
    },

    get sync() {
        if (!_sync) throw new Error("[ZotFlow Worker] Worker not initialized");
        return Comlink.proxy(_sync);
    },

    get webdav() {
        if (!_webdav)
            throw new Error("[ZotFlow Worker] Worker not initialized");
        return Comlink.proxy(_webdav);
    },

    get attachment() {
        if (!_attachment)
            throw new Error("[ZotFlow Worker] Worker not initialized");
        return Comlink.proxy(_attachment);
    },

    get treeView() {
        if (!_treeView)
            throw new Error("[ZotFlow Worker] Worker not initialized");
        return Comlink.proxy(_treeView);
    },

    updateSettings: (settings: ZotFlowSettings) => {
        if (!_zotero || !_webdav || !_attachment || !_sync) {
            throw new Error("[ZotFlow Worker] Worker not initialized");
        }

        // Safe updates
        _zotero.updateCredentials(settings.zoteroApiKey);
        _webdav!.updateSettings(settings);
        _attachment!.updateSettings(settings);
        _sync!.updateSettings(settings);
        _treeView!.updateSettings(settings);
    },
};

Comlink.expose(exposedApi);
