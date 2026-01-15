import {
    EditorView,
    Decoration,
    DecorationSet,
    ViewPlugin,
    ViewUpdate,
} from "@codemirror/view";
import {
    StateField,
    Extension,
    RangeSetBuilder,
    EditorState,
    Text,
    RangeValue,
    RangeSet,
} from "@codemirror/state";

interface TagConfig {
    type: string;
    cssClass: string;
    tagClass: string;
    hasId: boolean;
    regexKey: string;
}

const TAG_CONFIGS: Record<string, TagConfig> = {
    META: {
        type: "META",
        regexKey: "M",
        cssClass: "cm-zotflow-block-meta",
        tagClass: "cm-zotflow-tag-meta",
        hasId: false,
    },
    NOTE: {
        type: "NOTE",
        regexKey: "NOTES",
        cssClass: "cm-zotflow-block-note",
        tagClass: "cm-zotflow-tag-note",
        hasId: true,
    },
    FULL_NOTES: {
        type: "FULL_NOTES",
        regexKey: "FN",
        cssClass: "cm-zotflow-container-note",
        tagClass: "cm-zotflow-tag-container",
        hasId: false,
    },
    ANNO: {
        type: "ANNO",
        regexKey: "ANNO",
        cssClass: "cm-zotflow-block-anno",
        tagClass: "cm-zotflow-tag-anno",
        hasId: true,
    },
    FULL_ANNO: {
        type: "FULL_ANNO",
        regexKey: "FULL_ANNO",
        cssClass: "cm-zotflow-container-anno",
        tagClass: "cm-zotflow-tag-container",
        hasId: false,
    },
};

// Queued Decoration
interface QueuedDeco {
    from: number;
    to: number;
    deco: Decoration;
    isLine: boolean;
}

interface FoundBlock {
    key: string;
    config: TagConfig;
    startPos: number;
    endPos: number;
    startStr: string;
    endStr: string;
    endMatchIndex: number;
}

function buildDecorations(doc: Text): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const queuedDecos: QueuedDeco[] = [];
    const text = doc.toString();
    const foundBlocks: FoundBlock[] = [];

    for (const key of Object.keys(TAG_CONFIGS)) {
        const config = TAG_CONFIGS[key]!;
        const idPart = config.hasId ? "_([a-zA-Z0-9_]+)" : "";
        const regexKey = config.regexKey;

        const startRegex = new RegExp(`%% ${regexKey}${idPart}_BEG %%`, "g");
        const endRegex = new RegExp(`%% ${regexKey}${idPart}_END %%`, "g");

        let startMatch;
        while ((startMatch = startRegex.exec(text))) {
            const startStr = startMatch[0];
            const startPos = startMatch.index;
            const id = config.hasId ? startMatch[1] : "SINGLETON";

            // Find End
            endRegex.lastIndex = startRegex.lastIndex;
            const endMatch = endRegex.exec(text);

            if (endMatch) {
                const endId = config!.hasId ? endMatch[1] : "SINGLETON";

                // Only if ID matches (or no ID needed) is it considered a valid closing
                if (endId === id) {
                    const endStr = endMatch[0];
                    const endPos = endMatch.index + endStr.length;

                    foundBlocks.push({
                        key,
                        config,
                        startPos,
                        endPos,
                        startStr,
                        endStr,
                        endMatchIndex: endMatch.index,
                    });

                    // Push regex index forward to find next
                    startRegex.lastIndex = endPos;
                }
            }
        }
    }

    // Process Line Decorations
    // Must merge CSS classes for the same line to avoid RangeSetBuilder errors
    const lineClassMap = new Map<number, Set<string>>(); // lineNo -> Set<ClassName>

    for (const block of foundBlocks) {
        const startLineObj = doc.lineAt(block.startPos);
        const endLineObj = doc.lineAt(block.endPos);

        for (let i = startLineObj.number; i <= endLineObj.number; i++) {
            if (!lineClassMap.has(i)) {
                lineClassMap.set(i, new Set(["cm-zotflow-line-base"]));
            }
            const classes = lineClassMap.get(i)!;

            // Add type class
            classes.add(block.config.cssClass);

            // Add start/end classes
            if (i === startLineObj.number) classes.add("cm-zotflow-line-top");
            if (i === endLineObj.number) classes.add("cm-zotflow-line-bottom");
        }
    }

    // Generate line decorations
    for (const [lineNo, classSet] of lineClassMap.entries()) {
        const line = doc.line(lineNo);
        const className = Array.from(classSet).join(" ");

        const lineDeco = Decoration.line({
            class: className,
        });

        queuedDecos.push({
            from: line.from,
            to: line.from,
            deco: lineDeco,
            isLine: true,
        });
    }

    // Process Mark Decorations
    for (const block of foundBlocks) {
        const startTagDeco = Decoration.mark({
            class: `cm-zotflow-tag-base ${block.config.tagClass}`,
            inclusive: true,
        });
        const endTagDeco = Decoration.mark({
            class: `cm-zotflow-tag-base ${block.config.tagClass}`,
            inclusive: true,
        });

        // BEG tag
        queuedDecos.push({
            from: block.startPos,
            to: block.startPos + block.startStr.length,
            deco: startTagDeco,
            isLine: false,
        });

        // END tag
        queuedDecos.push({
            from: block.endMatchIndex,
            to: block.endPos,
            deco: endTagDeco,
            isLine: false,
        });
    }

    // Strict sorting
    queuedDecos.sort((a, b) => {
        if (a.from !== b.from) return a.from - b.from;

        if (a.isLine && !b.isLine) return -1;
        if (!a.isLine && b.isLine) return 1;

        return 0;
    });

    // Add to builder
    for (const item of queuedDecos) {
        builder.add(item.from, item.to, item.deco);
    }

    return builder.finish();
}

