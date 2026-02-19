import type { TFileWithoutParentAndVault } from "types/zotflow";
import type { NotificationType } from "services/notification-service";
import type { LogLevel } from "services/log-service";

import type { ITaskInfo, ITaskOptions } from "types/tasks";
import type { RequestUrlParam } from "obsidian";

export interface IRequestResponse {
    status: number;
    headers: Record<string, string>;
    arrayBuffer: ArrayBuffer;
}

export interface IParentProxy {
    notify(type: NotificationType, message: string): void;
    log(
        level: LogLevel,
        message: string,
        context?: string,
        details?: any,
    ): void;
    request(request: RequestUrlParam): Promise<IRequestResponse>;

    // Filesystem
    readTextFile(path: string): Promise<string | null>;
    writeTextFile(path: string, content: string): Promise<void>;
    writeBinaryFile(path: string, buffer: ArrayBuffer): Promise<void>;
    checkFile(path: string): Promise<{
        exists: boolean;
        path: string;
        frontmatter?: Record<string, any>;
    }>;
    deleteFile(path: string): Promise<void>;
    openFile(path: string, newLeaf: boolean): Promise<void>;

    // Index
    getFileByKey(key: string): Promise<string | null>;
    indexFile(path: string): Promise<void>;

    // Utils
    parseYaml(text: string): Promise<any>;
    stringifyYaml(obj: any): Promise<string>;
    getLinkedSourceNote(
        file: TFileWithoutParentAndVault,
    ): Promise<TFileWithoutParentAndVault | null>;

    // Tasks
    onTaskUpdate(taskId: string, info: ITaskInfo): void;
}
