import { Setting, Notice, ButtonComponent, setIcon } from "obsidian";
import MyPlugin from "main";
import { db } from "db/db";
import { ZoteroGroup } from "types/zotero";
import { LibrarySyncMode } from "settings/types";
import { IDBZoteroKey } from "types/db-schema";
import { workerBridge } from "bridge";

export class SyncSection {
    constructor(
        private plugin: MyPlugin,
        private refreshUI: () => void,
    ) {}

    async render(containerEl: HTMLElement) {
        new Setting(containerEl).setHeading().setName("Zotero API Key");
        const keySettingContainer = containerEl.createDiv();

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
        const apiKeySetting = new Setting(keySettingContainer)
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
                text.inputEl.style.width = "200px";
            });

        // Verify Button
        apiKeySetting.addButton(
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
        apiKeySetting.addExtraButton((btn) => {
            btn.setIcon("trash")
                .setTooltip("Disconnect & Clear Key")
                .onClick(async () => {
                    const oldKey = this.plugin.settings.zoteroApiKey;
                    this.plugin.settings.zoteroApiKey = "";
                    this.plugin.settings.librariesConfig = {};
                    if (oldKey) await db.keys.delete(oldKey);

                    await this.plugin.saveSettings();

                    new Notice("Disconnected.");
                    this.refreshUI();
                });
            btn.extraSettingsEl.style.color = "var(--text-error)";
        });

        // Libraries Table
        if (keyInfo) {
            new Setting(containerEl)
                .setHeading()
                .setName("Library Synchronization");
            const librariesTableContainer = containerEl.createDiv();
            await this.renderLibrariesTable(librariesTableContainer);
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

        // Render Table
        const tableWrapper = containerEl.createDiv();
        tableWrapper.style.border =
            "1px solid var(--background-modifier-border)";
        tableWrapper.style.borderRadius = "6px";
        tableWrapper.style.overflow = "hidden";

        const table = tableWrapper.createEl("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";

        // Header
        const thead = table.createEl("thead");
        thead.style.backgroundColor = "var(--background-secondary)";
        const hRow = thead.createEl("tr");
        ["Type", "Name", "Access", "Sync Mode"].forEach((h) => {
            const th = hRow.createEl("th", { text: h });
            th.style.padding = "10px";
            th.style.textAlign = "left";
            th.style.fontSize = "var(--font-ui-medium)";
            th.style.fontWeight = "var(--font-semibold)";
        });

        // Body
        const tbody = table.createEl("tbody");
        libraryItems.forEach((lib) => {
            const row = tbody.createEl("tr");
            row.style.borderTop = "1px solid var(--background-modifier-border)";

            // Type
            const typeCell = row.createEl("td");
            typeCell.style.padding = "10px";
            typeCell.style.fontSize = "var(--font-ui-small)";
            setIcon(
                typeCell.createSpan(),
                lib.type === "user" ? "user" : "users",
            );
            typeCell.createSpan({
                text: lib.type === "user" ? " Personal" : " Group",
            });

            // Name
            const nameCell = row.createEl("td", { text: lib.name });
            nameCell.style.padding = "10px";
            nameCell.title = `ID: ${lib.id}`;
            nameCell.style.fontSize = "var(--font-ui-small)";

            // Access
            const accessCell = row.createEl("td");
            accessCell.style.padding = "10px";
            const badge = accessCell.createSpan({ cls: "nav-text" });
            badge.style.fontSize = "0.8rem";
            badge.style.padding = "2px 6px";
            badge.style.borderRadius = "4px";
            badge.style.fontSize = "var(--font-ui-small)";

            if (lib.canWrite) {
                badge.setText("Read/Write");
                badge.style.backgroundColor = "var(--interactive-accent)";
                badge.style.color = "var(--text-on-accent)";
            } else {
                badge.setText("Read Only");
                badge.style.backgroundColor =
                    "var(--background-modifier-border)";
            }

            // Selector
            const actionCell = row.createEl("td");
            actionCell.style.padding = "10px";
            const select = actionCell.createEl("select");
            select.className = "dropdown";
            select.style.width = "100%";

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

        // Refresh Button
        const btnContainer = containerEl.createDiv();
        btnContainer.style.marginTop = "1rem";
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
                name: "My Personal Library",
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
            new Notice("Enter API Key first.");
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
                    name: "My Personal Library",
                    collectionVersion: 0,
                    itemVersion: 0,
                });
            }

            groups.forEach(async (group) => {
                const libState = await db.libraries.get(group.id);
                if (!libState) {
                    await db.libraries.add({
                        id: group.id,
                        type: "group",
                        name: group.name,
                        collectionVersion: 0,
                        itemVersion: 0,
                    });
                } else if (libState.name !== group.name) {
                    libState.name = group.name;
                    await db.libraries.put(libState);
                }
            });

            new Notice(
                mode === "verify"
                    ? `Verified as ${verifiedKeyInfo.username}`
                    : "Libraries refreshed.",
            );
            await this.plugin.saveSettings();

            this.refreshUI();
        } catch (error: any) {
            new Notice(`Error: ${error.message}`);
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
