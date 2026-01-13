// WebDAV Client (Worker Side)

import { IParentProxy } from "bridge/parent-host";
import { ZotFlowSettings } from "settings/types";

export class WebDavService {
    constructor(
        private settings: ZotFlowSettings,
        private parentHost: IParentProxy,
    ) {
        this.updateSettings(settings);
    }

    updateSettings(settings: ZotFlowSettings) {
        this.settings = settings;
    }

    /**
     * Download a file from WebDAV.
     * @param remotePath Relative path to the file on the WebDAV server.
     * @returns The file content as an ArrayBuffer.
     */
    async downloadFile(remotePath: string): Promise<ArrayBuffer> {
        if (
            !this.settings.webDavUrl ||
            !this.settings.webDavUser ||
            !this.settings.webDavPassword
        ) {
            throw new Error("WebDAV not configured.");
        }
        // Make sure the webdav url ends with a slash
        if (!this.settings.webDavUrl.endsWith("/")) {
            this.settings.webDavUrl += "/";
        }
        const fullUrl = this.settings.webDavUrl + remotePath.replace(/^\//, ""); // Ensure single slash join
        const credentials = btoa(
            `${this.settings.webDavUser}:${this.settings.webDavPassword}`,
        );

        try {
            const req = {
                method: "GET",
                headers: {
                    Authorization: `Basic ${credentials}`,
                },
            };

            const response = await fetch(fullUrl, req);

            if (response.status >= 200 && response.status < 300) {
                return response.arrayBuffer();
            } else {
                throw new Error(
                    `WebDAV download failed with status: ${response.status}`,
                );
            }
        } catch (error) {
            console.error("WebDAV download error:", error);
            throw error;
        }
    }

    async verify(url: string, user: string, pass: string): Promise<boolean> {
        if (!url || !user || !pass) {
            throw new Error("Missing WebDAV credentials");
        }

        // basic auth
        const credentials = btoa(`${user}:${pass}`);

        try {
            const req = {
                method: "PROPFIND",
                headers: {
                    Authorization: `Basic ${credentials}`,
                    Depth: "0", // Only check the root resource
                },
                throw: false, // We want to handle status codes manually
            };

            const response = await fetch(url, req);

            if (response.status >= 200 && response.status < 300) {
                return true;
            } else {
                throw new Error(
                    `WebDAV verification failed with status: ${response.status}`,
                );
            }
        } catch (error) {
            console.error("WebDAV verification error:", error);
            throw error;
        }
    }
}
