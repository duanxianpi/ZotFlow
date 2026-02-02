import type { Extension } from "@codemirror/state";
import { EditorState } from "@codemirror/state";

function isLocked(state: EditorState): boolean {
    if (state.doc.sliceString(0, 3) !== "---") return false;

    const head = state.doc.sliceString(0, 10000);

    return /^---\s*[\s\S]*?zotflow-locked:\s*true/m.test(head);
}

export function ZotFlowLockExtension(): Extension {
    return [EditorState.readOnly.compute(["doc"], (state) => isLocked(state))];
}
