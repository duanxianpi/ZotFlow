// import { EmbeddableMarkdownEditor, MarkdownEditorProps } from "src/editor/markdown-editor";
import { ZotFlowSettings } from "settings/types";

export type ColorScheme = "light" | "dark";

export interface CreateReaderOptions {
    data: { buf: Uint8Array; url: null } | { buf: null; url: string };
    type: string;
    platform?: string;

    password?: string;
    preview?: boolean;
    colorScheme?: ColorScheme;
    customThemes?: CustomReaderTheme[];
    lightTheme?: string;
    darkTheme?: string;

    annotations?: AnnotationJSON[];
    authorName?: string;
    sidebarOpen?: boolean;
    sidebarWidth?: number;
    primaryViewState?: Record<string, unknown>;
    secondaryViewState?: Record<string, unknown>;
}

export type ChildEvents =
    | { type: "error"; code: string; message: string }
    | { type: "addToNote" }
    | { type: "annotationsSaved"; annotations: AnnotationJSON[] }
    | { type: "annotationsDeleted"; ids: string[] }
    | { type: "viewStateChanged"; state: unknown; primary: boolean }
    | {
          type: "openTagsPopup";
          annotationID: unknown;
          left: number;
          top: number;
      }
    | { type: "closePopup"; data: unknown }
    | { type: "openLink"; url: string }
    | { type: "sidebarToggled"; open: boolean }
    | { type: "sidebarWidthChanged"; width: number }
    | {
          type: "setDataTransferAnnotations";
          dataTransfer: unknown;
          annotations: unknown;
          fromText: unknown;
      }
    | {
          type: "confirm";
          title: string;
          text: string;
          confirmationButtonTitle: string;
      }
    | { type: "rotatePages"; pageIndexes: unknown; degrees: unknown }
    | { type: "deletePages"; pageIndexes: unknown; degrees: unknown }
    | { type: "toggleContextPane" }
    | { type: "textSelectionAnnotationModeChanged"; mode: unknown }
    | { type: "saveCustomThemes"; customThemes: unknown }
    | { type: "setLightTheme"; theme: unknown }
    | { type: "setDarkTheme"; theme: unknown };

export type ParentAPI = {
    // child → parent
    getBlobUrlMap: () => Record<string, string>;
    handleEvent: (evt: ChildEvents) => void;
    isAndroidApp: () => boolean;
    getOrigin: () => string;
    getMathJaxConfig: () => any;
    getStyleSheets: () => StyleSheetList;
    getColorScheme: () => ColorScheme;
    getPluginSettings: () => ZotFlowSettings;
    handleSetDataTransferAnnotations: (
        dataTransfer: DataTransfer,
        annotations: AnnotationJSON[],
        fromText: boolean,
    ) => void;
    // createAnnotationEditor: (
    // 	container: HTMLElement,
    // 	options: Partial<MarkdownEditorProps>
    // ) => EmbeddableMarkdownEditor;
};

export type ChildAPI = {
    // parent → child
    initReader: (opts: CreateReaderOptions) => Promise<boolean>;
    setColorScheme: (colorScheme: ColorScheme) => Promise<boolean>;
    addAnnotation: (annotation: AnnotationJSON) => Promise<boolean>;
    navigate: (navigationInfo: any) => Promise<boolean>;
    destroy: () => Promise<boolean>;
};

export interface ZoteroPosition {
    pageIndex: number;
    rects: number[][];
}

export type AnnotationType =
    | "highlight"
    | "underline"
    | "note"
    | "image"
    | "text"
    | "ink"
    | "eraser";

export interface AnnotationJSON {
    libraryID?: number;
    id: string;
    type: AnnotationType;
    image?: Uint8Array;
    isExternal?: boolean;
    authorName?: string;
    isAuthorNameAuthoritative?: boolean;
    lastModifiedByUser?: string | number;
    readOnly?: boolean;
    text?: string | null;
    comment?: string;
    pageLabel?: string;
    color?: string;
    sortIndex?: string;
    position: ZoteroPosition;
    tags: Array<{
        name: string;
        color?: string;
        position?: number;
    }>;
    dateModified: string;
    dateCreated: string;
}

export interface CustomReaderTheme {
    id: string;
    label: string;
    background: string;
    foreground: string;
}
