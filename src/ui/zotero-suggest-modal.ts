import { App, SuggestModal, setIcon, Notice } from 'obsidian';
import { db } from '../db/db';
import { AnyIDBZoteroItem } from '../types/db-schema';
import { AttachmentSelectModal } from './attachment-select-modal';
import { getAttachmentTypeIcon, openAttachment } from 'utils/attachment';
import { ZotFlowSettings } from '../settings';

interface SearchHeader {
    isHeader: true;
    label: string;
}
type SuggestionItem = AnyIDBZoteroItem | SearchHeader;

export class ZoteroSearchModal extends SuggestModal<SuggestionItem> {

    settings: ZotFlowSettings;
    constructor(app: App, settings: ZotFlowSettings) {
        super(app);
        this.settings = settings;
        this.setPlaceholder("Search Zotero Library...");
        this.modalEl.addClass("zotflow-search-modal");
        this.limit = 20; // Limit for suggestions
    }

    // Get suggestions based on query
    async getSuggestions(query: string): Promise<SuggestionItem[]> {
        const isValidTopLevel = (type: string) => !['attachment', 'note', 'annotation'].includes(type);
        const { userID } = this.settings.zoteroUser!;

        // No input -> Show Recent Access
        if (!query) {
            // Try to get recently accessed items (using _lastAccessed index)
            const recentItems = await db.items
                .orderBy('_lastAccessed')
                .reverse() // Latest first
                .filter(item => item.libraryID === userID && !item.parentItem && isValidTopLevel(item.itemType))
                .limit(20)
                .toArray();

            // If there are recent items, insert "Recent Viewed" header
            if (recentItems.length > 0) {
                return [
                    { isHeader: true, label: "Recent Viewed" },
                    ...recentItems
                ];
            }

            // Fallback: If no recent items, show "Recently Added"
            const fallbackItems = await db.items
                .orderBy('dateModified')
                .reverse()
                .filter(item => item.libraryID === userID && !item.parentItem && isValidTopLevel(item.itemType))
                .limit(20)
                .toArray();

            if (fallbackItems.length > 0) {
                return [
                    { isHeader: true, label: "Recently Added" },
                    ...fallbackItems
                ];
            }

            return [];
        }

        // With input -> Show Best Match
        const lowerQuery = query.toLowerCase();

        // Use Dexie's Collection to filter (in memory, for multi-field fuzzy search)
        const searchResults = await db.items.filter(item => {
            if (item.libraryID !== userID || item.parentItem || !isValidTopLevel(item.itemType)) return false;

            const titleMatch = (item.title || "").toLowerCase().includes(lowerQuery);
            const creatorMatch = (item._searchCreators || []).some(c => c.toLowerCase().includes(lowerQuery));
            const tagMatch = (item._searchTags || []).some(t => t.toLowerCase().includes(lowerQuery));

            return titleMatch || creatorMatch || tagMatch;
        }).limit(50).toArray();

        // If there are search results, insert "Best Match" header
        if (searchResults.length > 0) {
            return [
                { isHeader: true, label: "Best Match" },
                ...searchResults
            ];
        }

        return [];
    }

