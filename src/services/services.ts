import { App } from "obsidian";

import type { ZotFlowSettings } from "settings/types";
import { IndexService } from "./index-service";
import { LogService } from "./log-service";
import { NotificationService } from "./notification-service";

class ServiceLocator {
    private _app: App;
    private _settings: ZotFlowSettings;

    private _indexService: IndexService;
    private _logService: LogService;
    private _notificationService: NotificationService;

    initialize(app: App, settings: ZotFlowSettings) {
        this._app = app;
        this._settings = settings;

        this._logService = new LogService();
        this._notificationService = new NotificationService();
        this._indexService = new IndexService(app);
        this._indexService.load();

        this._logService.info("Services initialized.", "System");
    }

    updateSettings(newSettings: ZotFlowSettings) {
        this._settings = newSettings;
    }

    get app() {
        return this._app;
    }

    get settings() {
        return this._settings;
    }

    get indexService() {
        return this._indexService;
    }

    get logService() {
        return this._logService;
    }

    get notificationService() {
        return this._notificationService;
    }
}

// Export singleton
export const services = new ServiceLocator();
