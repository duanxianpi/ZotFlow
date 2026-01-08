import { App, FuzzySuggestModal, FuzzyMatch, Notice } from 'obsidian';
import { db } from '../db/db';
import { AnyIndexedDBZoteroItem, IndexedDBZoteroItem } from '../types/db-schema';
import { AttachmentData, ZoteroItemData } from 'types/zotero-item';

export class ZoteroSearchModal extends FuzzySuggestModal<AnyIndexedDBZoteroItem> {
    private items: AnyIndexedDBZoteroItem[];

    constructor(app: App, items: AnyIndexedDBZoteroItem[]) {
        super(app);
        this.items = items;
        this.setPlaceholder("Search your ZotLit library...");
    }

    // 1. 提供候选项
    getItems(): AnyIndexedDBZoteroItem[] {
        return this.items;
    }

    // 2. 告诉模糊搜素引擎要搜哪些文本
    getItemText(item: AnyIndexedDBZoteroItem): string {
        const creators = item._searchCreators ? item._searchCreators.join(' ') : '';
        // 搜索 标题 + 作者 + 年份
        return `${item.title} ${creators} ${item.dateModified || ''}`;
    }

    // 3. 自定义渲染 (Title + Subtitle + Icon)
    renderSuggestion(item: FuzzyMatch<AnyIndexedDBZoteroItem>, el: HTMLElement) {
        const data = item.item;

        // Container
        el.addClass('zotlit-suggestion-item');

        // Top Line: Icon + Title
        const topDiv = el.createDiv({ cls: 'zotlit-suggestion-header' });
        const icon = this.getItemIcon(data.itemType);
        topDiv.createSpan({ cls: 'zotlit-suggestion-icon' }).setText(icon);
        topDiv.createSpan({ cls: 'zotlit-suggestion-title' }).setText(data.title!);

        // Bottom Line: Meta Info
        const bottomDiv = el.createDiv({ cls: 'zotlit-suggestion-meta' });
        const author = data._searchCreators?.[0] || 'Unknown Author';
        const year = data.dateModified ? new Date(data.dateModified).getFullYear() : '----';
        const itemData = data.raw.data as any; // Safe access to union
        const journal = itemData.publicationTitle || itemData.publisher || ''; // 尝试获取期刊或出版社

        // 显示: "LeCun, 2015 · Nature"
        const metaText = [author, year, journal].filter(Boolean).join(' · ');
        bottomDiv.setText(metaText);
    }

    // 4. 选中动作 (智能路由)
    async onChooseItem(item: AnyIndexedDBZoteroItem, evt: MouseEvent | KeyboardEvent) {
        new Notice(`Selected: ${item.title}`);

        // --- 智能路由逻辑 ---

        // A. 如果选中的本来就是附件 (Standalone Attachment)
        if (item.itemType === 'attachment') {
            this.openReader(item);
            return;
        }

        // B. 如果选中的是文献，查找其子附件
        const attachments = await db.items
            .where('parentItem').equals(item.key)
            .and(i => i.itemType === 'attachment')
            .toArray() as IndexedDBZoteroItem<AttachmentData>[];

        if (attachments.length === 0) {
            new Notice("⚠️ No attachment found for this item.");
            return;
        }

        if (attachments.length === 1) {
            // ✨ 完美情况：直接打开
            if (attachments[0]) this.openReader(attachments[0]);
        } else {
            // 🕵️ 多个附件：优先找 PDF
            const bestFit = attachments.find(a =>
                a.title!.toLowerCase().endsWith('.pdf') ||
                a.raw.data.contentType === 'application/pdf'
            );

            if (bestFit) {
                new Notice(`Found ${attachments.length} attachments. Auto-opening PDF...`);
                this.openReader(bestFit);
            } else {
                // 实在不行打开第一个
                if (attachments[0]) this.openReader(attachments[0]);
            }
        }
    }

    // 模拟打开阅读器
    openReader(attachment: IndexedDBZoteroItem<AttachmentData>) {
        console.log("📖 Opening Reader for:", attachment);
        new Notice(`📖 Opening PDF Reader:\n${attachment.title}`);
        // TODO: 在这里调用你的 workspace.getLeaf().setViewState(...)
    }

    // 辅助图标
    getItemIcon(type: string): string {
        switch (type) {
            case 'journalArticle': return '📄';
            case 'book': return '📘';
            case 'bookSection': return '📖';
            case 'report': return '📊';
            case 'webpage': return '🌍';
            case 'attachment': return '📎';
            default: return '📁';
        }
    }
}