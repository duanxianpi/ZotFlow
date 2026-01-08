import { requestUrl, RequestUrlParam } from "obsidian";

export class WebDavClient {
    private url: string;
    private user: string;
    private pass: string;

    constructor(url: string, user: string, pass: string) {
        this.updateCredentials(url, user, pass);
    }

    updateCredentials(url: string, user: string, pass: string) {
        this.url = url.endsWith('/') ? url : url + '/';
        this.user = user;
        this.pass = pass;
    }

    /**
     * Download a file from WebDAV.
     * @param remotePath Relative path to the file on the WebDAV server.
     * @returns The file content as an ArrayBuffer.
     */
    async downloadFile(remotePath: string): Promise<ArrayBuffer> {
        if (!this.url || !this.user || !this.pass) {
            throw new Error("WebDAV not configured.");
        }

        const fullUrl = this.url + remotePath.replace(/^\//, ''); // Ensure single slash join
        const credentials = btoa(`${this.user}:${this.pass}`);

        try {
            const req: RequestUrlParam = {
                url: fullUrl,
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${credentials}`
                }
            };

            const response = await requestUrl(req);

            if (response.status >= 200 && response.status < 300) {
                return response.arrayBuffer;
            } else {
                throw new Error(`WebDAV download failed with status: ${response.status}`);
            }

        } catch (error) {
            console.error("WebDAV download error:", error);
            throw error;
        }
    }

    static async verify(url: string, user: string, pass: string): Promise<boolean> {
        if (!url || !user || !pass) {
            throw new Error("Missing WebDAV credentials");
        }

        // basic auth
        const credentials = btoa(`${user}:${pass}`);

        try {
            const req: RequestUrlParam = {
                url: url,
                method: 'PROPFIND',
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Depth': '0' // Only check the root resource
                },
                throw: false // We want to handle status codes manually
            };

            const response = await requestUrl(req);

            if (response.status >= 200 && response.status < 300) {
                return true;
            } else {
                throw new Error(`WebDAV verification failed with status: ${response.status}`);
            }
        } catch (error) {
            console.error("WebDAV verification error:", error);
            throw error;
        }
    }
}
