import { Setting, ButtonComponent, setIcon, SettingGroup } from "obsidian";
import { db } from "db/db";
import { workerBridge } from "bridge";
import { services } from "services/services";

import type ZotFlow from "main";
import type { ZoteroGroup } from "types/zotero";
import type { IDBZoteroKey } from "types/db-schema";
import type { LibrarySyncMode } from "settings/types";

export class SyncSection {
    constructor(
        private plugin: ZotFlow,
        private refreshUI: () => void,
    ) {}

    async render(containerEl: HTMLElement) {
        const settingGroup = new SettingGroup(containerEl);
        settingGroup.setHeading("Synchronization");

        // Retrieve cached key info
        const keyInfo = await db.keys.get(this.plugin.settings.zoteroApiKey);

        // Description
        const apiDescContainer = new DocumentFragment();
        const descDiv = apiDescContainer.createDiv();
        if (keyInfo) {
            descDiv.createSpan({
                text: `Connected as ${keyInfo.username} (User ID: ${keyInfo.userID})`,
            });
        } else {
            descDiv.createSpan({
                text: "Enter your Zotero API Key. Create one via ",
            });
            descDiv.createEl("a", {
                href: "https://www.zotero.org/settings/keys/new",
                text: "Zotero Settings",
            });
            descDiv.createSpan({ text: "." });
        }
        // API Key Input
        settingGroup.addSetting(async (setting) => {
            setting
                .setName("API Key")
                .setDesc(apiDescContainer)
                .addText((text) => {
                    text.setPlaceholder("Enter API Key")
                        .setValue(this.plugin.settings.zoteroApiKey)
                        .onChange(async (value) => {
                            this.plugin.settings.zoteroApiKey = value.trim();
                        });

                    if (keyInfo) {
                        text.setDisabled(true);
                        text.inputEl.type = "password";
                    } else {
                        text.inputEl.type = "text";
                    }
                    text.inputEl.size = 30;
                });

            // Verify Button
            setting.addButton(
                (button) =>
                    (button
                        .setButtonText(keyInfo ? "Verified" : "Verify Key")
                        .setCta()
                        .setDisabled(!!keyInfo)
                        .onClick(() =>
                            this.handleVerifyOrRefresh(button, "verify"),
                        ).buttonEl.style.width = "100px"),
            );

            // Clear Button
            setting.addExtraButton((btn) => {
                btn.setIcon("trash")
                    .setTooltip("Disconnect & Clear Key")
                    .onClick(async () => {
                        const oldKey = this.plugin.settings.zoteroApiKey;
                        this.plugin.settings.zoteroApiKey = "";
                        this.plugin.settings.librariesConfig = {};
                        if (oldKey) await db.keys.delete(oldKey);

                        await this.plugin.saveSettings();

                        services.notificationService.notify(
                            "info",
                            "Disconnected.",
                        );
                        this.refreshUI();
                    });
                btn.extraSettingsEl.addClass("zotflow-settings-danger-btn");
            });
        });

        // Libraries Table
        if (keyInfo) {
            settingGroup.addSetting(async (setting) => {
                setting.setName("Library Synchronization");
                setting.setDesc("Manage the sync settings for each library.");
                await this.renderLibrariesTable(setting.infoEl);
            });
        }
    }

    private async renderLibrariesTable(containerEl: HTMLElement) {
        const keyInfo = await db.keys.get(this.plugin.settings.zoteroApiKey);
        if (!keyInfo) return;

        // Prepare Data
        const libraryItems = await this.prepareLibraryData(keyInfo);

        if (libraryItems.length === 0) {
            containerEl.createDiv({
                text: "No libraries found.",
                cls: "setting-item-description",
            });
            return;
        }

        // Sync Config Logic (Auto-init)
        let dirty = false;
        for (const lib of libraryItems) {
            const existingConfig = this.plugin.settings.librariesConfig[lib.id];
            if (!existingConfig) {
                this.plugin.settings.librariesConfig[lib.id] = {
                    mode: lib.defaultMode,
                };
                dirty = true;
            } else if (!lib.allowedModes.includes(existingConfig.mode)) {
                this.plugin.settings.librariesConfig[lib.id]!.mode =
                    lib.defaultMode;
                dirty = true;
            }
        }
        if (dirty) await this.plugin.saveSettings();

        const tableWrapper = containerEl.createDiv({
            cls: "zotflow-settings-lib-table-wrapper",
        });

        const table = tableWrapper.createEl("table", {
            cls: "zotflow-settings-lib-table",
        });

        const thead = table.createEl("thead");
        const hRow = thead.createEl("tr");
        ["Type", "Name", "Access", "Sync Mode"].forEach((h) => {
            hRow.createEl("th", { text: h });
        });

        const tbody = table.createEl("tbody");
        libraryItems.forEach((lib) => {
            const row = tbody.createEl("tr");

            const typeCell = row.createEl("td", {
                cls: "zotflow-settings-lib-type-cell",
            });
            setIcon(typeCell, lib.type === "user" ? "user" : "users");
            typeCell.createSpan({
                text: lib.type === "user" ? " Personal" : " Group",
            });

            const nameCell = row.createEl("td", { text: lib.name });
            nameCell.title = `ID: ${lib.id}`;

            const accessCell = row.createEl("td");
            const badgeCls = lib.canWrite
                ? "zotflow-settings-access-badge zotflow-settings-access-badge--rw"
                : "zotflow-settings-access-badge zotflow-settings-access-badge--ro";
            const badge = accessCell.createSpan({ cls: badgeCls });
            badge.setText(lib.canWrite ? "Read/Write" : "Read Only");

            const actionCell = row.createEl("td");
            const select = actionCell.createEl("select");
            select.className = "dropdown zotflow-settings-lib-select";

            const modeLabels: Record<string, string> = {
                bidirectional: "Bidirectional",
                readonly: "Read-Only",
                ignored: "Ignored",
            };

            lib.allowedModes.forEach((m) => {
                const opt = select.createEl("option");
                opt.value = m;
                opt.text = modeLabels[m]!;
            });

            select.value = this.plugin.settings.librariesConfig[lib.id]!.mode;
            select.addEventListener("change", async () => {
                this.plugin.settings.librariesConfig[lib.id]!.mode =
                    select.value as LibrarySyncMode;
                await this.plugin.saveSettings();
            });
        });

        const btnContainer = containerEl.createDiv({
            cls: "zotflow-settings-table-btn-container",
        });
        new Setting(btnContainer).addButton(
            (btn) =>
                (btn
                    .setButtonText("Refresh Libraries")
                    .onClick(() =>
                        this.handleVerifyOrRefresh(btn, "refresh"),
                    ).buttonEl.style.width = "120px"),
        );
    }

