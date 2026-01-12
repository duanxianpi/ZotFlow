import { ZoteroItemDataTypeMap } from "../types/zotero-item";
import { AnnotationJSON } from "../types/zotero-reader";

/**
 * @param {Object} json reader compatible annotation data
 * @return {Object} Annotation item
 */
export function annotationItemFromJSON(
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
}
