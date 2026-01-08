import { ZoteroItem } from "types/zotero";
import { AttachmentData } from "types/zotero-item";
import { Notice } from "obsidian";
import { services } from "services/serivces";
import { App } from "obsidian";
import { VIEW_TYPE_ZOTERO_READER } from "../ui/reader-view";

/**
 * Open an attachment in the default application.
 * @param item The attachment item to open.
 * @param fallback Optional fallback function to execute if the attachment type is not supported.
 */
export async function openAttachment(key: string, app: App) {

  const leaf = app.workspace.getLeaf('tab');

  await leaf.setViewState({
    type: VIEW_TYPE_ZOTERO_READER,
    active: true,
    state: {
      itemKey: key
    }
  });

  app.workspace.revealLeaf(leaf);
}

/**
 * Get the icon for a given attachment content type.
 * @param contentType The content type of the attachment.
 * @returns The icon name for the attachment.
 */
export function getAttachmentIcon(contentType: string) {
  switch (contentType) {
    case 'application/pdf':
      return 'file-text';
    case 'application/epub+zip':
      return 'book';
    case 'text/html':
      return 'globe';
    default:
      return 'paperclip';
  }
}