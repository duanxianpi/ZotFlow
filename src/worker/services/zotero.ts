import { ZoteroKey } from "../../types/zotero";
import api, { ApiChain } from "zotero-api-client";

export class ZoteroAPIService {
    private _client: ApiChain;

    constructor(apiKey?: string) {
        if (apiKey) {
            this._client = api.default(apiKey);
        } else {
            // Placeholder, expected to be updated
            this._client = api.default("");
        }
    }

    updateCredentials(apiKey: string) {
        this._client = api.default(apiKey);
    }

    /**
     * Validate the API key and return key details.
     * This ensures the key is valid and retrieves the associated user ID and permissions.
     */
    async verifyKey(apiKey: string): Promise<ZoteroKey> {
        if (!apiKey) {
            throw new Error("API Key is required");
        }

        try {
            const response = await api.default(apiKey).verifyKeyAccess().get();
            return response.getData() as ZoteroKey;
        } catch (error) {
            console.error("Failed to verify Zotero API key:", error);
            throw new Error("Invalid API Key or Network Error");
        }
    }

    async getGroups(userID: number) {
        try {
            const response = await this._client
                .library("user", userID)
                .groups()
                .get();
            return response.getData();
        } catch (e) {
            console.error("Failed to fetch groups", e);
            throw e;
        }
    }

    /**
     * Get the API client instance.
     * This is used to make API requests to Zotero.
     */
    public get client() {
        return this._client;
    }
}
