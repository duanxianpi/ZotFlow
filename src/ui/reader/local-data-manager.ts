import { TFile } from "obsidian";
import { workerBridge } from "bridge";
import { services } from "services/services";
import { getLinkedSourceNote } from "utils/file";

import type { AnnotationJSON } from "types/zotero-reader";

/**
 * Manages all per-attachment data for local vault files opened in the reader:
 * annotations (in-memory cache + worker sync).
 */
export class LocalDataManager {
    private annotationCache: Map<string, AnnotationJSON> = new Map();
    private sourceNotePath: string | null = null;

    constructor(private localAttachmentFile: TFile) {
        // Resolve linked source note path up front
        const sourceNote = getLinkedSourceNote(services.app, {
            path: localAttachmentFile.path,
            name: localAttachmentFile.name,
            extension: localAttachmentFile.extension,
            basename: localAttachmentFile.basename,
        });
        this.sourceNotePath = sourceNote?.path ?? null;
    }

    /* ================================================================ */
    /*  Annotations                                                    */
    /* ================================================================ */

    /**
     * Load annotations from the linked source note via the worker.
     */
    async loadAnnotations(): Promise<AnnotationJSON[]> {
        const localAttachment = this.getLocalAttachmentDescriptor();
        if (!getLinkedSourceNote(services.app, localAttachment)) {
            return [];
        }

        try {
            const annotations =
                await workerBridge.localNote.parseLocalAnnotations(
                    localAttachment,
                );

            this.annotationCache.clear();
            for (const anno of annotations) {
                this.annotationCache.set(anno.id, anno);
            }

            return annotations;
        } catch (error) {
            services.logService.error(
                "Failed to load annotations",
                "LocalDataManager",
                error,
            );
            services.notificationService.notify(
                "error",
                "Could not parse annotations.",
            );
            return [];
        }
    }

    /** Get all cached annotations. */
    getAllAnnotations(): AnnotationJSON[] {
        return Array.from(this.annotationCache.values());
    }

    /** Get a single cached annotation by ID. */
    getAnnotation(id: string): AnnotationJSON | undefined {
        return this.annotationCache.get(id);
    }

    /** Save/update an annotation and sync to the worker. */
    async saveAnnotation(annotation: AnnotationJSON) {
        this.annotationCache.set(annotation.id, annotation);
        await this.syncAnnotationsToWorker();
    }

    /** Delete an annotation and sync to the worker. */
    async deleteAnnotation(annotationId: string) {
        this.annotationCache.delete(annotationId);
        await this.syncAnnotationsToWorker();
    }

    /* ================================================================ */
    /*  Private helpers                                                */
    /* ================================================================ */

    private getLocalAttachmentDescriptor() {
        return {
            path: this.localAttachmentFile.path,
            name: this.localAttachmentFile.name,
            extension: this.localAttachmentFile.extension,
            basename: this.localAttachmentFile.basename,
        };
    }

    private async syncAnnotationsToWorker() {
        const localAttachment = this.getLocalAttachmentDescriptor();
        const allAnnotations = Array.from(this.annotationCache.values());
        workerBridge.localNote
            .triggerUpdate(localAttachment, allAnnotations)
            .then(() => {
                const newSourceNote = getLinkedSourceNote(
                    services.app,
                    localAttachment,
                );
                if (!this.sourceNotePath && newSourceNote) {
                    /**
                     * If we didn't have a source note before but now do
                     * save the path and load any existing view state
                     */
                    this.sourceNotePath = newSourceNote.path;
                }
            })
            .catch((err) => {
                services.logService.error(
                    "Failed to trigger worker update",
                    "LocalDataManager",
                    err,
                );
            });
    }
}
