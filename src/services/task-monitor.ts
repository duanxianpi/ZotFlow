import { App } from "obsidian";
import type { ITaskInfo } from "types/tasks";

type TaskUpdateCallback = (tasks: ITaskInfo[]) => void;

export class TaskMonitor {
    private tasks: Map<string, ITaskInfo> = new Map();
    private subscribers: Set<TaskUpdateCallback> = new Set();

    constructor(private app: App) {}

    /**
     * Called by ParentHost when a task updates in the worker
     */
    public onTaskUpdate(taskId: string, info: ITaskInfo) {
        this.tasks.set(taskId, info);
        this.notifySubscribers();

        // Cleanup completed/failed tasks after delay (optional, handled by UI mostly)
    }

    public getTasks(): ITaskInfo[] {
        return Array.from(this.tasks.values()).sort(
            (a, b) => b.createdTime - a.createdTime,
        );
    }

    public subscribe(callback: TaskUpdateCallback): () => void {
        this.subscribers.add(callback);
        // Initial call
        callback(this.getTasks());

        return () => {
            this.subscribers.delete(callback);
        };
    }

    private notifySubscribers() {
        const list = this.getTasks();
        this.subscribers.forEach((cb) => cb(list));
    }
}
