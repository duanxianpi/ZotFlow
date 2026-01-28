import { App } from "obsidian";

import type { ZotFlowSettings } from "settings/types";
import { IndexService } from "./index-service";

class ServiceLocator {
    private _app: App;
    private _settings: ZotFlowSettings;

    private _indexService: IndexService;

    initialize(app: App, settings: ZotFlowSettings) {
        this._app = app;
        this._settings = settings;

        this._indexService = new IndexService(app);
        this._indexService.load();

        console.log("[ZotFlow] Services initialized.");
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
}

// Export singleton
export const services = new ServiceLocator();
