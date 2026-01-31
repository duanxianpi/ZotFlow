/**
 * 1. Parent creates Iframe and sets up Penpal listener.
 * 2. Iframe loads JS, sets up Penpal, and calls connect().
 * 3. Penpal connection established.
 * 4. Iframe calls parent.shakehand().
 * 5. Parent (in shakehand) generates token, defines OBSIDIAN_BRIDGE on iframe window.
 * 6. Parent returns (promise resolves in child).
 * 7. Iframe calls initBridge(), which calls window.OBSIDIAN_BRIDGE().
 * 8. Iframe gets ParentAPI & RegisterFn synchronously.
 * 9. Iframe inits ZoteroReaderAdapter.
 * 10. Iframe calls registerChildAPI(childAPI).
 * 11. Parent (in register) stores childAPI, sets state=ready, processes queue.
 * 12. Parent connection promise resolves. System Ready.
 */
import type {
    ChildAPI,
    ParentAPI,
    CreateReaderOptions,
    ColorScheme,
    ChildEvents,
    AnnotationJSON,
} from "types/zotero-reader";

// import {
// 	createEmbeddableMarkdownEditor,
// 	EmbeddableMarkdownEditor,
// 	MarkdownEditorProps,
// } from "../editor/markdown-editor";

import { EditorView } from "@codemirror/view";
import { Platform } from "obsidian";
import { v4 as uuidv4 } from "uuid";
import { connect, WindowMessenger } from "penpal";
import { getBlobUrls } from "bundle-assets/inline-assets";
import { services } from "services/services";

import type { ZotFlowSettings } from "settings/types";
import { getAnnotationJson } from "db/annotation";
import type { IDBZoteroItem } from "types/db-schema";
import type { AttachmentData } from "types/zotero-item";

type BridgeState =
    | "idle"
    | "connecting"
    | "bridge-ready"
    | "reader-ready"
    | "disposing"
    | "disposed";

// The bootstrap signature we temporarily install on the CHILD window.
type DirectBridgeBootstrap = () => {
    token: string;
    parent: ParentAPI;
    register: (childAPI: ChildAPI, token: string) => Promise<{ ok: boolean }>;
};

export class IframeReaderBridge {
    private iframe: HTMLIFrameElement | null = null;
    private child?: ChildAPI; // Direct reference to Child API (replaces RemoteProxy<ChildAPI>)
    private _state: BridgeState = "idle";
    private afterBridgeReadyQueue: Array<() => Promise<void>> = [];
    private afterReaderReadyQueue: Array<() => Promise<void>> = [];
    private typedListeners = new Map<
        ChildEvents["type"],
        Set<(e: ChildEvents) => void>
    >();
    private connectTimeoutMs = 8000;
    private readyPromiseResolver: (() => void) | null = null;
    private readyPromiseRejecter: ((err: Error) => void) | null = null;

    // private editorList: EmbeddableMarkdownEditor[] = [];
    private _readerOpts: CreateReaderOptions | undefined;

    private token: string | null = null;

    constructor(
        private container: HTMLElement,
        private isLocal: boolean,
        private attachmentItem?: IDBZoteroItem<AttachmentData>,
    ) {}

    /**
     * Listen to specific event types from the child iframe with type safety
     */
    onEventType<T extends ChildEvents["type"]>(
        eventType: T,
        cb: (e: Extract<ChildEvents, { type: T }>) => void,
    ) {
        if (!this.typedListeners.has(eventType)) {
            this.typedListeners.set(eventType, new Set());
        }
        const typedCb = cb as (e: ChildEvents) => void;
        this.typedListeners.get(eventType)!.add(typedCb);
        return () => {
            const listeners = this.typedListeners.get(eventType);
            if (listeners) {
                listeners.delete(typedCb);
                if (listeners.size === 0) {
                    this.typedListeners.delete(eventType);
                }
            }
        };
    }

    private makeToken() {
        try {
            return uuidv4();
        } catch {
            return `${Math.random()}-${Date.now()}`;
        }
    }

