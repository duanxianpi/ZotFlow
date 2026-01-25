import type { ZotFlowSettings } from "settings/types";

export class SettingsService {
    private _settings: ZotFlowSettings;

    constructor(settings: ZotFlowSettings) {
        this._settings = settings;
    }

    get settings() {
        return this._settings;
    }

    updateSettings(newSettings: ZotFlowSettings) {
        this._settings = newSettings;
    }
}
