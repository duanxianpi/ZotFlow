import { App, SuggestModal, setIcon } from 'obsidian';
import { IDBZoteroItem, AnyIDBZoteroItem } from '../types/db-schema';
import { AttachmentData } from '../types/zotero-item';
import { ZoteroSearchModal } from './zotero-suggest-modal';
import { getAttachmentFileIcon, openAttachment } from 'utils/attachment';

interface ActionOption {
    label: string;
    description: string;
    item: IDBZoteroItem<AttachmentData>;
}

export class AttachmentSelectModal extends SuggestModal<ActionOption> {
    private parentItem: AnyIDBZoteroItem;
    private attachments: IDBZoteroItem<AttachmentData>[];
    private didChoose: boolean = false;
    private parentModal: ZoteroSearchModal;

    constructor(app: App, parentItem: AnyIDBZoteroItem, attachments: IDBZoteroItem<AttachmentData>[], parentModal: ZoteroSearchModal) {
        super(app);
        this.parentItem = parentItem;
        this.attachments = attachments;
        this.parentModal = parentModal;
        this.setPlaceholder("Select file to open...");
    }

    // When modal opens, hide parent modal
    onOpen() {
        super.onOpen();
        this.parentModal.containerEl.hide();
    }

    // When modal closes, show parent modal
    onClose() {
        super.onClose();

        if (this.didChoose) {
            this.parentModal.close();
        } else {
            if (this.parentModal && this.parentModal.containerEl) {
                this.parentModal.containerEl.show();
            }
        }
    }

    // Get suggestions based on query
    getSuggestions(query: string): ActionOption[] {
        const options: ActionOption[] = [];

        this.attachments.forEach(att => {

            if (att.itemType !== 'attachment') return;

            const data = att.raw.data;

            let desc = ""
            switch (data.contentType) {
                case 'application/pdf':
                    desc = data.filename;
                    break;
                case 'application/epub+zip':
                    desc = data.filename;
                    break;
                case 'text/html':
                    desc = data.url || data.filename;
                    break;
                default:
                    desc = data.filename;
                    break;
            }

            options.push({
                label: data.title || data.filename || "Untitled Attachment",
                description: desc,
                item: att
            });
        });

        if (!query) return options;
        const lowerQ = query.toLowerCase();
        return options.filter(o => { return o.label.toLowerCase().includes(lowerQ) || o.description.toLowerCase().includes(lowerQ) });
    }

    renderSuggestion(option: ActionOption, el: HTMLElement) {
        el.addClass('zotflow-attachment-option');

        // Icon
        const iconEl = el.createDiv({ cls: 'zotflow-option-icon' });
        const iconName = getAttachmentFileIcon(option.item.raw.data.contentType);
        setIcon(iconEl, iconName);

        // Text
        const contentEl = el.createDiv({ cls: 'zotflow-option-content' });
        contentEl.createDiv({ cls: 'zotflow-option-title', text: option.label });
        if (option.description) {
            contentEl.createDiv({ cls: 'zotflow-option-desc', text: option.description });
        }
    }

    selectSuggestion(option: ActionOption, evt: MouseEvent | KeyboardEvent) {
        this.didChoose = true;

        super.selectSuggestion(option, evt);
    }

    async onChooseSuggestion(option: ActionOption, evt: MouseEvent | KeyboardEvent) {
        await openAttachment(option.item.key, this.app);
    }
}