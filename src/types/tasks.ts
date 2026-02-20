export type TaskStatus =
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "cancelled";

export type TaskType =
    | "sync"
    | "batch-create-notes"
    | "batch-update-notes"
    | "batch-extract-images"
    | "batch-extract-external-annotations"
    | "download-attachment"
    | "test-task";

export interface ITaskProgress {
    completed: number;
    total: number;
    message: string;
}

export interface ITaskResult {
    successCount: number;
    failCount: number;
    /** Structured details for display in the Activity Center (e.g. { items: 50, updated: 3 }) */
    details?: Record<string, string | number>;
}

export interface ITaskInfo {
    id: string;
    type: TaskType;
    status: TaskStatus;
    /** Human-readable title shown in both active and history views */
    displayText: string;
    progress: ITaskProgress;
    result?: ITaskResult;
    /** Captured input context for display in expanded details */
    input?: Record<string, string | number>;
    createdTime: number;
    startTime?: number;
    endTime?: number;
    error?: string;
    canCancel: boolean;
}

export interface ITaskOptions {
    id?: string; // Optional custom ID
    signal?: AbortSignal;
}
