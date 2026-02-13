import * as Comlink from "comlink";
import {
    Notice,
    requestUrl,
    App,
    TFile,
    normalizePath,
    MarkdownView,
    parseYaml,
    stringifyYaml,
} from "obsidian";
import {
    saveTextFile,
    saveBinaryFile,
    readTextFile,
    checkFile,
    deleteFile,
    getLinkedSourceNote,
} from "utils/file";
import { services } from "services/services";

import type { IParentProxy, IRequestResponse } from "./types";
import type { RequestUrlParam } from "obsidian";
import type { TFileWithoutParentAndVault } from "types/zotflow";
import type { NotificationType } from "services/notification-service";
import type { LogLevel } from "services/log-service";

export class ParentHost implements IParentProxy {
    constructor(private app: App) {}

    public notify(type: NotificationType, message: string) {
        services.notificationService.notify(type, message);
    }

    public log(
        level: LogLevel,
        message: string,
        context?: string,
        details?: any,
    ) {
        switch (level) {
            case "debug":
                services.logService.debug(message, context, details);
                break;
            case "info":
                services.logService.info(message, context);
                break;
            case "warn":
                services.logService.warn(message, context, details);
                break;
            case "error":
                services.logService.error(message, context, details);
                break;
        }
    }

    public async request(request: RequestUrlParam): Promise<IRequestResponse> {
        try {
            const req = {
                url: request.url,
                method: request.method,
                headers: request.headers,
                body: request.body,
                contentType: request.contentType,
            };
            const response = await requestUrl(request);
            const buffer = response.arrayBuffer;
            return Comlink.transfer(
                {
                    status: response.status,
                    headers: response.headers,
                    arrayBuffer: buffer,
                },
                [buffer],
            );
        } catch (error: any) {
            services.logService.error(
                `Fetch failed: ${error.message}`,
                "ParentHost",
            );
            throw new Error(`Network Error: ${error.message}`);
        }
    }

    public async readTextFile(path: string): Promise<string | null> {
        return readTextFile(this.app, path);
    }

    public async writeTextFile(path: string, content: string): Promise<void> {
        await saveTextFile(this.app, path, content);
    }

    public async writeBinaryFile(
        path: string,
        buffer: ArrayBuffer,
    ): Promise<void> {
        await saveBinaryFile(this.app, path, buffer);
    }

    public async checkFile(path: string): Promise<{
        exists: boolean;
        path: string;
        frontmatter?: Record<string, any>;
    }> {
        return checkFile(this.app, path);
    }

    public async openFile(path: string, newLeaf: boolean): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
        if (file instanceof TFile) {
            const leaves = this.app.workspace.getLeavesOfType("markdown");
            for (const leaf of leaves) {
                const view = leaf.view as MarkdownView;
                if (view.file && view.file.path === file.path) {
                    this.app.workspace.setActiveLeaf(leaf);
                    return;
                }
            }
            await this.app.workspace.getLeaf(newLeaf).openFile(file);
        }
    }

    public async getFileByKey(key: string): Promise<string | null> {
        await services.indexService.initializePromise;
        const file = services.indexService.getFileByKey(key);
        return file ? file.path : null;
    }

    public async indexFile(path: string): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
        if (file instanceof TFile) {
            services.indexService.indexFile(file);
        }
    }

    public async deleteFile(path: string): Promise<void> {
        await deleteFile(this.app, path);
    }

    public async parseYaml(text: string): Promise<any> {
        return parseYaml(text);
    }

    public async stringifyYaml(obj: any): Promise<string> {
        return stringifyYaml(obj);
    }

    public async getLinkedSourceNote(
        file: TFileWithoutParentAndVault,
    ): Promise<TFileWithoutParentAndVault | null> {
        return getLinkedSourceNote(this.app, file);
    }
}
