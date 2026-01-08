import { ZoteroItem } from "types/zotero";
import { AttachmentData } from "types/zotero-item";
import { Notice } from "obsidian";

/**
 * Open an attachment in the default application.
 * @param item The attachment item to open.
 * @param fallback Optional fallback function to execute if the attachment type is not supported.
 */
export async function openAttachment(item: ZoteroItem<AttachmentData>, fallback?: () => void | Promise<void>) {
  const { contentType, title, filename } = item.data;

  switch (contentType) {
    case 'application/pdf':
      console.log('Opening PDF:', title || filename);
      return;
    case 'application/epub+zip':
      console.log('Opening EPUB:', title || filename);
      return;
    case 'text/html':
      console.log('Opening Snapshot:', title || filename);
      return;
    default:
      if (!fallback) {
        new Notice('Unsupported attachment type: ' + contentType);
        return;
      }
      else {
        await fallback();
        return;
      }
  }
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