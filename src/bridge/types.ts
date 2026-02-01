import type { TFileWithoutParentAndVault } from "types/zotflow";

export type NotificationType = "info" | "success" | "warning" | "error";

export interface IRequestResponse {
    status: number;
    headers: Record<string, string>;
    text?: string;
    arrayBuffer?: ArrayBuffer;
    json?: any;
}

export interface IUIResponder {
    notify(type: NotificationType, message: string): void;
    updateProgress(message: string): void;
    updateStatusBar(text: string): void;
}

export interface INetworkFetcher {
    // We cannot use RequestUrlParam from obsidian here directly if we want to isolate it,
    // but we can define a compatible shape or import it as type only if we put this in a file that imports 'obsidian' as type?
    // Better to define the shape needed.
    request(request: any): Promise<IRequestResponse>;
}

export interface IParentProxy extends IUIResponder, INetworkFetcher {
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
