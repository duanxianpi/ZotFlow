import { App, PluginSettingTab, setIcon, SettingGroup } from "obsidian";
import MyPlugin from "../main";
import { SyncSection } from "./sections/sync-section";
import { WebDavSection } from "./sections/webdav-section";
import { CacheSection } from "./sections/cache-section";
import { TabSection } from "./types";

export class ZotFlowSettingTab extends PluginSettingTab {
    plugin: MyPlugin;
    activeTab: TabSection = "sync";

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();

        // const title = containerEl.createEl( { text: "Obsidian ZotFlow" });
        // title.style.paddingInline = "0px";

        // Horizontal Navigation Tabs
        this.renderNav(containerEl);

        // Render Active Section Content
        const contentContainer = containerEl.createDiv({
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
        }
    }

    private renderNav(containerEl: HTMLElement) {
        const navContainer = containerEl.createDiv();
        navContainer.style.display = "flex";
        // navContainer.style.gap = "8px"; // Spacing between pills
        navContainer.style.marginTop = "0.5rem";
        navContainer.style.marginBottom = "1rem";
        // navContainer.style.paddingBottom = "0.75rem";
        navContainer.style.borderBottom =
            "1px solid var(--background-modifier-border)";

        const tabs: { id: TabSection; label: string; icon: string }[] = [
            { id: "sync", label: "Sync", icon: "user" },
            { id: "cache", label: "Cache", icon: "database" },
            { id: "webdav", label: "WebDAV", icon: "cloud" },
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
