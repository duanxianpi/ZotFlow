import React, { useState } from "react";
import { ObsidianIcon } from "../ObsidianIcon";
import { SyncView } from "./SyncView";
// import { TasksView } from "./TasksView";
// import { TelemetryView } from "./TelemetryView";

export const ZotFlowActivityCenter: React.FC = () => {
    const [activeTab, setActiveTab] = useState("sync");

    const tabs = [
        { id: "sync", label: "Sync", icon: "refresh-cw" },
        { id: "tasks", label: "Tasks", icon: "list" },
        { id: "telemetry", label: "Telemetry", icon: "activity" },
    ];

    return (
        <>
            <div className="zotflow-ac-tabs">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <div
                            key={tab.id}
                            className={`zotflow-ac-tab ${isActive ? "is-active" : ""}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="nav-icon">
                                <ObsidianIcon
                                    icon={tab.icon}
                                    style={{ width: 16, height: 16 }}
                                />
                            </span>
                            <span>{tab.label}</span>
                        </div>
                    );
                })}
            </div>

            <div className="zotflow-ac-content">
                {activeTab === "sync" && <SyncView />}
                {/* {activeTab === "tasks" && <TasksView />} */}
                {/* {activeTab === "telemetry" && <TelemetryView />} */}
            </div>
        </>
    );
};