    // Prepare Library Data
    private async prepareLibraryData(keyInfo: IDBZoteroKey) {
        const libraryItems: {
            id: number;
            type: "user" | "group";
            name: string;
            canRead: boolean;
            canWrite: boolean;
            allowedModes: LibrarySyncMode[];
            defaultMode: LibrarySyncMode;
        }[] = [];

        const getModes = (
            canRead: boolean,
            canWrite: boolean,
        ): { default: LibrarySyncMode; allowed: LibrarySyncMode[] } => {
            if (!canRead) return { default: "ignored", allowed: ["ignored"] };
            const defaultMode: LibrarySyncMode = canWrite
                ? "bidirectional"
                : "readonly";
            const allowed: LibrarySyncMode[] = canWrite
                ? ["bidirectional", "readonly", "ignored"]
                : ["readonly", "ignored"];
            return { default: defaultMode, allowed };
        };

        if (keyInfo.access.user) {
            const u = keyInfo.access.user;
            const canRead = !!(u.library && u.files && u.notes);
            const canWrite = !!u.write;
            const { default: def, allowed } = getModes(canRead, canWrite);
            libraryItems.push({
                id: keyInfo.userID,
                type: "user",
                name: "My Library",
                canRead,
                canWrite,
                allowedModes: allowed,
                defaultMode: def,
            });
        }

        for (const groupId of keyInfo.joinedGroups) {
            const group = await db.groups.get(groupId);
            if (group) {
                const gAccess = keyInfo.access.groups;
                const specific = gAccess?.[groupId];
                const all = gAccess?.all;
                const canRead = specific?.library ?? all?.library ?? false;
                const canWrite = specific?.write ?? all?.write ?? false;
                const { default: def, allowed } = getModes(canRead, canWrite);
                libraryItems.push({
                    id: group.id,
                    type: "group",
                    name: group.name,
                    canRead,
                    canWrite,
                    allowedModes: allowed,
                    defaultMode: def,
                });
            }
        }
        return libraryItems;
    }

    private async handleVerifyOrRefresh(
        btn: ButtonComponent,
        mode: "verify" | "refresh",
    ) {
        const apiKey = this.plugin.settings.zoteroApiKey;
        if (!apiKey) {
            services.notificationService.notify(
                "warning",
                "Enter API Key first.",
            );
            return;
        }

        const originalText = btn.buttonEl.innerText;
        btn.setButtonText(mode === "verify" ? "Verifying..." : "Refreshing...");
        btn.setDisabled(true);

        try {
            // Use Worker Bridge
            const verifiedKeyInfo = await workerBridge.zotero.verifyKey(apiKey);

            if (!verifiedKeyInfo) throw new Error("Invalid API Key");

            // Fetch Groups via Worker
            const groups: ZoteroGroup[] = await workerBridge.zotero.getGroups(
                verifiedKeyInfo.userID,
            );

            await db.keys.put({
                joinedGroups: groups.map((g) => g.id),
                ...verifiedKeyInfo,
            });

            await db.groups.bulkPut(groups);

            // Create library records if not exist
            const libState = await db.libraries.get(verifiedKeyInfo.userID);

            if (!libState) {
                await db.libraries.add({
                    id: verifiedKeyInfo.userID,
                    type: "user",
                    name: "My Library",
                    collectionVersion: 0,
                    itemVersion: 0,
                    syncedAt: new Date().toISOString().split(".")[0] + "Z",
                });
            }

            await Promise.all(
                groups.map(async (group) => {
                    const libState = await db.libraries.get(group.id);
                    if (!libState) {
                        await db.libraries.add({
                            id: group.id,
                            type: "group",
                            name: group.name,
                            collectionVersion: 0,
                            itemVersion: 0,
                            syncedAt:
                                new Date().toISOString().split(".")[0] + "Z",
                        });
                    } else if (libState.name !== group.name) {
                        libState.name = group.name;
                        await db.libraries.put(libState);
                    }
                }),
            );

            services.notificationService.notify(
                "success",
                mode === "verify"
                    ? `Verified as ${verifiedKeyInfo.username}`
                    : "Libraries refreshed.",
            );
            await this.plugin.saveSettings();

            this.refreshUI();
        } catch (error: any) {
            services.logService.error(
                `Zotero API ${mode} failed`,
                "Settings",
                error,
            );
            services.notificationService.notify(
                "error",
                `Error: ${error.message}`,
            );
            if (mode === "verify") {
                this.plugin.settings.librariesConfig = {};
                // Even on failure, refresh to unlock inputs if needed
                this.refreshUI();
            } else {
                btn.setButtonText(originalText);
                btn.setDisabled(false);
            }
        }
    }
}
