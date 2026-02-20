import React, { useState, useEffect, useCallback } from "react";
import { ObsidianIcon } from "../ObsidianIcon";
import { workerBridge } from "bridge";
import { services } from "services/services";

import type { ITaskInfo } from "types/tasks";

function formatRelativeTime(timestamp: number): string {
    const elapsed = Date.now() - timestamp;
    if (elapsed < 5_000) return "Just now";
    if (elapsed < 60_000) return `${Math.floor(elapsed / 1000)}s ago`;
    if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
    return `${Math.floor(elapsed / 3_600_000)}h ago`;
}

export const SyncView: React.FC = () => {
    const [tasks, setTasks] = useState<ITaskInfo[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
    const [relativeTime, setRelativeTime] = useState("");

    useEffect(() => {
        const unsubscribe = services.taskMonitor.subscribe((allTasks) => {
            setTasks(allTasks);

            const runningSyncTask = allTasks.find(
                (t) => t.type === "sync" && t.status === "running",
            );
            setIsSyncing(!!runningSyncTask);

            const latestCompleted = allTasks
                .filter(
                    (t) =>
                        t.type === "sync" &&
                        (t.status === "completed" || t.status === "failed") &&
                        t.endTime,
                )
                .sort((a, b) => (b.endTime ?? 0) - (a.endTime ?? 0))[0];

            if (latestCompleted?.endTime) {
                setLastSyncTime(latestCompleted.endTime);
            }
        });
        return unsubscribe;
    }, []);

    // Update relative time display periodically
    useEffect(() => {
        if (!lastSyncTime) return;
        setRelativeTime(formatRelativeTime(lastSyncTime));
        const interval = setInterval(() => {
            setRelativeTime(formatRelativeTime(lastSyncTime));
        }, 10_000);
        return () => clearInterval(interval);
    }, [lastSyncTime]);

    const handleSync = useCallback(async () => {
        try {
            await workerBridge.createSyncTask();
        } catch {
            // Task monitor handles status updates
        }
    }, []);

    const syncTasks = tasks.filter((t) => t.type === "sync");
    const activeSyncTask = syncTasks.find((t) => t.status === "running");
    const historyTasks = syncTasks.filter(
        (t) =>
            t.status === "completed" ||
            t.status === "failed" ||
            t.status === "cancelled",
    );

    return (
        <div className="zotflow-sync-view">
            {/* Sync Controls */}
            <div className="zotflow-sync-controls">
                <div className="zotflow-sync-header">
                    <div className="zotflow-sync-header-left">
                        <h3>Synchronization</h3>
                        {lastSyncTime && (
                            <div className="zotflow-sync-last">
                                <ObsidianIcon icon="clock" />
                                <span>Last synced: {relativeTime}</span>
                            </div>
                        )}
                    </div>
                    <button
                        className={`zotflow-sync-btn ${isSyncing ? "is-syncing" : ""}`}
                        onClick={handleSync}
                        disabled={isSyncing}
                    >
                        <ObsidianIcon
                            icon="refresh-cw"
                            className={isSyncing ? "zotflow-spinning" : ""}
                        />
                        <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
                    </button>
                </div>
            </div>

            {/* Active Sync */}
            {activeSyncTask && (
                <div className="zotflow-sync-active">
                    <h3>Active</h3>
                    <div className="zotflow-sync-active-card">
                        <div className="zotflow-sync-active-header">
                            <ObsidianIcon
                                icon="refresh-cw"
                                className="zotflow-spinning"
                            />
                            <span className="zotflow-sync-active-label">
                                Syncing...
                            </span>
                        </div>
                        {activeSyncTask.progress.total > 0 && (
                            <div className="zotflow-task-progress-bar">
                                <div
                                    className="zotflow-task-progress-fill"
                                    style={{
                                        width: `${Math.round((activeSyncTask.progress.completed / activeSyncTask.progress.total) * 100)}%`,
                                    }}
                                />
                            </div>
                        )}
                        <div className="zotflow-task-message">
                            {activeSyncTask.progress.message}
                        </div>
                    </div>
                </div>
            )}

            {/* Session History */}
            <div className="zotflow-sync-history">
                <h3>History</h3>
                {historyTasks.length === 0 ? (
                    <div className="zotflow-tasks-empty">
                        <ObsidianIcon
                            icon="clock"
                            containerStyle={{
                                opacity: 0.4,
                            }}
                            iconStyle={{
                                width: "32px",
                                height: "32px",
                            }}
                        />
                        <p>No sync history yet</p>
                    </div>
                ) : (
                    <div className="zotflow-sync-history-list">
                        {historyTasks.map((task) => (
                            <SyncHistoryItem key={task.id} task={task} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const SyncHistoryItem: React.FC<{ task: ITaskInfo }> = ({ task }) => {
    const [expanded, setExpanded] = useState(false);

    const statusIcon =
        task.status === "completed"
            ? "check-circle"
            : task.status === "failed"
              ? "x-circle"
              : "ban";

    const statusClass =
        task.status === "completed"
            ? "zotflow-status-success"
            : task.status === "failed"
              ? "zotflow-status-error"
              : "zotflow-status-muted";

    const timeStr = task.endTime
        ? new Date(task.endTime).toLocaleTimeString("en-US", {
              hour12: false,
          })
        : "";

    return (
        <div
            className={`zotflow-sync-history-item ${expanded ? "is-expanded" : ""}`}
            onClick={() => setExpanded(!expanded)}
        >
            <div className="zotflow-sync-history-header">
                <span className={`zotflow-sync-history-icon ${statusClass}`}>
                    <ObsidianIcon icon={statusIcon} />
                </span>
                <span className="zotflow-sync-history-time">{timeStr}</span>
                <span className="zotflow-sync-history-msg">
                    {task.progress.message || `Sync ${task.status}`}
                </span>
            </div>
            {expanded && (
                <div className="zotflow-sync-history-details">
                    {task.result && (
                        <code>
                            {task.result.successCount} ok
                            {task.result.failCount > 0 &&
                                `, ${task.result.failCount} failed`}
                        </code>
                    )}
                    {task.error && (
                        <code className="zotflow-text-error">{task.error}</code>
                    )}
                </div>
            )}
        </div>
    );
};
