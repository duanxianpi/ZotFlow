/**
 * Get note path
 */
export function getNotePath({
    citationKey,
    title,
    key,
    sourceNoteFolder,
    libraryName,
}: {
    citationKey?: string;
    title?: string;
    key: string;
    sourceNoteFolder: string;
    libraryName: string;
}): string {
    const illegalRe = /[\/?<>\\:*|"]/g;
    const controlRe = /[\x00-\x1f\x80-\x9f]/g;
    const reservedRe = /^\.+$/;
    const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

    let filename = `@${citationKey || title || key}`;
    filename = filename
        .replace(illegalRe, "")
        .replace(controlRe, "")
        .replace(reservedRe, "")
        .replace(windowsReservedRe, "");

    const folder = sourceNoteFolder.replace(/\/$/, "");
    const extension = "md";

    let path = `${folder}/${libraryName}/${filename}.${extension}`;
    return path.replace(/\/+/g, "/");
}
