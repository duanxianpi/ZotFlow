import { App } from "obsidian";

import { TemplateService } from "./template-service";
import { NoteService } from "./note-service";

import type { ZotFlowSettings } from "settings/types";

class ServiceLocator {
    private _app: App;
    private _settings: ZotFlowSettings;
    private _template: TemplateService;
    private _note: NoteService;

    initialize(app: App, settings: ZotFlowSettings) {
        this._app = app;
        this._settings = settings;
        this._template = new TemplateService(app, this._settings);
        this._note = new NoteService(app, this._template, this._settings);

        console.log("[ZotFlow] Services initialized.");
    }

    updateSettings(newSettings: ZotFlowSettings) {
        this._settings = newSettings;
        this._template.updateSettings(newSettings);
        this._note.updateSettings(newSettings);
    }

    get app() {
        return this._app;
    }

    get settings() {
        return this._settings;
    }

    get template() {
        return this._template;
    }

    get note() {
        return this._note;
    }
}

// Export singleton
export const services = new ServiceLocator();
