import * as Comlink from "comlink";
import { ZoteroAPIService } from "./services/zotero";
import { SyncService } from "./services/sync";
import { AttachmentService } from "./services/attachment";
import { WebDavService } from "./services/webdav";
import { ZotFlowSettings } from "settings/types";
import { IParentProxy } from "bridge/parent-host";

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
    updateSettings(settings: ZotFlowSettings): void;
}

// Service instances (Lazy initialized)
let _zotero: ZoteroAPIService | undefined;
let _webdav: WebDavService | undefined;
let _attachment: AttachmentService | undefined;
let _sync: SyncService | undefined;

const exposedApi: WorkerAPI = {
    init: (settings: ZotFlowSettings, parentHost: IParentProxy) => {
        _zotero = new ZoteroAPIService(settings.zoteroApiKey);
        _webdav = new WebDavService(settings, parentHost);
        _attachment = new AttachmentService(_webdav, settings, parentHost);
        _sync = new SyncService(_zotero, settings, parentHost);
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

    updateSettings: (settings: ZotFlowSettings) => {
        if (!_zotero || !_webdav || !_attachment || !_sync) {
            throw new Error("[ZotFlow Worker] Worker not initialized");
        }

        // Safe updates
        _zotero.updateCredentials(settings.zoteroApiKey);
        _webdav!.updateSettings(settings);
        _attachment!.updateSettings(settings);
        _sync!.updateSettings(settings);
    },
};

Comlink.expose(exposedApi);
