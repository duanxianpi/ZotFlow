/**
 * Error Code Enum
 */
export enum ZotFlowErrorCode {
    NETWORK_ERROR = "NETWORK_ERROR",
    AUTH_INVALID = "AUTH_INVALID",
    CONFIG_MISSING = "CONFIG_MISSING",
    API_LIMIT = "API_LIMIT",
    RESOURCE_MISSING = "RESOURCE_MISSING",
    DB_WRITE_FAILED = "DB_WRITE_FAILED",
    DB_OPEN_FAILED = "DB_OPEN_FAILED",
    FILE_WRITE_FAILED = "FILE_WRITE_FAILED",
    FILE_OPEN_FAILED = "FILE_OPEN_FAILED",
    PARSE_ERROR = "PARSE_ERROR",
    TIMEOUT = "TIMEOUT",
    UNKNOWN = "UNKNOWN",
}

/**
 * Error Object Interface
 */
export interface IZotFlowError {
    code: ZotFlowErrorCode;
    context: string;
    message: string;
    data?: any;
}

/**
 * ZotFlow Custom Error Class
 */
export class ZotFlowError extends Error implements IZotFlowError {
    public code: ZotFlowErrorCode;
    public context: string;
    public data?: any;

    constructor(
        code: ZotFlowErrorCode,
        context: string,
        message: string,
        data?: any,
    ) {
        super(message);
        this.name = "ZotFlowError";
        this.code = code;
        this.context = context;
        this.data = data;

        Object.setPrototypeOf(this, ZotFlowError.prototype);
    }

    /**
     * Static helper method: Determine if an arbitrary error object is a ZotFlowError
     */
    static isZotFlowError(error: any): error is IZotFlowError {
        return (
            error &&
            typeof error === "object" &&
            "code" in error &&
            Object.values(ZotFlowErrorCode).includes(error.code)
        );
    }

    /**
     * Wrap an arbitrary error into a ZotFlowError
     */
    static wrap(
        error: any,
        code: ZotFlowErrorCode,
        context: string,
        message: string,
        data?: any,
    ): ZotFlowError {
        if (error instanceof ZotFlowError) {
            return error;
        }

        const originalMsg =
            error instanceof Error ? error.message : String(error);
        const fullMessage = `${message}: ${originalMsg}`;

        return new ZotFlowError(code, context, fullMessage, {
            cause: error,
            ...data,
        });
    }
}