    private buildParentAPI(): ParentAPI {
        return {
            getBlobUrlMap: () => getBlobUrls(),

            isAndroidApp: () => Platform.isAndroidApp,

            handleEvent: (evt) => {
                const ls = this.typedListeners.get(evt.type);
                if (ls) ls.forEach((l) => l(evt));
            },

            getOrigin: () => {
                return window.location.origin;
            },

            getMathJaxConfig: () => {
                return (window as any).MathJax?.config || {};
            },

            getColorScheme: () => {
                return getComputedStyle(document.body)
                    .colorScheme as ColorScheme;
            },

            getStyleSheets: () => {
                return document.styleSheets;
            },

            getPluginSettings: () => {
                return services.settings;
            },

            // createAnnotationEditor: (
            // 	container: HTMLElement,
            // 	options: Partial<MarkdownEditorProps>
            // ) => {
            // 	const editor = createEmbeddableMarkdownEditor(
            // 		(window as any).app,
            // 		container as HTMLElement,
            // 		{
            // 			...options,
            // 			onBlur: (editor) => {
            // 				editor.activeCM.dispatch({
            // 					effects: EditorView.scrollIntoView(0, {
            // 						y: "start",
            // 					}),
            // 				});
            // 			},
            // 		}
            // 	);
            // 	this.editorList.push(editor);
            // 	return editor;
            // },
        };
    }

    async connect() {
        if (this._state !== "idle" && this._state !== "disposed") return;
        this._state = "connecting";

        const readyPromise = new Promise<void>((resolve, reject) => {
            this.readyPromiseResolver = resolve;
            this.readyPromiseRejecter = reject;
        });

        // Create iframe
        const doc = this.container.ownerDocument; // Get the document of the container
        this.iframe = doc.createElement("iframe");
        this.iframe.id = "zotero-reader-iframe";
        this.iframe.style.cssText = "width:100%;height:100%;border:none;";
        const src = getBlobUrls()["reader.html"]!;

        if (Platform.isAndroidApp) {
            const srcdoc = await fetch(src).then((res) => res.text());
            this.iframe.srcdoc = srcdoc;
        } else {
            this.iframe.src = src;
        }

        // Sandbox as before (same-origin required for direct access)
        this.iframe.sandbox.add("allow-scripts");
        this.iframe.sandbox.add("allow-same-origin");
        this.iframe.sandbox.add("allow-forms");

        this.iframe.onload = () => {
            // Only handle unexpected reloads when we're in a stable state
            if (
                (this._state === "reader-ready" ||
                    this._state === "bridge-ready") &&
                this._readerOpts
            ) {
                // It was loaded before, but it was loaded again somehow
                // We need to reconnect but avoid infinite loop
                console.warn(
                    "Iframe reloaded unexpectedly, triggering reconnection",
                );
                // Use setTimeout to avoid potential stack overflow
                setTimeout(() => this.reconnect(), 0);
            }
        };

        // Attach first to get a contentWindow
        this.container.replaceChildren(this.iframe);

        const messenger = new WindowMessenger({
            remoteWindow: this.iframe.contentWindow!,
            allowedOrigins: ["*"],
        });

        const conn = connect({
            messenger,
            methods: {
                shakehand: async () => {
                    if (this.iframe?.contentWindow) {
                        this.token = this.makeToken();
                        const parentAPI = this.buildParentAPI();

                        const register = async (
                            childAPI: ChildAPI,
                            t: string,
                        ) => {
                            if (t !== this.token)
                                throw new Error("Bridge token mismatch");
                            this.child = childAPI;
                            this._state = "bridge-ready";

                            // Drain after bridge ready queued calls
                            const tasks = [...this.afterBridgeReadyQueue];
                            this.afterBridgeReadyQueue.length = 0;
                            for (const t of tasks) await t();
                            if (this.readyPromiseResolver)
                                this.readyPromiseResolver();
                            return { ok: true };
                        };

                        const _bridge: DirectBridgeBootstrap = () => ({
                            token: this.token!,
                            parent: parentAPI,
                            register,
                        });
                        // Make it non-enumerable & configurable (child can delete after use)
                        Object.defineProperty(
                            this.iframe.contentWindow as any,
                            "__OBSIDIAN_BRIDGE__",
                            {
                                value: _bridge,
                                enumerable: false,
                                writable: false,
                                configurable: true,
                            },
                        );
                    }
                },
            },
        });

        // Wait for child to setup penpal connection
        const remotePromise = conn.promise;
        await Promise.race([
            remotePromise,
            new Promise<never>((_, rej) =>
                setTimeout(
                    () => rej(new Error("Child connect timeout")),
                    this.connectTimeoutMs,
                ),
            ),
        ]);

        // Wait until the child calls register() (state becomes "ready") or timeout
        await Promise.race([
            readyPromise,
            new Promise<never>((_, rej) =>
                setTimeout(
                    () => rej(new Error("Child connect timeout")),
                    this.connectTimeoutMs,
                ),
            ),
        ]);

        if (this._readerOpts) {
            // Update annotation json
            let newAnnotationJson: AnnotationJSON[] = [];

            if (!this.isLocal && this.attachmentItem) {
                newAnnotationJson = await getAnnotationJson(
                    this.attachmentItem,
                    services.settings.zoteroApiKey,
                    (item) => item.syncStatus !== "deleted",
                );
            }
            const newReaderOpts: CreateReaderOptions = {
                ...this._readerOpts,
                annotations: newAnnotationJson,
            };

            await this.initReader(newReaderOpts);
        }
    }