    // Render each suggestion item
    renderSuggestion(item: SuggestionItem, el: HTMLElement) {
        // Header
        if ('isHeader' in item && item.isHeader) {
            el.addClass('zotflow-suggestion-header');
            el.setText(item.label);
            return; // Render complete, exit
        }

        // Zotero Item
        const zItem = item as AnyIDBZoteroItem;
        const query = this.inputEl.value;

        el.addClass('zotflow-search-item');

        // Icon
        const iconContainer = el.createDiv({ cls: 'zotflow-item-icon' });
        setIcon(iconContainer, getAttachmentTypeIcon(zItem.itemType));

        // Main Content Container
        const contentContainer = el.createDiv({ cls: 'zotflow-item-content' });

        // Title Row
        const titleRow = contentContainer.createDiv({ cls: 'zotflow-row-top' });
        const titleEl = titleRow.createDiv({ cls: 'zotflow-title' });
        this.renderHighlight(titleEl, zItem.title || "Untitled", query);

        // Meta + Tags Row
        const bottomRow = contentContainer.createDiv({ cls: 'zotflow-row-bottom' });

        // Author • Year
        const metaEl = bottomRow.createDiv({ cls: 'zotflow-meta' });
        const authors = this.formatCreators(zItem._searchCreators);
        const year = this.extractYear(zItem.dateModified);

        let metaText = "";
        if (authors && year !== "n.d.") metaText = `${authors} • ${year}`;
        else if (authors) metaText = authors;
        else metaText = year;

        this.renderHighlight(metaEl, metaText, query);

        // Down-Right: Tags
        if (zItem._searchTags && zItem._searchTags.length > 0) {
            const tagsEl = bottomRow.createDiv({ cls: 'zotflow-tags' });

            // Limit to 3 tags
            const visibleTags = zItem._searchTags.slice(0, 3);

            visibleTags.forEach(tagText => {
                const tagSpan = tagsEl.createSpan({ cls: 'tag' });
                this.renderHighlight(tagSpan, `#${tagText}`, query);
            });
        }
    }

    async onChooseSuggestion(item: SuggestionItem, evt: MouseEvent | KeyboardEvent) { }

    selectSuggestion(item: SuggestionItem, evt: MouseEvent | KeyboardEvent): void {
        if ('isHeader' in item) return; // Skip headers

        const zItem = item as AnyIDBZoteroItem;

        // A trick to prevent await in sync method
        this.handleSelection(zItem, evt);
    }

    // Actual logic for selection
    private async handleSelection(item: AnyIDBZoteroItem, evt: MouseEvent | KeyboardEvent) {
        const zItem = item as AnyIDBZoteroItem;

        // Update Timestamp
        db.items.update(zItem, { _lastAccessed: new Date().toISOString() }).catch(console.error);

        // Logic for Top Level Item
        // If this item is an attachment (despite being filtered out), open it directly
        if (zItem.itemType === 'attachment') {
            openAttachment(zItem.libraryID, zItem.key, this.app);
            return;
        }

        // Fetch Children (Second Level Items)
        const children = await db.items.where('parentItem').equals(zItem.key).toArray();

        // Filter out attachments (PDF, Snapshot, File...)
        const attachments = children.filter(c => c.itemType === 'attachment');

        if (attachments.length === 0) {
            new Notice(`No attachments found for item: ${item.title}`);
        }
        // If there is only one attachment, open it directly
        else if (attachments.length === 1) {
            openAttachment(attachments[0]!.libraryID, attachments[0]!.key, this.app);
            this.close();
        }
        // If there are multiple attachments, open the attachment select modal
        else {
            new AttachmentSelectModal(this.app, zItem, attachments, this).open();
        }
    }

    // --- Helpers ---

    // Format creators for display
    private formatCreators(creators: string[]): string | null {
        if (!creators || creators.length === 0) return null;
        if (creators.length === 1) return creators[0]!;
        if (creators.length === 2) return `${creators[0]} & ${creators[1]}`;
        return `${creators[0]} et al.`;
    }

    // Extract year from date string
    private extractYear(dateString: string): string {
        if (!dateString) return "n.d.";
        const match = dateString.match(/\d{4}/);
        return match ? match[0] : "n.d.";
    }

    // Render highlight for search results
    private renderHighlight(el: HTMLElement, text: string, query: string) {
        if (!query) {
            el.setText(text);
            return;
        }
        // Escape regex special characters
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');

        text.split(regex).forEach(part => {
            if (part.toLowerCase() === query.toLowerCase()) {
                el.createSpan({ cls: 'suggestion-highlight', text: part });
            } else {
                el.createSpan({ text: part });
            }
        });
    }
}