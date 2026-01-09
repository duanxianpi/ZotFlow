import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import MyPlugin from "./main";
import { db } from "./db/db";
import { ZoteroApiClient, ZoteroKeyResponse } from "./api/zotero-api";
import { WebDavClient } from "./api/webdav-api";

export interface ZotFlowSettings {
	zoteroApiKey: string;
	zoteroUser?: ZoteroKeyResponse;
	useWebDav: boolean;
	webDavUrl?: string;
	webDavUser?: string;
	webDavPassword?: string;
	useCache: boolean;
	maxCacheSizeMB: number;
}

export const DEFAULT_SETTINGS: ZotFlowSettings = {
	zoteroApiKey: '',
	zoteroUser: undefined,
	useWebDav: true,
	webDavUrl: '',
	webDavUser: '',
	webDavPassword: '',
	useCache: true,
	maxCacheSizeMB: 500,
}

export class ZotFlowSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.plugin.loadSettings().then(async () => {

			this.renderApiKeySetting();
			await this.renderCacheSettings();
			this.renderWebDavSettings();

		});

	}

	// ========== Cache Settings ==========
	private async renderCacheSettings() {
		const { containerEl } = this;

		containerEl.createEl('h2', { text: 'Cache Settings' });

		// Enable/Disable Cache
		new Setting(containerEl)
			.setName('Enable Cache')
			.setDesc('Enable caching of attachments to prevent repeated downloads.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useCache)
				.onChange(async (value) => {
					this.plugin.settings.useCache = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.useCache) {
			// Pre-calculate stats
			let totalSizeBytes = 0;
			try {
				const allFiles = await db.files.toArray();
				totalSizeBytes = allFiles.reduce((acc, file) => acc + (file.size || 0), 0);
			} catch (e) {
				console.error("Failed to load cache stats", e);
			}

			let usageTextEl: HTMLElement;
			let progressFillEl: HTMLElement;

			const updateProgressBar = (limitMB: number) => {
				if (!usageTextEl) return;

				const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);
				let limitText = `${limitMB} MB`;
				let percent = 0;

				if (limitMB > 0) {
					percent = (totalSizeBytes / (limitMB * 1024 * 1024)) * 100;
					limitText = `${limitMB} MB`;
				} else {
					limitText = "Unlimited";
					percent = 0;
				}

				usageTextEl.setText(`${totalSizeMB} MB / ${limitText}`);

				if (progressFillEl) {
					const visualPercent = Math.min(percent, 100);
					progressFillEl.style.width = `${visualPercent}%`;
					progressFillEl.style.backgroundColor = percent > 90 ? 'var(--text-error)' : 'var(--interactive-accent)';
				}
			};

			// Max Cache Size
			new Setting(containerEl)
				.setName('Max Cache Size (MB)')
				.setDesc('Maximum size of the cache in megabytes. Set to 0 allow unlimited cache.')
				.addText(text => text
					.setValue((this.plugin.settings.maxCacheSizeMB || DEFAULT_SETTINGS.maxCacheSizeMB).toString())
					.onChange(async (value) => {
						if (value && !/^[0-9]+$/.test(value)) {
							new Notice("Max cache size must be a positive number.");
							if (this.plugin.settings.maxCacheSizeMB) {
								text.setValue(this.plugin.settings.maxCacheSizeMB.toString());
							} else {
								text.setValue(DEFAULT_SETTINGS.maxCacheSizeMB.toString());
							}
							return;
						}
						const newLimit = parseInt(value);
						this.plugin.settings.maxCacheSizeMB = newLimit;
						await this.plugin.saveSettings();
						// Update UI dynamically
						updateProgressBar(newLimit);
					})
				);

			// Cache Usage Progress Bar UI construction
			const usageContainer = containerEl.createDiv({ cls: 'setting-item' });
			usageContainer.style.display = 'block';
			usageContainer.style.borderTop = 'none';

			const infoDiv = usageContainer.createDiv();
			infoDiv.style.display = 'flex';
			infoDiv.style.justifyContent = 'space-between';
			infoDiv.style.marginBottom = '6px';
			infoDiv.style.fontSize = '0.9em';
			infoDiv.style.color = 'var(--text-muted)';

			infoDiv.createSpan({ text: 'Cache Usage' });
			usageTextEl = infoDiv.createSpan({ text: '' }); // Initialized by updateProgressBar

			const progressBg = usageContainer.createDiv();
			progressBg.style.width = '100%';
			progressBg.style.height = '8px';
			progressBg.style.backgroundColor = 'var(--background-modifier-border)';
			progressBg.style.borderRadius = '4px';
			progressBg.style.overflow = 'hidden';

			progressFillEl = progressBg.createDiv();
			progressFillEl.style.height = '100%';
			
			// Initial update
			updateProgressBar(this.plugin.settings.maxCacheSizeMB || DEFAULT_SETTINGS.maxCacheSizeMB);
		}
	}

	// ========== WebDAV Settings ==========
	private renderWebDavSettings() {
		const { containerEl } = this;

		containerEl.createEl('h2', { text: 'WebDAV Settings' });

		// Toggle to enable/disable WebDAV
		new Setting(containerEl)
			.setName('Use WebDAV for Attachments')
			.setDesc('Enable syncing attachments via WebDAV.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useWebDav)
				.onChange(async (value) => {
					this.plugin.settings.useWebDav = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.useWebDav) {
			const isVerified = !!this.plugin.settings.webDavUrl;

			// Temporary storage for credentials before verification
			// If verified, these values are just for display (and are equal to settings)
			let tempUrl = this.plugin.settings.webDavUrl || '';
			let tempUser = this.plugin.settings.webDavUser || '';
			// For password, if verified, we might want to show it masked or placeholder
			// But since we can't retrieve it back from settings if we didn't store it in temp (well we did store it in settings)
			// Let's just use what's in settings.
			let tempPassword = this.plugin.settings.webDavPassword || '';

			new Setting(containerEl)
				.setName('WebDAV URL')
				.setDesc('The full URL to your WebDAV folder (e.g., https://webdav.service.com/zotero/)')
				.addText(text => {
					text.setPlaceholder('https://...')
						.setValue(tempUrl)
						.onChange((value) => {
							tempUrl = value.trim();
						});
					if (isVerified) text.setDisabled(true);
				});

			new Setting(containerEl)
				.setName('Username')
				.setDesc('WebDAV Username')
				.addText(text => {
					text.setPlaceholder('username')
						.setValue(tempUser)
						.onChange((value) => {
							tempUser = value.trim();
						});
					if (isVerified) text.setDisabled(true);
				});

			new Setting(containerEl)
				.setName('Password')
				.setDesc('WebDAV Password')
				.addText(text => {
					text.setPlaceholder('password')
						.setValue(tempPassword)
						.onChange((value) => {
							tempPassword = value.trim();
						});
					text.inputEl.type = "password";
					if (isVerified) text.setDisabled(true);
				});

			// Verify or Clear Button
			if (isVerified) {
				new Setting(containerEl)
					.addButton(button => button
						.setButtonText("Disconnect")
						.setWarning()
						.onClick(async () => {
							this.plugin.settings.webDavUrl = '';
							this.plugin.settings.webDavUser = '';
							this.plugin.settings.webDavPassword = '';
							await this.plugin.saveSettings();
							this.display();
							new Notice("WebDAV settings cleared.");
						}));
			} else {
				new Setting(containerEl)
					.addButton(button => button
						.setButtonText("Verify WebDAV")
						.setCta()
						.onClick(async () => {
							if (!tempUrl || !tempUser || !tempPassword) {
								new Notice("Please fill in all WebDAV fields.");
								return;
							}

							button.setButtonText("Verifying...");
							button.setDisabled(true);

							try {
								await WebDavClient.verify(tempUrl, tempUser, tempPassword);
								new Notice("WebDAV connected successfully!");

								// Only save if verified
								this.plugin.settings.webDavUrl = tempUrl;
								this.plugin.settings.webDavUser = tempUser;
								this.plugin.settings.webDavPassword = tempPassword;

								await this.plugin.saveSettings();
								this.display(); // Re-render to lock fields

							} catch (error: any) {
								console.error("WebDAV Verification Failed", error);
								new Notice(`Verification failed: ${error.message || "Unknown error"}`);
								button.setButtonText("Verify WebDAV");
								button.setDisabled(false);
							}
						}));
			}
		}
	}



	// ========== API Key Settings ==========
	private renderApiKeySetting() {

		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Zotero API Key' });

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

					if (
						keyInfo.access.user &&
						keyInfo.access.user.library &&
						keyInfo.access.user.notes &&
						keyInfo.access.user.files &&
						keyInfo.access.user.write
					) {
						this.plugin.settings.zoteroUser = keyInfo;
						new Notice("Verified as " + keyInfo.username);
					} else {
						this.plugin.settings.zoteroApiKey = '';
						this.plugin.settings.zoteroUser = undefined;
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
