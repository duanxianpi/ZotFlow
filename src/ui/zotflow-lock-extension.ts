import type { Extension } from "@codemirror/state";
import { EditorState } from "@codemirror/state";

function isLocked(state: EditorState): boolean {
    const head = state.doc.sliceString(0, 1000);
    return /^---\s*[\s\S]*?zotflow-locked:\s*true/m.test(head);
}

export function ZotFlowLockExtension(): Extension {
    return [EditorState.readOnly.compute(["doc"], (state) => isLocked(state))];
}
