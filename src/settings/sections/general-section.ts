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

        settingGroup.addSetting((setting) => {
            setting
                .setName("Auto Import Annotation Images")
                .setDesc(
                    "Auto import annotation images for area and ink annotations from PDF when creating source notes.",
                )
                .addToggle((toggle) => {
                    toggle.setValue(
                        this.plugin.settings.autoImportAnnotationImages,
                    );
                    toggle.onChange(async (value) => {
                        this.plugin.settings.autoImportAnnotationImages = value;
                        await this.plugin.saveSettings();
                    });
                });
        });

        settingGroup.addSetting((setting) => {
            setting
                .setName("Annotation Image Folder")
                .setDesc(
                    "Default folder for annotation images (relative to vault root).",
                )
                .addText((text) => {
                    text.setPlaceholder("e.g. Attachments/ZotFlow")
                        .setValue(this.plugin.settings.annotationImageFolder)
                        .onChange(async (value) => {
                            this.plugin.settings.annotationImageFolder = value;
                            await this.plugin.saveSettings();
                        });
                    text.inputEl.size = 40;
                });
        });

        const localZoteroReaderSettingGroup = new SettingGroup(containerEl);
        localZoteroReaderSettingGroup.setHeading("Local Zotero Reader");

        localZoteroReaderSettingGroup.addSetting((setting) => {
            setting
                .setName("Overwrite PDF/EPUB/HTML Viewer")
                .setDesc(
                    "Overwrite PDF/EPUB/HTML viewer with local Zotero reader (Requires Restart).",
                )
                .addToggle((toggle) => {
                    toggle.setValue(this.plugin.settings.overwriteViewer);
                    toggle.onChange(async (value) => {
                        this.plugin.settings.overwriteViewer = value;
                        await this.plugin.saveSettings();
                    });
                });
        });

        localZoteroReaderSettingGroup.addSetting((setting) => {
            setting
                .setName("Local Source Note Template Path")
                .setDesc(
                    "Path to template file for local source notes (relative to vault root).",
                )
                .addText((text) => {
                    text.setPlaceholder(
                        "e.g. templates/LocalSourceNoteTemplate.md",
                    )
                        .setValue(
                            this.plugin.settings.localSourceNoteTemplatePath,
                        )
                        .onChange(async (value) => {
                            this.plugin.settings.localSourceNoteTemplatePath =
                                value;
                            await this.plugin.saveSettings();
                        });
                    text.inputEl.size = 40;
                });
        });

        localZoteroReaderSettingGroup.addSetting((setting) => {
            setting
                .setName("Local Source Note Folder")
                .setDesc(
                    "Default folder for local source notes (relative to vault root).",
                )
                .addText((text) => {
                    text.setPlaceholder("e.g. Source/ZotFlow/Local")
                        .setValue(this.plugin.settings.localSourceNoteFolder)
                        .onChange(async (value) => {
                            this.plugin.settings.localSourceNoteFolder = value;
                            await this.plugin.saveSettings();
                        });
                    text.inputEl.size = 40;
                });
        });
    }
}
