declare module 'zotero-api-client' {
    export type HttpVerb = 'get' | 'post' | 'put' | 'patch' | 'delete';

    export type RelLinks = {
        next?: string;
        previous?: string;
        last?: string;
        alternate?: string;
    };

    export interface ResourceSelection {
        library?: string; // e.g. "u123" or "g456"
        collections?: string | null;
        publications?: null;
        items?: string | null;
        searches?: string | null;
        top?: null;
        trash?: null;
        tags?: string | null;
        children?: null;
        groups?: null;
        subcollections?: null;
        itemTypes?: null;
        itemFields?: null;
        schema?: null;
        creatorFields?: null;
        itemTypeFields?: null;
        itemTypeCreatorTypes?: null;
        template?: null;
        file?: null;
        fileUrl?: null;
        settings?: string | null;
        deleted?: null;
        verifyKeyAccess?: null;
    }

    export interface RequestOptions {
        // API endpoint configuration
        apiScheme?: string; // default: https
        apiAuthorityPart?: string; // default: api.zotero.org
        apiPath?: string; // default: ''

        // Headers
        authorization?: string;
        zoteroApiKey?: string;
        zoteroWriteToken?: string;
        zoteroSchemaVersion?: number;
        ifModifiedSinceVersion?: number;
        ifUnmodifiedSinceVersion?: number;
        ifNoneMatch?: string;
        contentType?: string | null;

        // Query params
        annotationType?: string;
        collectionKey?: string;
        content?: string;
        direction?: string;
        format?: string | null;
        include?: string;
        includeTrashed?: string | boolean;
        itemKey?: string | string[];
        itemQ?: string;
        itemQMode?: string;
        itemTag?: string | string[];
        itemType?: string;
        limit?: number | string;
        linkMode?: string;
        linkwrap?: string;
        locale?: string;
        q?: string;
        qmode?: string;
        searchKey?: string;
        since?: number | string;
        sort?: string;
        start?: number | string;
        style?: string;
        tag?: string | string[];

        // Execution / fetch
        method?: HttpVerb | string;
        body?: any;
        mode?: string;
        cache?: string;
        credentials?: string;
        integrity?: string;
        keepalive?: boolean;
        priority?: string;
        redirect?: string;
        referrer?: string;
        referrerPolicy?: string;
        signal?: AbortSignal | any;

        // Retry
        retry?: number;
        retryDelay?: number | null;
        retryCount?: number;

        // Advanced
        pretend?: boolean;
        resource?: ResourceSelection;
        executors?: Array<(config: any) => Promise<any> | any>;

        // Version. Converted to a relevant header depending on request type
        version?: number;

        // File upload / patch
        fileName?: string;
        file?: ArrayBuffer;
        fileSize?: number;
        mtime?: number | null;
        md5sum?: string;
        filePatch?: ArrayBuffer;
        algorithm?: 'xdelta' | 'vcdiff' | 'bsdiff';
        uploadRegisterOnly?: boolean | null;
    }

    export class ApiResponse<TData = any> {
        constructor(data: TData, options: RequestOptions, response: any);
        raw: TData;
        options: RequestOptions;
        response: any;
        getResponseType(): string;
        getData(): TData;
        getLinks(): any;
        getMeta(): any;
        getVersion(): number | null;
    }

    export class SchemaResponse<TData = any> extends ApiResponse<TData> {
        getResponseType(): 'SchemaResponse';
        getVersion(): number;
        getMeta(): null;
    }

    export class SingleReadResponse<TData = any> extends ApiResponse<TData> {
        getResponseType(): 'SingleReadResponse';
        getData(): TData;
    }

    export class MultiReadResponse<TData = any> extends ApiResponse<TData[]> {
        getResponseType(): 'MultiReadResponse';
        getData(): TData[];
        getLinks(): Array<any>;
        getMeta(): Array<any>;
        getTotalResults(): number | null;
        getRelLinks(): RelLinks
    }

    export class SingleWriteResponse<TPatch extends object = any> extends ApiResponse<Required<TPatch>> {
        getResponseType(): 'SingleWriteResponse';
        getData(): Required<TPatch> & { version: number | null };
    }

    export class MultiWriteResponse<TItem extends object = any> extends ApiResponse<any> {
        getResponseType(): 'MultiWriteResponse';
        isSuccess(): boolean;
        getData(): Array<TItem>;
        getLinks(): Array<any>;
        getMeta(): Array<any>;
        getErrors(): Record<number, any>;
        getEntityByKey(key: string): TItem;
        getEntityByIndex(index: number | string): TItem;
    }

    export class DeleteResponse extends ApiResponse<any> {
        getResponseType(): 'DeleteResponse';
    }

