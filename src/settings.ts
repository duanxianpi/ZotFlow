import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import MyPlugin from "./main";
import { ZoteroApiClient, ZoteroKeyResponse } from "./api/zotero-api";

export interface ZotFlowSettings {
	zoteroApiKey: string;
	zoteroUser?: ZoteroKeyResponse;
}

export const DEFAULT_SETTINGS: ZotFlowSettings = {
	zoteroApiKey: '',
	zoteroUser: undefined,
}

export class ZotFlowSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Zotero Integration' });

		// ========== API Key Settings ==========
		const user = this.plugin.settings.zoteroUser;

		// Description text
		const apiDescContainer = new DocumentFragment();

		if (user) {
			const apiDesc = apiDescContainer.createEl('div');
			apiDesc.createEl('div', { text: `User ID: ${user.userID}` });
			apiDesc.createEl('div', { text: `User Name: ${user.username}` });
			const perms = [];
			if (user.access.user.library) perms.push("Read Library");
			if (user.access.user.write) perms.push("Write Library");
			if (user.access.user.files) perms.push("Access Files");

			const permStr = perms.join(', ') || "None";
			apiDesc.createEl('div', { text: `Permissions: ${permStr}` });

		} else {
			const apiDesc = apiDescContainer.createEl('div');
			apiDesc.createSpan({ text: 'Enter your Zotero API Key. You can create one via your ' });
			apiDesc.createEl('a', { href: 'https://www.zotero.org/settings/keys/new', text: 'Zotero account settings' });
			apiDesc.createSpan({ text: '.' });
		}

		// Consolidate into one Setting
		const apiKeySetting = new Setting(containerEl)
			.setName('Zotero API Key')
			.setDesc(apiDescContainer)
			.addText(text => {
				text.setPlaceholder('Enter API Key')
					.setValue(this.plugin.settings.zoteroApiKey)
					.onChange(async (value) => {
						this.plugin.settings.zoteroApiKey = value.trim();
						this.plugin.settings.zoteroUser = undefined;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "text";
				text.inputEl.size = 32;
				if (user) {
					text.setDisabled(true);
					text.inputEl.type = "password";
				}
			});

		// Add Verify button
		apiKeySetting.addButton(button => button
			.setButtonText("Verify Key")
			.setCta()
			.setDisabled(!!user)
			.onClick(async () => {
				const apiKey = this.plugin.settings.zoteroApiKey;
				if (!apiKey || apiKey.trim() === '') {
					return;
				}

				button.setButtonText("Verifying...");
				button.setDisabled(true);

				try {
					const keyInfo = await ZoteroApiClient.verifyKey(apiKey);
					this.plugin.settings.zoteroUser = keyInfo;

					if (
						keyInfo.access.user &&
						keyInfo.access.user.library &&
						keyInfo.access.user.notes &&
						keyInfo.access.user.files &&
						keyInfo.access.user.write
					) {
						new Notice("Verified as " + keyInfo.username);
					} else {
						new Notice("Invalid API Key. Please check your permissions");
					}

					await this.plugin.saveSettings();
					this.display();
				} catch (error: any) {
					console.error(error);
					new Notice("Invalid API Key");
					button.setButtonText("Verify Key");
					button.setDisabled(false);
				}
			}));

		// Clear Icon
		apiKeySetting.addExtraButton(btn => {
			btn.extraSettingsEl.style.color = 'var(--text-error)';
			btn.setIcon("trash")
				.setTooltip("Clear Settings")
				.onClick(async () => {
					this.plugin.settings.zoteroApiKey = '';
					this.plugin.settings.zoteroUser = undefined;
					await this.plugin.saveSettings();
					this.display();
				})
		})
	}
}
