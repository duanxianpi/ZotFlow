import React, { useState, useEffect, useCallback, useRef } from "react";
import { ObsidianIcon } from "../ObsidianIcon";
import { services } from "services/services";

import type { LogLevel, LogEntry } from "services/log-service";

type LogFilter = "all" | LogLevel;

function getLogLevelClass(level: LogLevel): string {
    switch (level) {
        case "error":
            return "zotflow-log-error";
        case "warn":
            return "zotflow-log-warn";
        case "debug":
            return "zotflow-log-debug";
        case "info":
        default:
            return "";
    }
}

function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleTimeString("en-US", { hour12: false });
}

export const TelemetryView: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [filter, setFilter] = useState<LogFilter>("all");
    const [search, setSearch] = useState("");
    const consoleRef = useRef<HTMLDivElement>(null);

    // Poll logs from LogService (it's an in-memory buffer, no pub/sub)
    useEffect(() => {
        const refresh = () => {
            setLogs([...services.logService.logs]);
        };
        refresh();
        const interval = setInterval(refresh, 1_000);
        return () => clearInterval(interval);
    }, []);

    const filteredLogs = logs.filter((entry) => {
        const matchesFilter = filter === "all" || entry.level === filter;
        if (!matchesFilter) return false;

        if (search) {
            const q = search.toLowerCase();
            const inMessage = entry.message.toLowerCase().includes(q);
            const inContext = entry.context?.toLowerCase().includes(q) ?? false;
            return inMessage || inContext;
        }
        return true;
    });

    const handleCopy = useCallback(() => {
        const text = filteredLogs
            .map(
                (e) =>
                    `[${formatTimestamp(e.timestamp)}] [${e.level.toUpperCase()}]${e.context ? ` [${e.context}]` : ""} ${e.message}`,
            )
            .join("\n");
        navigator.clipboard.writeText(text);
        services.notificationService.notify(
            "success",
            "Logs copied to clipboard",
        );
    }, [filteredLogs]);

    const handleClear = useCallback(() => {
        services.logService.clearLogs();
        setLogs([]);
    }, []);

    return (
        <div className="zotflow-telemetry-view">
            <div className="zotflow-telemetry-toolbar">
                <select
                    className="dropdown zotflow-telemetry-filter"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as LogFilter)}
                >
                    <option value="all">All</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="error">Error</option>
                    <option value="debug">Debug</option>
                </select>
                <input
                    type="text"
                    className="zotflow-telemetry-search"
                    placeholder="Search logs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button
                    className="zotflow-telemetry-toolbar-btn clickable-icon"
                    onClick={handleCopy}
                    aria-label="Copy all logs"
                >
                    <ObsidianIcon icon="copy" />
                </button>
                <button
                    className="zotflow-telemetry-toolbar-btn clickable-icon"
                    onClick={handleClear}
                    aria-label="Clear logs"
                >
                    <ObsidianIcon icon="trash-2" />
                </button>
            </div>
            <div className="zotflow-log-console" ref={consoleRef}>
                {filteredLogs.length === 0 ? (
                    <div className="zotflow-log-empty">
                        No logs match current filters.
                    </div>
                ) : (
                    filteredLogs.map((entry) => (
                        <div
                            key={entry.id}
                            className={`zotflow-log-line ${getLogLevelClass(entry.level)}`}
                        >
                            <span className="zotflow-log-time">
                                {formatTimestamp(entry.timestamp)}
                            </span>
                            <span className="zotflow-log-level">
                                {entry.level.toUpperCase()}
                            </span>
                            {entry.context && (
                                <span className="zotflow-log-context">
                                    [{entry.context}]
                                </span>
                            )}
                            <span className="zotflow-log-msg">
                                {entry.message}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
