import React, { useState, useEffect, useCallback } from "react";
import { ObsidianIcon } from "../ObsidianIcon";
import { db } from "db/db";
import { workerBridge } from "bridge";
import { services } from "services/services";

import type { IDBZoteroKey, IDBZoteroLibrary } from "types/db-schema";
import type { LibrarySyncMode, ZotFlowSettings } from "settings/types";
import type {
    ConflictItemInfo,
    ConflictCollectionInfo,
    ConflictAction,
    FieldDiff,
} from "worker/services/conflict";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LibraryRow {
    id: number;
    type: "user" | "group";
    name: string;
    canWrite: boolean;
    mode: LibrarySyncMode;
    syncedAt: string; // ISO or display string
}

interface ConflictEntry {
    kind: "item" | "collection";
    data: ConflictItemInfo | ConflictCollectionInfo;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatSyncTime(iso: string): string {
    if (!iso) return "Never";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-US", {
        hour12: false,
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

/* ------------------------------------------------------------------ */
/*  Data loading                                                       */
/* ------------------------------------------------------------------ */

async function loadLibraries(settings: ZotFlowSettings): Promise<LibraryRow[]> {
    const keyInfo: IDBZoteroKey | undefined = await db.keys.get(
        settings.zoteroapikey,
    );
    if (!keyInfo) return [];

    const rows: LibraryRow[] = [];

    // Personal library
    if (keyInfo.access.user) {
        const u = keyInfo.access.user;
        const canWrite = !!u.write;
        const libState: IDBZoteroLibrary | undefined = await db.libraries.get(
            keyInfo.userID,
        );
        const mode =
            settings.librariesConfig[keyInfo.userID]?.mode ??
            (canWrite ? "bidirectional" : "readonly");

        rows.push({
            id: keyInfo.userID,
            type: "user",
            name: "My Library",
            canWrite,
            mode,
            syncedAt: libState?.syncedAt ?? "",
        });
    }

    // Group libraries
    for (const groupId of keyInfo.joinedGroups) {
        const group = await db.groups.get(groupId);
        if (!group) continue;
        const gAccess = keyInfo.access.groups;
        const specific = gAccess?.[groupId];
        const all = gAccess?.all;
        const canWrite = specific?.write ?? all?.write ?? false;
        const libState: IDBZoteroLibrary | undefined = await db.libraries.get(
            group.id,
        );
        const mode =
            settings.librariesConfig[group.id]?.mode ??
            (canWrite ? "bidirectional" : "readonly");

        rows.push({
            id: group.id,
            type: "group",
            name: group.name,
            canWrite,
            mode,
            syncedAt: libState?.syncedAt ?? "",
        });
    }

    return rows;
}

/** Load all conflicts via the ConflictService in the worker. */
async function loadConflicts(): Promise<ConflictEntry[]> {
    const [itemConflicts, colConflicts] = await Promise.all([
        workerBridge.conflict.getItemConflicts(),
        workerBridge.conflict.getCollectionConflicts(),
    ]);

    const entries: ConflictEntry[] = [];

    for (const ic of itemConflicts) {
        entries.push({ kind: "item", data: ic });
    }
    for (const cc of colConflicts) {
        entries.push({ kind: "collection", data: cc });
    }

    return entries;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

const LibraryTable: React.FC<{
    libraries: LibraryRow[];
    syncingAll: boolean;
    syncingLibId: number | null;
    onSyncLibrary: (id: number) => void;
    onSyncAll: () => void;
}> = ({ libraries, syncingAll, syncingLibId, onSyncLibrary, onSyncAll }) => {
    if (libraries.length === 0) {
        return (
            <div className="zotflow-sync-empty">
                <ObsidianIcon icon="info" />
                <span>
                    No libraries found. Verify your API key in Settings.
                </span>
            </div>
        );
    }

    return (
        <>
            <div className="zotflow-sync-actions">
                <button
                    disabled={syncingAll || syncingLibId !== null}
                    onClick={onSyncAll}
                >
                    <span>{syncingAll ? "Syncing..." : "Sync All"}</span>
                </button>
            </div>
            <div className="zotflow-sync-lib-table-wrapper">
                <table className="zotflow-sync-lib-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Name</th>
                            <th>Access</th>
                            <th>Sync Mode</th>
                            <th>Last Synced</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {libraries.map((lib) => {
                            const isSyncing =
                                syncingAll || syncingLibId === lib.id;
                            const isIgnored = lib.mode === "ignored";
                            return (
                                <tr
                                    key={lib.id}
                                    className={
                                        isIgnored
                                            ? "zotflow-sync-lib-row-ignored"
                                            : ""
                                    }
                                >
                                    <td>
                                        <span className="zotflow-sync-lib-type">
                                            <ObsidianIcon
                                                icon={
                                                    lib.type === "user"
                                                        ? "user"
                                                        : "users"
                                                }
                                            />
                                            <span>
                                                {lib.type === "user"
                                                    ? "Personal"
                                                    : "Group"}
                                            </span>
                                        </span>
                                    </td>
                                    <td title={`ID: ${lib.id}`}>{lib.name}</td>
                                    <td>
                                        <span
                                            className={
                                                lib.canWrite
                                                    ? "zotflow-sync-badge zotflow-sync-badge--rw"
                                                    : "zotflow-sync-badge zotflow-sync-badge--ro"
                                            }
                                        >
                                            {lib.canWrite
                                                ? "Read/Write"
                                                : "Read Only"}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="zotflow-sync-mode-label">
                                            {lib.mode === "bidirectional"
                                                ? "Bidirectional"
                                                : lib.mode === "readonly"
                                                  ? "Read-Only"
                                                  : "Ignored"}
                                        </span>
                                    </td>
                                    <td className="zotflow-sync-time-cell">
                                        {lib.syncedAt
                                            ? formatSyncTime(lib.syncedAt)
                                            : "Never"}
                                    </td>
                                    <td>
                                        <button
                                            disabled={isSyncing || isIgnored}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSyncLibrary(lib.id);
                                            }}
                                            title={
                                                isIgnored
                                                    ? "Library is set to Ignored"
                                                    : `Sync ${lib.name}`
                                            }
                                        >
                                            Sync
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );
};

const ConflictPanel: React.FC<{
    conflicts: ConflictEntry[];
    selectedKey: string | null;
    onSelect: (key: string) => void;
    onResolve: (entry: ConflictEntry, action: ConflictAction) => void;
}> = ({ conflicts, selectedKey, onSelect, onResolve }) => {
    const selected = conflicts.find(
        (c) => `${c.data.libraryID}:${c.data.key}` === selectedKey,
    );

    if (conflicts.length === 0) {
        return (
            <div className="zotflow-sync-empty">
                <ObsidianIcon
                    icon="check-circle"
                    iconStyle={{ color: "var(--text-faint)" }}
                />
                <span>No conflicts. Everything is in sync.</span>
            </div>
        );
    }

    return (
        <div className="zotflow-conflict-container">
            {/* Conflict list sidebar */}
            <div className="zotflow-conflict-list">
                {conflicts.map((c) => {
                    const id = `${c.data.libraryID}:${c.data.key}`;
                    const label =
                        c.kind === "item"
                            ? (c.data as ConflictItemInfo).title
                            : (c.data as ConflictCollectionInfo).name;
                    const badge =
                        c.kind === "item"
                            ? (c.data as ConflictItemInfo).conflictType
                            : "collection";

                    return (
                        <div
                            key={id}
                            className={`zotflow-conflict-item ${selectedKey === id ? "is-selected" : ""}`}
                            onClick={() => onSelect(id)}
                        >
                            <div className="zotflow-conflict-item-header">
                                <span className="zotflow-conflict-key">
                                    {c.data.key}
                                </span>
                                <span
                                    className={`zotflow-conflict-type-badge zotflow-conflict-type-badge--${badge}`}
                                >
                                    {badge}
                                </span>
                            </div>
                            <span className="zotflow-conflict-title">
                                {label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Diff pane */}
            {selected ? (
                <ConflictDiffPane entry={selected} onResolve={onResolve} />
            ) : (
                <div className="zotflow-conflict-diff zotflow-sync-empty">
                    <ObsidianIcon icon="arrow-left" />
                    <span>Select a conflict to view details.</span>
                </div>
            )}
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  ConflictDiffPane — field-level diff table                          */
/* ------------------------------------------------------------------ */

/** Fields hidden by default (noisy / internal metadata). */
const DEFAULT_HIDDEN_FIELDS = new Set([
    // "creators",
    // "tags",
    // "relations",
    // "collections",
    "annotationIsExternal",
    "annotationAuthorName",
    // "dateAdded",
    // "dateModified",
]);

const ConflictDiffPane: React.FC<{
    entry: ConflictEntry;
    onResolve: (entry: ConflictEntry, action: ConflictAction) => void;
}> = ({ entry, onResolve }) => {
    const isItem = entry.kind === "item";
    const heading = isItem
        ? (entry.data as ConflictItemInfo).title
        : (entry.data as ConflictCollectionInfo).name;

    const fields = entry.data.fields.filter(
        (f) => !DEFAULT_HIDDEN_FIELDS.has(f.field),
    );
    const syncError = isItem
        ? (entry.data as ConflictItemInfo).syncError
        : (entry.data as ConflictCollectionInfo).syncError;

    return (
        <div className="zotflow-conflict-diff">
            <span className="zotflow-conflict-diff-heading">{heading}</span>

            {syncError && (
                <div className="zotflow-conflict-sync-error">
                    <ObsidianIcon icon="alert-triangle" />
                    <span>{syncError}</span>
                </div>
            )}

            {fields.length > 0 ? (
                <div className="zotflow-field-diff-wrapper">
                    <table className="zotflow-field-diff-table">
                        <thead>
                            <tr>
                                <th>Field</th>
                                <th className="zotflow-field-diff-local">
                                    Local (Obsidian)
                                </th>
                                <th className="zotflow-field-diff-remote">
                                    Remote (Zotero)
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {fields.map((f) => (
                                <tr key={f.field}>
                                    <td className="zotflow-field-diff-name">
                                        {f.field}
                                    </td>
                                    <td className="zotflow-field-diff-val zotflow-field-diff-val--local">
                                        <pre>{f.localValue}</pre>
                                    </td>
                                    <td className="zotflow-field-diff-val zotflow-field-diff-val--remote">
                                        <pre>{f.remoteValue}</pre>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="zotflow-sync-empty">
                    <ObsidianIcon icon="info" />
                    <span>No field differences detected.</span>
                </div>
            )}

            <div className="zotflow-conflict-actions">
                <button
                    className="zotflow-conflict-btn zotflow-conflict-btn--local"
                    onClick={() => onResolve(entry, "keep-local")}
                >
                    Keep Local
                </button>
                <button
                    className="zotflow-conflict-btn zotflow-conflict-btn--remote"
                    onClick={() => onResolve(entry, "accept-remote")}
                >
                    Accept Remote
                </button>
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  Main SyncView                                                      */
/* ------------------------------------------------------------------ */

export const SyncView: React.FC = () => {
    const [libraries, setLibraries] = useState<LibraryRow[]>([]);
    const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
    const [selectedConflict, setSelectedConflict] = useState<string | null>(
        null,
    );
    const [syncingAll, setSyncingAll] = useState(false);
    const [syncingLibId, setSyncingLibId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasResolvedConflicts, setHasResolvedConflicts] = useState(false);

    // Load data on mount
    const refresh = useCallback(async () => {
        try {
            const settings = services.settings;
            const [libs, conf] = await Promise.all([
                loadLibraries(settings),
                loadConflicts(),
            ]);
            setLibraries(libs);
            setConflicts(conf);
        } catch (e) {
            services.logService.error(
                "Failed to load sync data",
                "SyncView",
                e,
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    // Auto-refresh when a sync task completes or fails
    useEffect(() => {
        const prevStatus = new Map<string, string>();

        const unsubscribe = services.taskMonitor.subscribe((tasks) => {
            for (const task of tasks) {
                const prev = prevStatus.get(task.id);
                prevStatus.set(task.id, task.status);

                // Only refresh when a sync task transitions to a terminal state
                if (
                    task.type === "sync" &&
                    prev !== undefined &&
                    prev !== task.status &&
                    (task.status === "completed" || task.status === "failed")
                ) {
                    void refresh();
                    return;
                }
            }
        });

        return unsubscribe;
    }, [refresh]);

    // Sync all libraries
    const handleSyncAll = useCallback(async () => {
        setSyncingAll(true);
        try {
            await workerBridge.createSyncTask();
            services.notificationService.notify("success", "Sync started.");
        } catch (e) {
            services.logService.error("Sync all failed", "SyncView", e);
            services.notificationService.notify("error", "Sync failed.");
        } finally {
            setSyncingAll(false);
            // Refresh libraries to get updated sync times
            void refresh();
        }
    }, [refresh]);

    // Sync a single library
    const handleSyncLibrary = useCallback(
        async (libId: number) => {
            setSyncingLibId(libId);
            try {
                await workerBridge.createSyncTask(libId);
                services.notificationService.notify("success", "Sync started.");
            } catch (e) {
                services.logService.error(
                    `Sync library ${libId} failed`,
                    "SyncView",
                    e,
                );
                services.notificationService.notify("error", "Sync failed.");
            } finally {
                setSyncingLibId(null);
                void refresh();
            }
        },
        [refresh],
    );

    // Conflict resolution via ConflictService in worker
    const handleResolve = useCallback(
        async (entry: ConflictEntry, action: ConflictAction) => {
            const { libraryID, key } = entry.data;
            try {
                if (entry.kind === "item") {
                    await workerBridge.conflict.resolveItemConflict(
                        libraryID,
                        key,
                        action,
                    );
                } else {
                    await workerBridge.conflict.resolveCollectionConflict(
                        libraryID,
                        key,
                        action,
                    );
                }

                services.logService.info(
                    `Conflict resolved (${action}): ${key}`,
                    "SyncView",
                );
                services.notificationService.notify(
                    "success",
                    `Conflict resolved: ${action === "keep-local" ? "kept local" : "accepted remote"}.`,
                );

                setHasResolvedConflicts(true);

                // Remove from local state
                setConflicts((prev) =>
                    prev.filter(
                        (c) =>
                            !(
                                c.data.libraryID === libraryID &&
                                c.data.key === key
                            ),
                    ),
                );

                // Clear selection if resolved
                const resolvedId = `${libraryID}:${key}`;
                setSelectedConflict((prev) =>
                    prev === resolvedId ? null : prev,
                );
            } catch (e) {
                services.logService.error(
                    "Conflict resolution failed",
                    "SyncView",
                    e,
                );
                services.notificationService.notify(
                    "error",
                    "Failed to resolve conflict.",
                );
            }
        },
        [],
    );

    if (loading) {
        return (
            <div className="zotflow-sync-view">
                <div className="zotflow-sync-empty">
                    <ObsidianIcon icon="loader" className="zotflow-spin" />
                    <span>Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="zotflow-sync-view">
            {/* Section 1: Sync Controls */}
            <div className="zotflow-sync-controls">
                <span className="zotflow-sync-section-header">
                    Sync Libraries
                </span>
                <LibraryTable
                    libraries={libraries}
                    syncingAll={syncingAll}
                    syncingLibId={syncingLibId}
                    onSyncLibrary={handleSyncLibrary}
                    onSyncAll={handleSyncAll}
                />
            </div>

            {/* Section 2: Merge Conflicts */}
            <div className="zotflow-sync-conflicts">
                <span className="zotflow-sync-section-header">
                    Merge Conflicts
                    {conflicts.length > 0 && (
                        <span className="zotflow-sync-conflict-badge">
                            {conflicts.length}
                        </span>
                    )}
                </span>
                <ConflictPanel
                    conflicts={conflicts}
                    selectedKey={selectedConflict}
                    onSelect={setSelectedConflict}
                    onResolve={handleResolve}
                />
                {hasResolvedConflicts && conflicts.length === 0 && (
                    <div className="zotflow-sync-reminder">
                        <ObsidianIcon icon="info" />
                        <span>
                            All conflicts resolved. Run a sync to push your
                            changes to Zotero.
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};
