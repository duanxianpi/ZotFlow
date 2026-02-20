// import { App, SuggestModal, setIcon, Notice } from "obsidian";
// import { db, getCombinations } from "db/db";
// import type { AnyIDBZoteroItem } from "types/db-schema";
// import { getItemTypeIcon } from "ui/icons";
// import { openAttachment } from "ui/viewer";
// import type { AttachmentData } from "types/zotero-item";
// import type { IDBZoteroItem } from "types/db-schema";
// import { Zotero_Item_Types } from "types/zotero-item-const";
// import type { ZotFlowSettings } from "settings/types";

// interface SearchHeader {
//     isHeader: true;
//     label: string;
// }
// type SuggestionItem = AnyIDBZoteroItem | SearchHeader;

// export class ZoteroSearchModal extends SuggestModal<SuggestionItem> {
//     private settings: ZotFlowSettings;

//     constructor(app: App, settings: ZotFlowSettings) {
//         super(app);
//         this.settings = settings;
//         this.setPlaceholder("Search Zotero Library...");
//         this.modalEl.addClass("zotflow-search-modal");
//         this.limit = 20; // Limit for suggestions
//     }

//     // Get suggestions based on query
//     async getSuggestions(query: string): Promise<SuggestionItem[]> {
//         const isValidTopLevel = (type: string) =>
//             !["note", "annotation"].includes(type);
//         const keyInfo = await db.keys.get(this.settings.zoteroapikey);

//         if (!keyInfo) {
//             new Notice("ZotFlow: Invalid Zotero API key.");
//             return [];
//         }

//         const filteredLibraryIDs = keyInfo.joinedGroups
//             .concat([keyInfo.userID])
//             .filter((id) => {
//                 const mode = this.settings.librariesConfig[id]?.mode;
//                 if (mode && mode !== "ignored") {
//                     return true;
//                 }
//                 return false;
//             });

//         // No input -> Show Recent Access
//         if (!query) {
//             // Try to get recently accessed items (using lastAccessedAt index)
//             const recentItems = await db.items
//                 .orderBy("lastAccessedAt")
//                 .reverse() // Latest first
//                 .filter(
//                     (item) =>
//                         filteredLibraryIDs.includes(item.libraryID) &&
//                         !item.parentItem &&
//                         isValidTopLevel(item.itemType) &&
//                         !item.trashed,
//                 )
//                 .limit(20)
//                 .toArray();

//             // If there are recent items, insert "Recent Viewed" header
//             if (recentItems.length > 0) {
//                 return [
//                     { isHeader: true, label: "Recent Viewed" },
//                     ...recentItems,
//                 ];
//             }

//             // Fallback: If no recent items, show "Recently Added"
//             const fallbackItems = await db.items
//                 .orderBy("dateModified")
//                 .reverse()
//                 .filter(
//                     (item) =>
//                         filteredLibraryIDs.includes(item.libraryID) &&
//                         !item.parentItem &&
//                         isValidTopLevel(item.itemType) &&
//                         !item.trashed,
//                 )
//                 .limit(20)
//                 .toArray();

//             if (fallbackItems.length > 0) {
//                 return [
//                     { isHeader: true, label: "Recently Added" },
//                     ...fallbackItems,
//                 ];
//             }

//             return [];
//         }

//         // With input -> Show Best Match
//         const lowerQuery = query.toLowerCase();
//         const validTopLevelTypeList = Zotero_Item_Types.filter((type) =>
//             isValidTopLevel(type),
//         );
//         // Use Dexie's Collection to filter (in memory, for multi-field fuzzy search)
//         const searchResults = await db.items
//             .where(["libraryID", "itemType", "trashed"])
//             .anyOf(
//                 getCombinations([
//                     filteredLibraryIDs,
//                     validTopLevelTypeList,
//                     [0],
//                 ]),
//             )
//             .filter((item) => {
//                 if (item.parentItem) return false;
//                 const titleMatch = (item.title || "")
//                     .toLowerCase()
//                     .includes(lowerQuery);
//                 const creatorMatch = (item.searchCreators || []).some((c) =>
//                     c.toLowerCase().includes(lowerQuery),
//                 );
//                 const tagMatch = (item.searchTags || []).some((t) =>
//                     t.toLowerCase().includes(lowerQuery),
//                 );

//                 return titleMatch || creatorMatch || tagMatch;
//             })
//             .limit(50)
//             .toArray();

//         // If there are search results, insert "Best Match" header
//         if (searchResults.length > 0) {
//             return [{ isHeader: true, label: "Best Match" }, ...searchResults];
//         }

//         return [];
//     }

//     // Render each suggestion item
//     renderSuggestion(item: SuggestionItem, el: HTMLElement) {
//         // Header
//         if ("isHeader" in item && item.isHeader) {
//             el.addClass("zotflow-suggestion-header");
//             el.setText(item.label);
//             return; // Render complete, exit
//         }

