import { db } from "db/db";

import type { IDBZoteroItem } from "types/db-schema";
import type { AttachmentData } from "types/zotero-item";

/**
 * Worker-side service for general-purpose DB queries that don't belong
 * to a domain-specific service.
 */
export class QueryService {
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
