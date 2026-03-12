import { db } from "db/db";

import type { IParentProxy } from "bridge/types";
import type { AnyIDBZoteroItem, IDBZoteroItem } from "types/db-schema";
import type { AttachmentData } from "types/zotero-item";

/**
 * Worker-side helper service for general-purpose DB operations that
 * don't belong to a domain-specific service.
 */
export class DbHelperService {
    constructor(private parentHost: IParentProxy) {}

    /**
     * Look up any item by library + key.
     * Returns `undefined` if the item doesn't exist.
     */
    async getItem(
        libraryID: number,
        itemKey: string,
    ): Promise<AnyIDBZoteroItem | undefined> {
        return db.items.get([libraryID, itemKey]);
    }

    /**
     * Look up an attachment item by library + key.
     * Returns `undefined` if the item doesn't exist or isn't an attachment.
     */
    async getAttachmentItem(
        libraryID: number,
        itemKey: string,
    ): Promise<IDBZoteroItem<AttachmentData> | undefined> {
        const item = await db.items.get([libraryID, itemKey]);
        if (!item || item.itemType !== "attachment") return undefined;
        return item as IDBZoteroItem<AttachmentData>;
    }
}
