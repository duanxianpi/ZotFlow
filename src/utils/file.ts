import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { TFileWithoutParentAndVault } from "types/zotflow";

/**
 * Ensure folder exists
 */
export async function ensureFolderExists(app: App, folderPath: string) {
    const normalizedPath = normalizePath(folderPath);
    if (normalizedPath === "" || normalizedPath === "/") return;

    const existingFolder = app.vault.getAbstractFileByPath(normalizedPath);

    if (existingFolder) {
        if (existingFolder instanceof TFolder) return;
        throw new Error(
            `Cannot create folder: "${normalizedPath}" already exists and is not a folder.`,
        );
    }

    const parentPath = normalizedPath.substring(
        0,
        normalizedPath.lastIndexOf("/"),
    );
    if (parentPath) await ensureFolderExists(app, parentPath);

    await app.vault.createFolder(normalizedPath);
}

/**
 * General save logic (internal use)
 */
async function saveFileInternal(
    app: App,
    filePath: string,
    data: any,
    isBinary: boolean,
): Promise<TFile> {
    const normalizedPath = normalizePath(filePath);
    const folderPath = normalizedPath.substring(
        0,
        normalizedPath.lastIndexOf("/"),
    );

    // Ensure parent folder exists
    if (folderPath) await ensureFolderExists(app, folderPath);

    // Check file status
    const file = app.vault.getAbstractFileByPath(normalizedPath);

    if (file instanceof TFile) {
        // Update mode
        if (isBinary) {
            await app.vault.modifyBinary(file, data as ArrayBuffer);
        } else {
            await app.vault.modify(file, data as string);
        }
        return file;
    } else if (!file) {
        // Create mode
        if (isBinary) {
            return await app.vault.createBinary(
                normalizedPath,
                data as ArrayBuffer,
            );
        } else {
            return await app.vault.create(normalizedPath, data as string);
        }
    } else {
        throw new Error(
            `Cannot write: "${normalizedPath}" is occupied by a folder.`,
        );
    }
}

// ================= External API =================

/**
 * Save text/Markdown file (auto create or overwrite)
 * @param app Obsidian App object
 * @param filePath File path (e.g., "Notes/Hello.md")
 * @param content Text content
 */
export async function saveTextFile(
    app: App,
    filePath: string,
    content: string,
): Promise<TFile> {
    return saveFileInternal(app, filePath, content, false);
}

/**
 * Save binary file (image/PDF, etc.) (auto create or overwrite)
 * @param app Obsidian App object
 * @param filePath File path (e.g., "Assets/image.png")
 * @param data ArrayBuffer data
 */
export async function saveBinaryFile(
    app: App,
    filePath: string,
    data: ArrayBuffer,
): Promise<TFile> {
    return saveFileInternal(app, filePath, data, true);
}

/**
 * Check if a file exists
 */
export async function checkFile(
    app: App,
    path: string,
): Promise<{
    exists: boolean;
    path: string;
    frontmatter?: Record<string, any>;
}> {
    const file = app.vault.getAbstractFileByPath(normalizePath(path));
    if (file instanceof TFile) {
        const cache = app.metadataCache.getFileCache(file);
        return {
            exists: true,
            path: file.path,
            frontmatter: cache?.frontmatter,
        };
    }
    return { exists: false, path: path };
}

/**
 * Read text file
 */
export async function readTextFile(
    app: App,
    path: string,
): Promise<string | null> {
    const file = app.vault.getAbstractFileByPath(normalizePath(path));
    if (file instanceof TFile) {
        return await app.vault.read(file);
    }
    return null;
}

/**
 * Delete file
 */
export async function deleteFile(app: App, path: string): Promise<void> {
    const file = app.vault.getAbstractFileByPath(path);
    if (file && file instanceof TFile) {
        await app.vault.trash(file, true);
    }
}

/**
 * Get linked source note
 */
export function getLinkedSourceNote(
    app: App,
    file: TFileWithoutParentAndVault,
): TFileWithoutParentAndVault | null {
    const pdfPath = file.path;
    const resolvedLinks = app.metadataCache.resolvedLinks;

    for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
        if (!links[pdfPath]) continue;
        const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
        if (!sourceFile || !(sourceFile instanceof TFile)) continue;

        const cache = app.metadataCache.getFileCache(sourceFile);
        const fmLink = cache?.frontmatter?.["zotflow-local-attachment"];
        if (!fmLink) continue;

        const dest = app.metadataCache.getFirstLinkpathDest(
            extractPathFromLink(fmLink),
            sourceFile.path,
        );

        if (dest && dest.path === pdfPath) {
            return {
                path: sourceFile.path,
                name: sourceFile.name,
                extension: sourceFile.extension,
                basename: sourceFile.basename,
            };
        }
    }

    return null;
}

function extractPathFromLink(text: string): string {
    if (!text) return "";

    // Remove [[ and ]]
    let path = text.replace(/\[\[|\]\]/g, "");

    path = path.split("|")[0]!;

    return path.trim();
}
