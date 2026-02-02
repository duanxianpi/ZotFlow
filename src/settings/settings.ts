import { App, PluginSettingTab, setIcon, SettingGroup } from "obsidian";
import { SyncSection } from "./sections/sync-section";
import { WebDavSection } from "./sections/webdav-section";
import { CacheSection } from "./sections/cache-section";
import { GeneralSection } from "./sections/general-section";

import type ZotFlow from "main";
import type { TabSection } from "./types";

export class ZotFlowSettingTab extends PluginSettingTab {
    plugin: ZotFlow;
    activeTab: TabSection = "general";

    constructor(app: App, plugin: ZotFlow) {
        super(app, plugin);
        this.plugin = plugin;
        this.icon = "zotero-icon";
    }

    async display(): Promise<void> {
        await this.plugin.loadSettings();

        const { containerEl } = this;
        containerEl.empty();

        const settingsContainer = containerEl.createDiv({
            cls: "zotflow-settings-container",
        });

        const title = settingsContainer.createDiv({
            text: "ZotFlow Settings",
            cls: "zotflow-settings-title",
        });

        // Horizontal Navigation Tabs
        this.renderNav(settingsContainer);

        // Render Active Section Content
        const contentContainer = settingsContainer.createDiv({
            cls: "zotflow-settings-content",
        });

        const refreshUI = () => this.display();

        switch (this.activeTab) {
            case "sync":
                const syncSection = new SyncSection(this.plugin, refreshUI);
                await syncSection.render(contentContainer);
                break;
            case "webdav":
                const webDavSection = new WebDavSection(this.plugin, refreshUI);
                webDavSection.render(contentContainer);
                break;
            case "cache":
                const cacheSection = new CacheSection(this.plugin, refreshUI);
                await cacheSection.render(contentContainer);
                break;
            case "general":
                const generalSection = new GeneralSection(
                    this.plugin,
                    refreshUI,
                );
                generalSection.render(contentContainer);
                break;
        }
    }

    private renderNav(containerEl: HTMLElement) {
        const navContainer = containerEl.createDiv();
        navContainer.style.display = "flex";
        navContainer.style.marginTop = "0.5rem";
        navContainer.style.borderBottom =
            "1px solid var(--background-modifier-border)";
        navContainer.style.overflowX = "auto";
        navContainer.style.overflowY = "auto";

        const tabs: { id: TabSection; label: string; icon: string }[] = [
            { id: "general", label: "General", icon: "settings" },
            { id: "sync", label: "Sync", icon: "user" },
            { id: "webdav", label: "WebDAV", icon: "cloud" },
            { id: "cache", label: "Cache", icon: "database" },
        ];

        tabs.forEach((tab) => {
            const navItem = navContainer.createDiv({ cls: "nav-item" });

            navItem.style.cursor = "pointer";
            navItem.style.padding = "6px 24px";
            navItem.style.display = "flex";
            navItem.style.alignItems = "center";
            navItem.style.gap = "6px";
            navItem.style.fontWeight = "500";
            navItem.style.fontSize = "0.9rem";
            navItem.style.transition =
                "background-color 0.2s ease, color 0.2s ease";
            navItem.style.fontSize = "var(--font-ui-small)";

            // Icon
            const iconSpan = navItem.createSpan({ cls: "nav-icon" });
            setIcon(iconSpan, tab.icon);

            // Label
            navItem.createSpan({ text: tab.label });

            // State Styles
            if (this.activeTab === tab.id) {
                navItem.style.color = "var(--text-normal)";
                navItem.style.fontWeight = "600";
                navItem.style.borderBottom =
                    "2px solid var(--interactive-accent)";
            } else {
                // Inactive: Transparent background, muted text
                navItem.style.backgroundColor = "transparent";
                navItem.style.color = "var(--text-muted)";
            }

            // Hover Effect
            navItem.addEventListener("mouseenter", () => {
                if (this.activeTab !== tab.id) {
                    navItem.style.backgroundColor =
                        "var(--background-modifier-hover)";
                    navItem.style.color = "var(--text-normal)";
                }
            });
            navItem.addEventListener("mouseleave", () => {
                if (this.activeTab !== tab.id) {
                    navItem.style.backgroundColor = "transparent";
                    navItem.style.color = "var(--text-muted)";
                }
            });

            // Click Handler
            navItem.addEventListener("click", () => {
                this.activeTab = tab.id;
                this.display();
            });
        });
    }
}
