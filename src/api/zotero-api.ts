import api, { ApiChain } from 'zotero-api-client';

export interface ZoteroKeyAccess {
    user: {
        library: boolean;
        files: boolean;
        notes: boolean;
        write: boolean;
    };
    groups: {
        [groupId: string]: {
            library: boolean;
            write: boolean;
        };
    };
}

export interface ZoteroKeyResponse {
    key: string;
    userID: number;
    username: string;
    displayName: string;
    access: ZoteroKeyAccess;
}

export class ZoteroApiClient {
    private apiKey: string;
    private client: ApiChain;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        // zotero-api-client handles Auth Header, Rate Limiting (Retry-After), and Retries automatically.
        this.client = api.default(apiKey);
    }

    /**
     * Validate the API key and return key details.
     * This ensures the key is valid and retrieves the associated user ID and permissions.
     */
    static async verifyKey(apiKey: string): Promise<ZoteroKeyResponse> {
        if (!apiKey) {
            throw new Error("API Key is required");
        }

        try {
            const response = await api.default(apiKey).verifyKeyAccess().get();
            return response.getData() as ZoteroKeyResponse;
        } catch (error) {
            console.error("Failed to verify Zotero API key:", error);
            throw new Error("Invalid API Key or Network Error");
        }
    }

    /**
     * Get the API client instance.
     * This is used to make API requests to Zotero.
     */
    public getClient() {
        return this.client;
    }
}
