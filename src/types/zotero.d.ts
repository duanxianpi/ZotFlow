import { ZoteroItemData, ZoteroItemDataTypeMap } from "./zotero-item";

export interface ZoteroLibrary {
    id: number;
    type: 'user' | 'group';
    name: string;
}

export interface ZoteroCollection {
    key: string;
    version: number;
    library: { type: string; id: number; name: string; links: { [key: string]: { href: string; type: string } } };
    links: { [key: string]: { href: string; type: string } };
    meta: {
        numItems: number;
        numCollections: number;
    }
    data: {
        key: string;
        version: number;
        name: string;
        parentCollection: false | string;
        relations: { [key: string]: string | string[] };
        deleted: boolean;
    }

}

export interface ZoteroItem<T extends ZoteroItemData> {
    key: string;
    version: number;
    library: { type: string; id: number; name: string; links: { [key: string]: { href: string; type: string } } };
    links: { [key: string]: { href: string; type: string } };
    meta: {
        numChildren: number;
    }
    data: T;
}

export type AnyZoteroItem = { [K in keyof ZoteroItemDataTypeMap]: ZoteroItem<ZoteroItemDataTypeMap[K]> }[keyof ZoteroItemDataTypeMap];

declare module './zotero-item' {
    interface AttachmentData {
        contentType: string;
        filename: string;
    }

    interface NoteData {
        note: string;
    }
}