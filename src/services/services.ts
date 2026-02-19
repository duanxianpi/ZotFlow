import { App } from "obsidian";

import type { ZotFlowSettings } from "settings/types";
import { IndexService } from "./index-service";
import { LogService } from "./log-service";
import { NotificationService } from "./notification-service";
import { TaskMonitor } from "./task-monitor";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";

class ServiceLocator {
    private _app: App;
    private _settings: ZotFlowSettings;
    private _initialized = false;

    private _indexService: IndexService;
    private _logService: LogService;
    private _notificationService: NotificationService;
    private _taskMonitor: TaskMonitor;

    initialize(app: App, settings: ZotFlowSettings) {
        this._app = app;
        this._settings = settings;

        this._logService = new LogService();
        this._notificationService = new NotificationService();

        this._indexService = new IndexService(app, this._logService);
        this._indexService.load();

        this._taskMonitor = new TaskMonitor(app);

        this._initialized = true;
        this._logService.info("Services initialized.", "LocalServiceLocator");
    }

    private assertInitialized(): void {
        if (!this._initialized) {
            throw new ZotFlowError(
                ZotFlowErrorCode.RESOURCE_MISSING,
                "LocalServiceLocator",
                "ServiceLocator not initialized. Call initialize() first.",
            );
        }
    }

    updateSettings(newSettings: ZotFlowSettings) {
        this._settings = newSettings;
    }

    get app() {
        this.assertInitialized();
        return this._app;
    }

    get settings() {
        this.assertInitialized();
        return this._settings;
    }

    get indexService() {
        this.assertInitialized();
        return this._indexService;
    }

    get logService() {
        this.assertInitialized();
        return this._logService;
    }

    get notificationService() {
        this.assertInitialized();
        return this._notificationService;
    }

    get taskMonitor() {
        this.assertInitialized();
        return this._taskMonitor;
    }
}

// Export singleton
export const services = new ServiceLocator();