    export class FileUploadResponse extends ApiResponse<any> {
        uploadResponse?: any;
        registerResponse?: any;
        getResponseType(): 'FileUploadResponse';
        getVersion(): number | null;
    }

    export class FileDownloadResponse extends ApiResponse<ArrayBuffer> {
        getResponseType(): 'FileDownloadResponse';
        getData(): ArrayBuffer;
    }

    export class FileUrlResponse extends ApiResponse<string> {
        getResponseType(): 'FileUrlResponse';
        getData(): string;
    }

    export class RawApiResponse extends ApiResponse<any> {
        constructor(rawResponse: any, options: RequestOptions);
        getResponseType(): 'RawApiResponse';
    }

    export class PretendResponse extends ApiResponse<{ url: string; fetchConfig: any }> {
        getResponseType(): 'PretendResponse';
        getVersion(): null;
    }

    export class ErrorResponse extends Error {
        constructor(message: string, reason: string, response: any, options: RequestOptions);
        response: any;
        reason: string;
        options: RequestOptions;
        getVersion(): number | null;
        getResponseType(): 'ErrorResponse';
    }

    export type AnyResponse =
        | ApiResponse<any>
        | SchemaResponse<any>
        | SingleReadResponse<any>
        | MultiReadResponse<any>
        | SingleWriteResponse<any>
        | MultiWriteResponse<any>
        | DeleteResponse
        | FileUploadResponse
        | FileDownloadResponse
        | FileUrlResponse
        | RawApiResponse
        | PretendResponse;

    // ------------------- API Chain -------------------
    export interface ExtendArgs {
        config: RequestOptions;
        ef: (opts?: Partial<RequestOptions>) => ApiChain;
        efr: (resource?: Partial<ResourceSelection>, opts?: Partial<RequestOptions>) => ApiChain;
        execute: (cfg: RequestOptions) => Promise<AnyResponse>;
        functions: Record<string, any>;
    }

    export interface ApiChain {
        api(key?: string | null, opts?: Partial<RequestOptions>): ApiChain;

        // Resource configuration
        library(typeOrKey: 'user' | 'group', id: number): ApiChain;
        library(libraryKey: string): ApiChain;

        items(items?: string | null): ApiChain;
        itemTypes(): ApiChain;
        itemFields(): ApiChain;
        creatorFields(): ApiChain;
        schema(): ApiChain;
        itemTypeFields(itemType: string): ApiChain;
        itemTypeCreatorTypes(itemType: string): ApiChain;
        template(itemType: string, subType?: string): ApiChain;

        collections(collections?: string | null): ApiChain;
        subcollections(): ApiChain;
        publications(): ApiChain;
        tags(tags?: string | null): ApiChain;
        searches(searches?: string | null): ApiChain;
        top(): ApiChain;
        trash(): ApiChain;
        children(): ApiChain;
        settings(settings?: string | null): ApiChain;
        deleted(since: number): ApiChain;
        groups(): ApiChain;
        version(version: number): ApiChain;

        // Files
        attachment(
            fileName?: string,
            file?: ArrayBuffer,
            mtime?: number | null,
            md5sum?: string,
            patch?: ArrayBuffer,
            algorithm?: 'xdelta' | 'vcdiff' | 'bsdiff' | string
        ): ApiChain;
        registerAttachment(fileName: string, fileSize: number, mtime: number, md5sum: string): ApiChain;
        attachmentUrl(): ApiChain;

        // Access/keys
        verifyKeyAccess(): ApiChain;

        // Execution
        get(opts?: Partial<RequestOptions>): Promise<AnyResponse>;
        post(data: any, opts?: Partial<RequestOptions>): Promise<SingleWriteResponse | MultiWriteResponse>;
        put(data: any, opts?: Partial<RequestOptions>): Promise<SingleWriteResponse>;
        patch(data: any, opts?: Partial<RequestOptions>): Promise<SingleWriteResponse>;
        delete(keysToDelete?: string[], opts?: Partial<RequestOptions>): Promise<DeleteResponse>;
        pretend(verb?: HttpVerb, data?: any, opts?: Partial<RequestOptions>): Promise<PretendResponse>;

        // Utilities
        getConfig(): RequestOptions;
        use<T extends ApiChain = ApiChain>(extend: (args: ExtendArgs) => T): T;
    }

    function api(key?: string | null, opts?: Partial<RequestOptions>): ApiChain;
    function request(config: RequestOptions): Promise<{ response: AnyResponse } & RequestOptions & { source: string }>;

    // When importing CJS module in Node ESM environment, default export is the module.exports object.
    // The library exports 'api' function as default, but in this context it appears as a property 'default'.
    const defaultExport: {
        default: typeof api;
        request: typeof request;
    }

    export default defaultExport;
}