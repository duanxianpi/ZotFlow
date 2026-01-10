import { ZotFlowSettings } from "settings/settings";
import { ZoteroApiClient } from 'api/zotero-api';
import { SyncService } from './sync-service';
import { FileManager } from './file-manager';
import { ApiChain } from "zotero-api-client";
import { WebDavClient } from "api/webdav-api";

class ServiceLocator {
    public api: ZoteroApiClient;

    public sync: SyncService;
    public files: FileManager;
    public webdav: WebDavClient;

    public settings: ZotFlowSettings;

    initialize(settings: ZotFlowSettings) {
        this.settings = settings;

        // Initialize API client
        this.api = new ZoteroApiClient(settings.zoteroApiKey);


        // Initialize WebDAV client
        this.webdav = new WebDavClient(
            settings.webDavUrl || '',
            settings.webDavUser || '',
            settings.webDavPassword || ''
        );

        // Inject API client to services
        this.sync = new SyncService(this.api, this.settings);
        this.files = new FileManager(this.webdav, this.sync, this.settings);

        console.log("[ZotFlow] Services initialized.");
    }

    updateSettings(newSettings: ZotFlowSettings) {

        // If API Key changed, rebuild API client
        const apiKeyChanged = this.settings.zoteroApiKey !== newSettings.zoteroApiKey;

        if (apiKeyChanged) {
            console.log("[ZotFlow] API Key changed, refreshing client...");
            this.api.updateCredentials(newSettings.zoteroApiKey);
        }

        // Update WebDAV credentials
        this.webdav.updateCredentials(
            newSettings.webDavUrl || '',
            newSettings.webDavUser || '',
            newSettings.webDavPassword || ''
        );

        // Update other settings
        this.files.updateSettings(newSettings);

        this.settings = newSettings;
    }

}

// Export singleton
export const services = new ServiceLocator();
