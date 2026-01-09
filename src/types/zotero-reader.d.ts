// import { EmbeddableMarkdownEditor, MarkdownEditorProps } from "src/editor/markdown-editor";
import { ViewUpdate } from "@codemirror/view";
import { ZotFlowSettings } from "settings";
// import { ZoteroReaderPluginSettings } from "src/main";

export type ColorScheme = "light" | "dark";

export interface CreateReaderOptions {
	data: { buf: Uint8Array, url: null } | { buf: null, url: string };
	type: string;
	platform?: string;

	password?: string;
	preview?: boolean;
	colorScheme?: ColorScheme;
	customThemes?: CustomReaderTheme[];
	lightTheme?: string;
	darkTheme?: string;

	annotations?: ZoteroAnnotation[];
	sidebarOpen?: boolean;
	sidebarWidth?: number;
	primaryViewState?: Record<string, unknown>;
	secondaryViewState?: Record<string, unknown>;
}

export type ChildEvents =
	| { type: "error"; code: string; message: string }
	| { type: "addToNote" }
	| { type: "annotationsSaved"; annotations: ZoteroAnnotation[] }
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
	// createAnnotationEditor: (
	// 	container: HTMLElement,
	// 	options: Partial<MarkdownEditorProps>
	// ) => EmbeddableMarkdownEditor;
};

export type ChildAPI = {
	// parent → child
	initReader: (opts: CreateReaderOptions) => Promise<boolean>;
	setColorScheme: (colorScheme: ColorScheme) => Promise<boolean>;
	navigate: (navigationInfo: any) => Promise<boolean>;
	destroy: () => Promise<boolean>;
};

export interface ZoteroPosition {
	pageIndex: number;
	rects: number[][];
}

export interface ZoteroAnnotation {
	type: string;
	color: string;
	sortIndex: string;
	pageLabel: string;
	position: ZoteroPosition;
	text: string;
	comment: string;
	tags: string[];
	id: string;
	dateCreated: string;
	dateModified: string;
	authorName: string;
	isAuthorNameAuthoritative: boolean;
	[key: string]: any; // Allow additional properties
}

export interface ParsedAnnotation {
	id: string;
	header?: string;
	text: string;
	comment: string;
	json: ZoteroAnnotation; // raw JSON object (parsed)
	range: { start: number; end: number };
	raw: string;
}

export interface CustomReaderTheme {
	id: string;
	label: string;
	background: string;
	foreground: string;
}
