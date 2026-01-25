import * as Comlink from "comlink";
import { Notice, requestUrl } from "obsidian";

import type { IParentProxy, NotificationType, IRequestResponse } from "./types";
import type { RequestUrlParam } from "obsidian";

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