    private runAfterBridgeReady(fn: () => Promise<void>) {
        if (this._state === "bridge-ready" || this._state === "reader-ready")
            return fn();
        if (this._state === "connecting") {
            this.afterBridgeReadyQueue.push(fn);
            return Promise.resolve();
        }
        return Promise.reject(
            new Error(`Bridge not ready (state=${this._state})`),
        );
    }

    private runAfterReaderReady(fn: () => Promise<void>) {
        if (this._state === "reader-ready") return fn();
        if (this._state === "connecting" || this._state === "bridge-ready") {
            this.afterReaderReadyQueue.push(fn);
            return Promise.resolve();
        }
        return Promise.reject(
            new Error(`Bridge not ready (state=${this._state})`),
        );
    }

    initReader(opts: CreateReaderOptions) {
        this._readerOpts = opts;
        return this.runAfterBridgeReady(async () => {
            await this.child!.initReader(opts);
            this._state = "reader-ready";

            // Drain after reader ready queued calls
            const tasks = [...this.afterReaderReadyQueue];
            this.afterReaderReadyQueue.length = 0;
            for (const t of tasks) await t();
        });
    }

    setColorScheme(colorScheme: ColorScheme) {
        return this.runAfterBridgeReady(async () => {
            await this.child!.setColorScheme(colorScheme);
        });
    }

    addAnnotation(annotation: AnnotationJSON) {
        return this.runAfterReaderReady(async () => {
            await this.child!.addAnnotation(annotation);
        });
    }

    navigate(navigationInfo: any) {
        return this.runAfterReaderReady(async () => {
            await this.child!.navigate(navigationInfo);
        });
    }

    async dispose(clearListeners = true) {
        if (this._state === "disposed") return;
        // this.editorList.forEach((editor) => editor.onunload());
        this._state = "disposing";
        try {
            if (this.iframe?.contentWindow) {
                delete (this.iframe.contentWindow as any).__ZREADER_BRIDGE__;
            }
        } catch {}
        this.child = undefined;
        this.iframe?.remove();
        this.iframe = null;
        if (clearListeners) this.typedListeners.clear();
        this._state = "disposed";
    }

    async reconnect() {
        await this.dispose(false);
        return this.connect();
    }

    public get state(): BridgeState {
        return this._state;
    }
}
