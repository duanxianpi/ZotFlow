import type { TFileWithoutParentAndVault } from "types/zotflow";
import type { NotificationType } from "services/notification-service";
import type { LogLevel } from "services/log-service";

export interface IRequestResponse {
    status: number;
    headers: Record<string, string>;
    text?: string;
    arrayBuffer?: ArrayBuffer;
    json?: any;
}

export interface IParentProxy {
    notify(type: NotificationType, message: string): void;
    log(
        level: LogLevel,
        message: string,
        context?: string,
        details?: any,
    ): void;
    request(request: any): Promise<IRequestResponse>;
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
    getFileByKey(key: string): Promise<string | null>;
    indexFile(path: string): Promise<void>;
    parseYaml(text: string): Promise<any>;
    stringifyYaml(obj: any): Promise<string>;
    getLinkedSourceNote(
        file: TFileWithoutParentAndVault,
    ): Promise<TFileWithoutParentAndVault | null>;
}
