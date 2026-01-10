import { Setting, Notice } from "obsidian";
import MyPlugin from "../../main";
import { db } from "../../db/db";
import { DEFAULT_SETTINGS } from "../settings";

export class CacheSection {
    constructor(
        private plugin: MyPlugin,
        private refreshUI: () => void,
    ) {}

    async render(containerEl: HTMLElement) {
        new Setting(containerEl).setHeading().setName("Attachment Cache");
        const cacheConfigContainer = containerEl.createDiv();

        // Enable Toggle
        new Setting(cacheConfigContainer)
            .setName("Enable Caching")
            .setDesc(
                "Save PDF attachments locally to improve speed and work offline.",
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.useCache)
                    .onChange(async (value) => {
                        this.plugin.settings.useCache = value;
                        await this.plugin.saveSettings();
                        this.refreshUI();
                    }),
            );

        if (!this.plugin.settings.useCache) return;

        // Max Size Setting
        new Setting(cacheConfigContainer)
            .setName("Max Cache Limit (MB)")
            .setDesc("Set to 0 for unlimited.")
            .addText((text) => {
                text.setValue(
                    (
                        this.plugin.settings.maxCacheSizeMB ||
                        DEFAULT_SETTINGS.maxCacheSizeMB
                    ).toString(),
                ).onChange(async (value) => {
                    if (value && !/^[0-9]+$/.test(value)) {
                        new Notice("Must be a positive number");
                        return;
                    }
                    const newLimit = parseInt(value);
                    this.plugin.settings.maxCacheSizeMB = newLimit;
                    await this.plugin.saveSettings();
                    updateProgressBar(newLimit);
                });
            });

        // Cache Stats & Visualization
        let totalSizeBytes = 0;
        try {
            const allFiles = await db.files.toArray();
            totalSizeBytes = allFiles.reduce(
                (acc, file) => acc + (file.size || 0),
                0,
            );
        } catch (e) {
            console.error("Cache stats error", e);
        }

        const usageContainer = cacheConfigContainer.createDiv();
        usageContainer.style.display = "block";
        usageContainer.style.paddingTop = "0";

        // Labels
        const infoDiv = usageContainer.createDiv();
        infoDiv.style.display = "flex";
        infoDiv.style.justifyContent = "space-between";
        infoDiv.style.marginBottom = "6px";
        infoDiv.style.fontSize = "var(--font-ui-smaller)";
        infoDiv.style.color = "var(--text-muted)";
        infoDiv.createSpan({ text: "Current Usage" });
        const usageTextEl = infoDiv.createSpan({ text: "Calculating..." });

        // Bar
        const progressBg = usageContainer.createDiv();
        progressBg.style.width = "100%";
        progressBg.style.height = "10px";
        progressBg.style.backgroundColor = "var(--background-modifier-border)";
        progressBg.style.borderRadius = "5px";
        progressBg.style.overflow = "hidden";

        const progressFillEl = progressBg.createDiv();
        progressFillEl.style.height = "100%";
        progressFillEl.style.transition = "width 0.3s ease";

        // Logic to update bar
        const updateProgressBar = (limitMB: number) => {
            const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);
            let percent = 0;
            let limitText = "Unlimited";

            if (limitMB > 0) {
                percent = (totalSizeBytes / (limitMB * 1024 * 1024)) * 100;
                limitText = `${limitMB} MB`;
            }

            usageTextEl.setText(`${totalSizeMB} MB / ${limitText}`);

            const visualPercent = Math.min(percent, 100);
            progressFillEl.style.width = `${visualPercent}%`;
            progressFillEl.style.backgroundColor =
                percent > 90
                    ? "var(--text-error)"
                    : "var(--interactive-accent)";
        };

        // Initialize bar
        updateProgressBar(this.plugin.settings.maxCacheSizeMB);

        // Clear Cache Button
        // Using a similar style to SyncSection (dedicated container with top margin)
        const btnContainer = cacheConfigContainer.createDiv();
        btnContainer.style.marginTop = "1rem";

        new Setting(btnContainer).addButton((btn) =>
            btn
                .setButtonText("Purge Cache")
                .setWarning()
                .onClick(async () => {
                    try {
                        await db.files.clear();
                        new Notice("Cache purged successfully.");
                        totalSizeBytes = 0;
                        updateProgressBar(this.plugin.settings.maxCacheSizeMB);
                    } catch (error) {
                        new Notice("Failed to purge cache: " + error);
                        console.error(error);
                    }
                }),
        );
    }
}
