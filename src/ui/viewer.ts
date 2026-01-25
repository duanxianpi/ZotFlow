import { App } from "obsidian";
import { ZOTERO_READER_VIEW_TYPE, ZoteroReaderView } from "./reader/view";

/**
 * Open an attachment in the default application.
 * @param item The attachment item to open.
 * @param fallback Optional fallback function to execute if the attachment type is not supported.
 */
export async function openAttachment(
    libraryID: number,
    key: string,
    app: App,
    navigationInfo?: any,
) {
    let activeLeaf;
    const leaves = app.workspace.getLeavesOfType(ZOTERO_READER_VIEW_TYPE);

    for (const leaf of leaves) {
        const view = leaf.view as ZoteroReaderView;
        if (
            view &&
            view.getState().libraryID === libraryID &&
            view.getState().itemKey === key
        ) {
            activeLeaf = leaf;
        }
    }

    if (activeLeaf) {
        app.workspace.setActiveLeaf(activeLeaf);
    } else {
        activeLeaf = app.workspace.getLeaf("tab");

        await activeLeaf.setViewState({
            type: ZOTERO_READER_VIEW_TYPE,
            active: true,
            state: {
                libraryID: libraryID,
                itemKey: key,
            },
        });

        app.workspace.revealLeaf(activeLeaf);
    }

    if (navigationInfo) {
        (activeLeaf.view as ZoteroReaderView).readerNavigate(
            JSON.parse(navigationInfo),
        );
    }
}