export const zoteroBlockField = StateField.define<DecorationSet>({
    create(state) {
        return buildDecorations(state.doc);
    },
    update(decorations, tr) {
        if (tr.docChanged) return buildDecorations(tr.newDoc);
        return decorations.map(tr.changes);
    },
    provide: (field) => EditorView.decorations.from(field),
});

// ============================================================
// Logic Range - used for readonly filtering
// ============================================================

class LogicRange extends RangeValue {}
const logicRangeValue = new LogicRange();

function buildLogicRanges(doc: Text): RangeSet<LogicRange> {
    const builder = new RangeSetBuilder<LogicRange>();
    const ranges: { from: number; to: number }[] = [];
    const text = doc.toString();

    for (const key of Object.keys(TAG_CONFIGS)) {
        const config = TAG_CONFIGS[key]!;
        const idPart = config.hasId ? "_([a-zA-Z0-9_]+)" : "";
        const startRegex = new RegExp(
            `%% ${config.regexKey}${idPart}_BEG %%`,
            "g",
        );
        const endRegex = new RegExp(
            `%% ${config.regexKey}${idPart}_END %%`,
            "g",
        );

        let startMatch;
        while ((startMatch = startRegex.exec(text))) {
            const startPos = startMatch.index;
            endRegex.lastIndex = startRegex.lastIndex;
            const endMatch = endRegex.exec(text);

            if (endMatch) {
                const endPos = endMatch.index + endMatch[0].length;
                ranges.push({ from: startPos, to: endPos });
                startRegex.lastIndex = endPos;
            }
        }
    }

    // Sort ranges
    ranges.sort((a, b) => {
        if (a.from !== b.from) return a.from - b.from;
        return b.to - a.to;
    });

    for (const range of ranges) {
        builder.add(range.from, range.to, logicRangeValue);
    }

    return builder.finish();
}

export const zoteroRangeField = StateField.define<RangeSet<LogicRange>>({
    create(state) {
        return buildLogicRanges(state.doc);
    },
    update(current, tr) {
        if (tr.docChanged) return buildLogicRanges(tr.newDoc);
        return current.map(tr.changes);
    },
});

// ============================================================
// ReadOnly Filter - used for readonly filtering
// ============================================================

const readOnlyFilter = EditorState.changeFilter.of((tr) => {
    if (!tr.docChanged) return true;
    if (tr.isUserEvent("undo") || tr.isUserEvent("redo")) return true;

    const ranges = tr.startState.field(zoteroRangeField, false);
    if (!ranges) return true;

    let allow = true;

    tr.changes.iterChanges((fromChange, toChange) => {
        if (!allow) return;

        ranges.between(fromChange, toChange, (fromRange, toRange) => {
            if (!allow) return;

            // Allow full deletion (completely wrapped)
            if (fromChange <= fromRange && toChange >= toRange) return;

            // Prohibit internal modification or partial overlap
            if (fromChange < toRange && toChange > fromRange) {
                allow = false;
            }
        });
    });

    return allow;
});

// ============================================================
// Style Definition
// ============================================================

export function ZoteroBlockExtension(): Extension {
    return [
        zoteroBlockField,
        zoteroRangeField,
        readOnlyFilter,
        EditorView.baseTheme({
            // Base tag text style
            ".cm-zotflow-tag-base": {
                fontFamily: "var(--font-monospace)",
                fontSize: "0.8em",
            },
        }),
    ];
}