//         // Zotero Item
//         const zItem = item as AnyIDBZoteroItem;
//         const query = this.inputEl.value;

//         el.addClass("zotflow-search-item");

//         // Icon
//         const iconContainer = el.createDiv({ cls: "zotflow-item-icon" });
//         setIcon(iconContainer, getItemTypeIcon(zItem.itemType));

//         // Main Content Container
//         const contentContainer = el.createDiv({ cls: "zotflow-item-content" });

//         // Title Row
//         const titleRow = contentContainer.createDiv({ cls: "zotflow-row-top" });
//         const titleEl = titleRow.createDiv({ cls: "zotflow-title" });
//         this.renderHighlight(titleEl, zItem.title || "Untitled", query);

//         // Meta + Tags Row
//         const bottomRow = contentContainer.createDiv({
//             cls: "zotflow-row-bottom",
//         });

//         // Author • Year
//         const metaEl = bottomRow.createDiv({ cls: "zotflow-meta" });
//         const authors = this.formatCreators(zItem.searchCreators);
//         const year = this.extractYear((zItem.raw.data as any).date);

//         let metaText = "";
//         if (authors && year !== "n.d.") metaText = `${authors} • ${year}`;
//         else if (authors) metaText = authors;
//         else metaText = year;

//         this.renderHighlight(metaEl, metaText, query);

//         // Down-Right: Tags
//         if (zItem.searchTags && zItem.searchTags.length > 0) {
//             const tagsEl = bottomRow.createDiv({ cls: "zotflow-tags" });

//             // Limit to 3 tags
//             const visibleTags = zItem.searchTags.slice(0, 3);
//             visibleTags.forEach((tagText) => {
//                 const tagSpan = tagsEl.createSpan({ cls: "tag" });
//                 this.renderHighlight(tagSpan, `#${tagText}`, query);
//             });
//         }
//     }

//     async onChooseSuggestion(
//         item: SuggestionItem,
//         evt: MouseEvent | KeyboardEvent,
//     ) {}

//     selectSuggestion(
//         item: SuggestionItem,
//         evt: MouseEvent | KeyboardEvent,
//     ): void {
//         if ("isHeader" in item) return; // Skip headers

//         const zItem = item as AnyIDBZoteroItem;

//         // A trick to prevent await in sync method
//         this.handleSelection(zItem, evt);
//     }

//     // Actual logic for selection
//     private async handleSelection(
//         item: AnyIDBZoteroItem,
//         evt: MouseEvent | KeyboardEvent,
//     ) {
//         const zItem = item as AnyIDBZoteroItem;

//         // Update Timestamp
//         db.items
//             .update(zItem, { lastAccessedAt: new Date().toISOString() })
//             .catch(console.error);

//         // Logic for Top Level Item
//         // If this item is an attachment (despite being filtered out), open it directly
//         if (zItem.itemType === "attachment") {
//             openAttachment(zItem.libraryID, zItem.key, this.app);
//             this.close();
//             return;
//         }

//         // Fetch Children (Second Level Items)
//         const attachments = (await db.items
//             .where(["libraryID", "parentItem", "itemType", "trashed"])
//             .equals([zItem.libraryID, zItem.key, "attachment", 0])
//             .toArray()) as IDBZoteroItem<AttachmentData>[];

//         if (attachments.length === 0) {
//             new Notice(`No attachments found for item: ${item.title}`);
//         }
//         // If there is only one attachment, open it directly
//         else if (attachments.length === 1) {
//             openAttachment(
//                 attachments[0]!.libraryID,
//                 attachments[0]!.key,
//                 this.app,
//             );
//             this.close();
//         }
//     }

//     // --- Helpers ---

//     // Format creators for display
//     private formatCreators(creators: string[]): string | null {
//         if (!creators || creators.length === 0) return null;
//         if (creators.length === 1) return creators[0]!;
//         if (creators.length === 2) return `${creators[0]} & ${creators[1]}`;
//         return `${creators[0]} et al.`;
//     }

//     // Extract year from date string
//     private extractYear(dateString: string): string {
//         if (!dateString) return "n.d.";
//         const match = dateString.match(/\d{4}/);
//         return match ? match[0] : "n.d.";
//     }

//     // Render highlight for search results
//     private renderHighlight(el: HTMLElement, text: string, query: string) {
//         if (!query) {
//             el.setText(text);
//             return;
//         }
//         // Escape regex special characters
//         const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
//         const regex = new RegExp(`(${escapedQuery})`, "gi");

//         text.split(regex).forEach((part) => {
//             if (part.toLowerCase() === query.toLowerCase()) {
//                 el.createSpan({ cls: "suggestion-highlight", text: part });
//             } else {
//                 el.createSpan({ text: part });
//             }
//         });
//     }
// }
