import { App, Editor, MarkdownView, Modal, Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, ZotFlowSettings, ZotFlowSettingTab } from "./settings";
import { SyncService } from 'services/sync-service';
import { ZoteroSearchModal } from './ui/zotero-suggest-modal';
import { services } from './services/serivces';
import { VIEW_TYPE_ZOTERO_READER, ZoteroReaderView } from './ui/reader-view';

// Remember to rename these classes and interfaces!

export default class ObsidianZotFlow extends Plugin {
	settings: ZotFlowSettings;

	async onload() {
		await this.loadSettings();

		services.initialize(this.settings);

		this.registerView(
			VIEW_TYPE_ZOTERO_READER,
			(leaf) => new ZoteroReaderView(leaf)
		);


		this.addRibbonIcon('library', 'ZotFlow: Open Library', (evt: MouseEvent) => {
			new ZoteroSearchModal(this.app, this.settings).open();
		});

		this.addRibbonIcon('sync', 'ZotFlow: Sync Library', (evt: MouseEvent) => {
			services.sync.startSync(this.settings.zoteroUser!.userID);
		});

		// // This creates an icon in the left ribbon.
		// this.addRibbonIcon('dice', 'Sample', (evt: MouseEvent) => {
		// 	// Called when the user clicks the icon.
		// 	new Notice('This is a notice!');
		// });

		// // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText('Status bar text');

		// // This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: 'open-modal-simple',
		// 	name: 'Open modal (simple)',
		// 	callback: () => {
		// 		new SampleModal(this.app).open();
		// 	}
		// });
		// // This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: 'replace-selected',
		// 	name: 'Replace selected content',
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		editor.replaceSelection('Sample editor command');
		// 	}
		// });
		// // This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: 'open-modal-complex',
		// 	name: 'Open modal (complex)',
		// 	checkCallback: (checking: boolean) => {
		// 		// Conditions to check
		// 		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		// 		if (markdownView) {
		// 			// If checking is true, we're simply "checking" if the command can be run.
		// 			// If checking is false, then we want to actually perform the operation.
		// 			if (!checking) {
		// 				new SampleModal(this.app).open();
		// 			}

		// 			// This command will only show up in Command Palette when the check function returns true
		// 			return true;
		// 		}
		// 		return false;
		// 	}
		// });

		this.addSettingTab(new ZotFlowSettingTab(this.app, this));

		// // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ZotFlowSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// class SampleModal extends Modal {
// 	constructor(app: App) {
// 		super(app);
// 	}

// 	onOpen() {
// 		let { contentEl } = this;
// 		contentEl.setText('Woah!');
// 	}

// 	onClose() {
// 		const { contentEl } = this;
// 		contentEl.empty();
// 	}
// }
