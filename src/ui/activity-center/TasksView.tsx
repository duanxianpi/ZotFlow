import React, { useEffect, useState, useCallback } from "react";
import { ObsidianIcon } from "../ObsidianIcon";
import { workerBridge } from "bridge";
import { services } from "services/services";

import type { ITaskInfo, TaskType } from "types/tasks";

const TASK_TYPE_LABELS: Record<TaskType, string> = {
    sync: "Sync",
    "batch-create-notes": "Batch Create Notes",
    "batch-update-notes": "Batch Update Notes",
    "batch-extract-images": "Extract Images",
    "batch-extract-external-annotations": "Extract External Annotations",
    "download-attachment": "Download Attachment",
    "test-task": "Test Task",
};

const TASK_TYPE_ICONS: Record<TaskType, string> = {
    sync: "refresh-cw",
    "batch-create-notes": "file-plus",
    "batch-update-notes": "file-edit",
    "batch-extract-images": "image",
    "batch-extract-external-annotations": "scan-search",
    "download-attachment": "download",
    "test-task": "flask-conical",
};

function getStatusIcon(status: string): string {
    switch (status) {
        case "running":
            return "loader";
        case "completed":
            return "check-circle";
        case "failed":
            return "x-circle";
        case "cancelled":
            return "ban";
        case "pending":
        default:
            return "clock";
    }
}

function getStatusClass(status: string): string {
    switch (status) {
        case "running":
            return "zotflow-task-running";
        case "completed":
            return "zotflow-task-completed";
        case "failed":
            return "zotflow-task-failed";
        case "cancelled":
            return "zotflow-task-cancelled";
        case "pending":
        default:
            return "zotflow-task-pending";
    }
}

function formatDuration(start?: number, end?: number): string {
    if (!start) return "";
    const elapsed = (end ?? Date.now()) - start;
    if (elapsed < 1000) return `${elapsed}ms`;
    if (elapsed < 60_000) return `${(elapsed / 1000).toFixed(1)}s`;
    return `${Math.floor(elapsed / 60_000)}m ${Math.floor((elapsed % 60_000) / 1000)}s`;
}

const TaskItem: React.FC<{ task: ITaskInfo }> = ({ task }) => {
    const label = TASK_TYPE_LABELS[task.type] ?? task.type;
    const icon = TASK_TYPE_ICONS[task.type] ?? "list";
    const statusIcon = getStatusIcon(task.status);
    const statusClass = getStatusClass(task.status);

    const progressPercent =
        task.progress.total > 0
            ? Math.round(
                  (task.progress.completed / task.progress.total) * 100,
              )
            : 0;

    const handleCancel = useCallback(() => {
        workerBridge.cancelTask(task.id);
    }, [task.id]);

    return (
        <div className={`zotflow-task-item ${statusClass}`}>
            <div className="zotflow-task-header">
                <span className="zotflow-task-icon">
                    <ObsidianIcon
                        icon={icon}
                        style={{ width: 16, height: 16 }}
                    />
                </span>
                <span className="zotflow-task-label">{label}</span>
                <span className="zotflow-task-status-icon">
                    <ObsidianIcon
                        icon={statusIcon}
                        style={{ width: 14, height: 14 }}
                    />
                </span>
                {task.canCancel && (
                    <button
                        className="zotflow-task-cancel-btn clickable-icon"
                        onClick={handleCancel}
                        aria-label="Cancel task"
                    >
                        <ObsidianIcon
                            icon="x"
                            style={{ width: 14, height: 14 }}
                        />
                    </button>
                )}
            </div>

            {/* Progress bar */}
            {task.status === "running" && task.progress.total > 0 && (
                <div className="zotflow-task-progress-bar">
                    <div
                        className="zotflow-task-progress-fill"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            )}

            {/* Message */}
            <div className="zotflow-task-message">{task.progress.message}</div>

            {/* Footer: duration + result */}
            <div className="zotflow-task-footer">
                {task.startTime && (
                    <span className="zotflow-task-duration">
                        {formatDuration(task.startTime, task.endTime)}
                    </span>
                )}
                {task.result && (
                    <span className="zotflow-task-result">
                        {task.result.successCount} ok
                        {task.result.failCount > 0 &&
                            `, ${task.result.failCount} failed`}
                    </span>
                )}
            </div>

            {/* Error */}
            {task.error && (
                <div className="zotflow-task-error">{task.error}</div>
            )}
        </div>
    );
};

export const TasksView: React.FC = () => {
    const [tasks, setTasks] = useState<ITaskInfo[]>([]);

    useEffect(() => {
        const unsubscribe = services.taskMonitor.subscribe(setTasks);
        return unsubscribe;
    }, []);

    if (tasks.length === 0) {
        return (
            <div className="zotflow-tasks-empty">
                <ObsidianIcon
                    icon="list"
                    style={{ width: 32, height: 32, opacity: 0.4 }}
                />
                <p>No tasks yet</p>
            </div>
        );
    }

    return (
        <div className="zotflow-tasks-list">
            {tasks.map((task) => (
                <TaskItem key={task.id} task={task} />
            ))}
        </div>
    );
};
