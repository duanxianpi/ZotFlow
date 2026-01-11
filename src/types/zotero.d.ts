import { ZoteroItemData, ZoteroItemDataTypeMap } from "./zotero-item";

export interface ZoteroKeyAccess {
    user?: {
        library: boolean;
        files: boolean;
        notes: boolean;
        write: boolean;
    };
    groups?: {
        [groupId: string]: {
            library: boolean;
            write: boolean;
        };
    };
}

export interface ZoteroKey {
    key: string;
    userID: number;
    username: string;
    displayName: string;
    access: ZoteroKeyAccess;
}

export interface ZoteroGroup {
    id: number;
    version: number;
    name: string;
    owner: number;
    type: string;
    description: string;
    url: string;
    libraryEditing: string;
    libraryReading: string;
    fileEditing: string;
}

export interface ZoteroLibrary {
    id: number;
    type: "user" | "group";
    name: string;
}

export interface ZoteroCollection {
    key: string;
    version: number;
    library: {
        type: string;
        id: number;
        name: string;
        links: { [key: string]: { href: string; type: string } };
    };
    links: { [key: string]: { href: string; type: string } };
    meta: {
        numItems: number;
        numCollections: number;
        createdByUser?: {
            id: number;
            username: string;
            name: string;
            links: { [key: string]: { href: string; type: string } };
        };
    };
    data: {
        key: string;
        version: number;
        name: string;
        parentCollection: false | string;
        relations: { [key: string]: string | string[] };
        deleted: boolean;
    };
}

export interface ZoteroItem<T extends ZoteroItemData> {
    key: string;
    version: number;
    library: {
        type: string;
        id: number;
        name: string;
        links: { [key: string]: { href: string; type: string } };
    };
    links: { [key: string]: { href: string; type: string } };
    meta: {
        numChildren: number;
        createdByUser?: {
            id: number;
            username: string;
            name: string;
            links: { [key: string]: { href: string; type: string } };
        };
    };
    data: T;
}

export type AnyZoteroItem = {
    [K in keyof ZoteroItemDataTypeMap]: ZoteroItem<ZoteroItemDataTypeMap[K]>;
}[keyof ZoteroItemDataTypeMap];

declare module "./zotero-item" {
    interface AttachmentData {
        linkMode: "imported_file" | "linked_file" | "imported_url";
        contentType: string;
        filename: string;
        md5?: string;
    }

    interface NoteData {
        note: string;
    }

    interface AnnotationData {
        annotationIsExternal?: boolean;
        annotationAuthorName?: string;
        annotationType: string;
        annotationText: string;
        annotationComment: string;
        annotationColor: string;
        annotationPageLabel: string;
        annotationSortIndex: string;
        annotationPosition: string;
    }
}
