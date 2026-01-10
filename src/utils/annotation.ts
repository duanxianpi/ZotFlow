import { db } from "../db/db";
import { IDBZoteroItem } from "../types/db-schema";
import { ZoteroItemDataTypeMap } from "../types/zotero-item";
import { AnnotationJSON } from "../types/zotero-reader";
import { AttachmentData } from "../types/zotero-item";
import { AnnotationData } from "../types/zotero-item";
import { services } from "services/serivces";

/**
 * Get all annotations for a given item from the local database.
 *
 * @param libraryID The ID of the Zotero library (user or group ID).
 * @param itemKey The key of the parent item (e.g., journal article) to fetch annotations for.
 * @returns A promise that resolves to an array of annotation items.
 */
export async function getAnnotationJson(
    item: IDBZoteroItem<AttachmentData>,
): Promise<AnnotationJSON[]> {
    const annotations = (await db.items
        .where("parentItem")
        .equals(item.key)
        .and(
            (item) =>
                item.libraryID === item.libraryID &&
                item.itemType === "annotation",
        )
        .toArray()) as IDBZoteroItem<AnnotationData>[];

    // Get current user from settings/DB
    const apiKey = services.settings.zoteroApiKey;
    const currentUserKey = await db.keys.get(apiKey);
    const currentUser = currentUserKey
        ? {
              id: currentUserKey.userID,
              username: currentUserKey.username,
              name: currentUserKey.displayName,
          }
        : null;

    // Get Library Info
    const library = await db.libraries.get(item.libraryID);
    const isGroup = library?.type === "group";

    // Get User info (for creator/modifier)
    // lastModifiedByUser is not readily available in standard Zotero item API response
    // We will assume it's createdByUser if not present.

    // Tag Colors from Settings
    const tagColors = new Map();
    /*
    if (services.settings.tagColors && services.settings.tagColors.value) {
        services.settings.tagColors.value.forEach((tc: any) => {
             tagColors.set(tc.name, { color: tc.color, position: 0 }); // Position logic might need refinement if present in settings
        });
    }
    */
    const annotationJson: AnnotationJSON[] = [];
    for (const annotation of annotations) {
        const o: any = {};
        o.libraryID = annotation.libraryID;
        o.id = annotation.key;
        o.type = annotation.raw.data.annotationType;
        o.isExternal = false; // Default to false

        const isAuthor =
            !annotation.raw.meta.createdByUser?.id ||
            annotation.raw.meta.createdByUser?.id === currentUser?.id;
        const isReadOnly = false; // Defaulting to false

        if (annotation.raw.meta.createdByUser) {
            // Approximate author logic
            if (isGroup) {
                // Logic for group modifications
            }
        }

        if (isGroup) {
            if (item.raw.meta.createdByUser) {
                o.authorName =
                    item.raw.meta.createdByUser.name ||
                    item.raw.meta.createdByUser.username;
            }
        }

        o.readOnly = isReadOnly || o.isExternal || !isAuthor;

        if (o.type === "highlight" || o.type === "underline") {
            o.text = annotation.raw.data.annotationText;
        }

        o.comment = annotation.raw.data.annotationComment;
        o.pageLabel = annotation.raw.data.annotationPageLabel;
        o.color = annotation.raw.data.annotationColor;
        o.sortIndex = annotation.raw.data.annotationSortIndex;
        o.position = JSON.parse(annotation.raw.data.annotationPosition);

        // Add tags
        const tags = annotation.raw.data.tags || [];

        const processedTags = tags.map((t) => {
            const obj: any = {
                name: t.tag,
            };
            /*
        if (tagColors.has(t.tag)) {
            obj.color = tagColors.get(t.tag).color;
            obj.position = tagColors.get(t.tag).position;
        }
        */
            return obj;
        });

        processedTags.sort((a, b) => {
            if (!a.color && !b.color) {
                return a.name.localeCompare(b.name, { sensitivity: "accent" });
            }
            if (!a.color && !b.color) {
                return -1;
            }
            if (!a.color && b.color) {
                return 1;
            }
            return a.position - b.position;
        });

        processedTags.forEach((t) => delete t.position);
        o.tags = processedTags;

        o.dateModified = annotation.dateModified;
        annotationJson.push(o);
    }
    return annotationJson;
}

/**
 * @param {Object} json reader compatible annotation data
 * @return {Object} Annotation item
 */
export const annotationItemFromJSON = function (
    json: AnnotationJSON,
): Partial<ZoteroItemDataTypeMap["annotation"]> {
    const item: any = {
        itemType: "annotation",
    };

    item.key = json.id;
    item.annotationType = json.type;
    item.annotationAuthorName = json.authorName || "";
    if (json.type === "highlight" || json.type === "underline") {
        item.annotationText = json.text;
    }
    item.annotationIsExternal = !!json.isExternal;
    item.annotationComment = json.comment;
    item.annotationColor = json.color;
    item.annotationPageLabel = json.pageLabel;
    item.annotationSortIndex = json.sortIndex;

    item.annotationPosition = JSON.stringify(Object.assign({}, json.position));
    item.tags = (json.tags || []).map((t) => ({ tag: t.name }));

    return item;
};
