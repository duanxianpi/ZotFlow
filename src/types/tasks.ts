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
}

export interface ITaskInfo {
    id: string;
    type: TaskType;
    status: TaskStatus;
    progress: ITaskProgress;
    result?: ITaskResult;
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
