/**
 * Get the icon for a given attachment content type.
 * @param contentType The content type of the attachment.
 * @returns The icon name for the attachment.
 */
export function getAttachmentFileIcon(contentType?: string) {
    switch (contentType) {
        case "application/pdf":
            return "file-text";
        case "application/epub+zip":
            return "book";
        case "text/html":
            return "globe";
        default:
            return "paperclip";
    }
}

/**
 * Get the icon for a given Zotero item type.
 * @param type The type of the Zotero item.
 * @returns The icon name for the Zotero item.
 */
export function getItemTypeIcon(type: string): string {
    const map: Record<string, string> = {
        annotation: "highlighter",
        artwork: "palette",
        attachment: "paperclip",
        audioRecording: "file-audio",
        bill: "scroll-text",
        blogPost: "rss",
        book: "book",
        bookSection: "book-open",
        case: "gavel",
        computerProgram: "code",
        conferencePaper: "book-open-text",
        dataset: "database",
        dictionaryEntry: "book-a",
        document: "file",
        email: "mail",
        encyclopediaArticle: "library",
        film: "film",
        forumPost: "message-square",
        hearing: "mic",
        instantMessage: "message-circle",
        interview: "mic-2",
        journalArticle: "file-text",
        letter: "mail-open",
        magazineArticle: "newspaper",
        manuscript: "feather",
        map: "map",
        newspaperArticle: "newspaper",
        note: "sticky-note",
        patent: "lightbulb",
        podcast: "podcast",
        preprint: "file-clock",
        presentation: "presentation",
        radioBroadcast: "radio",
        report: "file-chart-column",
        standard: "ruler",
        statute: "scale",
        thesis: "graduation-cap",
        tvBroadcast: "tv",
        videoRecording: "video",
        webpage: "panel-top",
        default: "file",
    };
    return map[type] || map.default!;
}
