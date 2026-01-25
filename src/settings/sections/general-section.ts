import { Setting, SettingGroup } from "obsidian";
import ZotFlow from "main";

export class GeneralSection {
    plugin: ZotFlow;
    refreshUI: () => void;

    constructor(plugin: ZotFlow, refreshUI: () => void) {
        this.plugin = plugin;
        this.refreshUI = refreshUI;
    }

    render(containerEl: HTMLElement) {
        const settingGroup = new SettingGroup(containerEl);
        settingGroup.setHeading("Source Note");

        settingGroup.addSetting((setting) => {
            setting
                .setName("Template Path")
                .setDesc(
                    "Path to template file for source notes (relative to vault root).",
                )
                .addText((text) => {
                    text.setPlaceholder("e.g. templates/SourceNoteTemplate.md")
                        .setValue(this.plugin.settings.sourceNoteTemplatePath)
                        .onChange(async (value) => {
                            this.plugin.settings.sourceNoteTemplatePath = value;
                            await this.plugin.saveSettings();
                        });
                    text.inputEl.size = 40;
                });
        });

        settingGroup.addSetting((setting) => {
            setting
                .setName("Default Source Note Folder")
                .setDesc(
                    "Default folder for source notes (relative to vault root).",
                )
                .addText((text) => {
                    text.setPlaceholder("e.g. Source/ZotFlow")
                        .setValue(this.plugin.settings.sourceNoteFolder)
                        .onChange(async (value) => {
                            this.plugin.settings.sourceNoteFolder = value;
                            await this.plugin.saveSettings();
                        });
                    text.inputEl.size = 40;
                });
        });
    }
}
