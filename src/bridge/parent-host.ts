import { Notice, requestUrl, RequestUrlParam } from "obsidian";
import * as Comlink from "comlink";

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
    updateStatusBar(text: string): void;
}

export interface INetworkFetcher {
    request(
        request: RequestUrlParam | string,
        returnType: "arrayBuffer" | "json" | "text",
    ): Promise<IRequestResponse>;
}

export interface IParentProxy extends IUIResponder, INetworkFetcher {}

export class ParentHost implements IParentProxy {
    public notify(type: NotificationType, message: string) {
        new Notice(`ZotFlow: ${message}`);

        if (type === "error") {
            console.error(message);
        }
    }

    public updateStatusBar(text: string) {}

    public async request(
        request: RequestUrlParam | string,
        returnType: "arrayBuffer" | "json" | "text",
    ): Promise<IRequestResponse> {
        try {
            const response = await requestUrl(request);
            const buffer = response.arrayBuffer;
            return Comlink.transfer(
                {
                    status: response.status,
                    headers: response.headers,
                    arrayBuffer:
                        returnType === "arrayBuffer" ? buffer : undefined,
                    json: returnType === "json" ? response.json : undefined,
                    text: returnType === "text" ? response.text : undefined,
                },
                [buffer],
            );
        } catch (error: any) {
            console.error(`[ParentHost] Fetch failed:`, error);
            throw new Error(`Network Error: ${error.message}`);
        }
    }
}
