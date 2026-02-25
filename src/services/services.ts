import { IndexService } from "./index-service";
import { LogService } from "./log-service";
import { NotificationService } from "./notification-service";
import { ViewStateService } from "./view-state-service";
import { TaskMonitor } from "./task-monitor";
import { ZotFlowError, ZotFlowErrorCode } from "utils/error";

import type { App, Plugin } from "obsidian";
import type { ZotFlowSettings } from "settings/types";

class ServiceLocator {
    private _app: App;
    private _plugin: Plugin;
    private _settings: ZotFlowSettings;
    private _initialized = false;

    private _indexService: IndexService;
    private _logService: LogService;
    private _notificationService: NotificationService;
    private _viewStateService: ViewStateService;
    private _taskMonitor: TaskMonitor;

    initialize(plugin: Plugin, settings: ZotFlowSettings) {
        this._plugin = plugin;
        this._app = plugin.app;
        this._settings = settings;

        this._logService = new LogService();
        this._notificationService = new NotificationService();
        this._viewStateService = new ViewStateService(
            this._plugin,
            this._logService,
            () => this._settings,
        );
        this._indexService = new IndexService(this._app, this._logService);
        this._indexService.load();

        this._taskMonitor = new TaskMonitor(this._app);

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

    get plugin() {
        this.assertInitialized();
        return this._plugin;
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

    get viewStateService() {
        this.assertInitialized();
        return this._viewStateService;
    }

    get taskMonitor() {
        this.assertInitialized();
        return this._taskMonitor;
    }
}

/** Singleton `ServiceLocator` instance providing access to all main-thread services. */
export const services = new ServiceLocator();
