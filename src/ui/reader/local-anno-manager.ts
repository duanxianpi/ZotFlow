import { TFile } from "obsidian";
import { workerBridge } from "bridge";
import { services } from "services/services";
import type { AnnotationJSON } from "types/zotero-reader";
import { getLinkedSourceNote } from "utils/file";

export class LocalAnnotationManager {
    private annotationCache: Map<string, AnnotationJSON> = new Map();

    constructor(private localAttachmentFile: TFile) {}

    /**
     * Initialize annotations
     */
    async load(): Promise<AnnotationJSON[]> {
        const localAttachment = {
            path: this.localAttachmentFile.path,
            name: this.localAttachmentFile.name,
            extension: this.localAttachmentFile.extension,
            basename: this.localAttachmentFile.basename,
        };
        if (!getLinkedSourceNote(services.app, localAttachment)) {
            return [];
        } else {
            try {
                const annotations =
                    await workerBridge.localNote.parseLocalAnnotations(
                        localAttachment,
                    );

                this.annotationCache.clear();
                annotations.forEach((anno) => {
                    this.annotationCache.set(anno.id, anno);
                });

                return annotations;
            } catch (error) {
                services.logService.error(
                    "Failed to load annotations",
                    "LocalAnnotationManager",
                    error,
                );
                services.notificationService.notify(
                    "error",
                    "Could not parse annotations.",
                );
                return [];
            }
        }
    }

    /**
     * Get all annotations
     */
    getAll(): AnnotationJSON[] {
        return Array.from(this.annotationCache.values());
    }

    get(id: string): AnnotationJSON | undefined {
        return this.annotationCache.get(id);
    }

    /**
     * Save/Update annotation
     */
    async save(annotation: AnnotationJSON) {
        this.annotationCache.set(annotation.id, annotation);

        await this.syncToWorker();
    }

    /**
     * Delete annotation
     */
    async delete(annotationId: string) {
        this.annotationCache.delete(annotationId);
        await this.syncToWorker();
    }

    /**
     * Private helper method: sync data to worker
     */
    private async syncToWorker() {
        const localAttachment = {
            path: this.localAttachmentFile.path,
            name: this.localAttachmentFile.name,
            extension: this.localAttachmentFile.extension,
            basename: this.localAttachmentFile.basename,
        };
        const allAnnotations = Array.from(this.annotationCache.values());
        workerBridge.localNote
            .triggerUpdate(localAttachment, allAnnotations)
            .catch((err) => {
                services.logService.error(
                    "Failed to trigger worker update",
                    "LocalAnnotationManager",
                    err,
                );
            });
    }
}
