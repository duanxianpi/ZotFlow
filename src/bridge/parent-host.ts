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
    updateProgress(message: string): void;
    updateStatusBar(text: string): void;
}

export interface INetworkFetcher {
    request(request: RequestUrlParam): Promise<IRequestResponse>;
}

export interface IParentProxy extends IUIResponder, INetworkFetcher {}

export class ParentHost implements IParentProxy {
    private progressNotice: Notice | null = null;

    public notify(type: NotificationType, message: string) {
        if (this.progressNotice) {
            this.progressNotice.hide();
            this.progressNotice = null;
        }
        new Notice(`ZotFlow: ${message}`);

        if (type === "error") {
            console.error(message);
        }
    }

    public updateProgress(message: string) {
        if (this.progressNotice && this.progressNotice.messageEl.isConnected) {
            this.progressNotice.setMessage(`ZotFlow: ${message}`);
        } else {
            this.progressNotice = new Notice(`ZotFlow: ${message}`, 0);
        }
    }

    public updateStatusBar(text: string) {}

    public async request(request: RequestUrlParam): Promise<IRequestResponse> {
        try {
            const req = {
                url: request.url,
                method: request.method,
                headers: request.headers,
                body: request.body,
                contentType: request.contentType,
            };
            console.log(req);
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
            console.error(`[ParentHost] Fetch failed:`, error);
            throw new Error(`Network Error: ${error.message}`);
        }
    }
}
