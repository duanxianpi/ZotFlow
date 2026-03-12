# Workflow Context Declaration & Enforcement — Design Document

> **Audience:** Developers and AI agents working on ZotFlow.
> **Status:** Phase 1–3 implemented, Phase 4 partially implemented.
> **Last updated:** 2026-03-07

---

## 1. Overview

ZotFlow workflows use a **Control-Flow + Shared Context** paradigm. Edges
represent execution order, not data pipes. Nodes read/write a shared context
payload via template expressions (`{{trigger.itemKey}}`).

The **context declaration system** ensures every variable written to or read
from the shared context is explicitly declared with a TypeBox schema. This
enables:

- **Design-time validation** — detect undefined variable references before execution
- **Schema propagation** — compute available variables at each node by walking the DAG
- **Runtime enforcement** — `StrictWorkflowContext` rejects undeclared writes and type mismatches
- **Autocomplete** — suggest available context paths in template expression inputs

### Library Choice: TypeBox (`@sinclair/typebox`)

| Criterion            | TypeBox                       | Zod                          | Custom |
| -------------------- | ----------------------------- | ---------------------------- | ------ |
| JSON Schema native   | Yes (schemas ARE JSON Schema) | No (needs `.toJsonSchema()`) | Manual |
| Runtime validation   | `Value.Check()` built-in      | `.parse()` / `.safeParse()`  | Manual |
| TypeScript inference | `Static<T>`                   | `z.infer<T>`                 | Manual |
| Serializable         | Yes (plain objects)           | No (class instances)         | Yes    |
| Bundle size          | ~65KB (core + value)          | ~50KB                        | ~0KB   |
| Tree-shakeable       | Yes                           | Yes                          | N/A    |

TypeBox was chosen because schemas are standard JSON Schema objects that can be
serialized, introspected, merged, and walked — all critical for the propagation
and validation engine.

---

## 2. Architecture

```
┌─────────── Design Time (Editor) ───────────────────────────┐
│                                                             │
│  NodeType.contextOutputs  ──► propagateSchemas()            │
│  NodeType.getContextOutputs()    │                          │
│                                  ▼                          │
│                          PropagatedSchema per node           │
│                           ├─ available: TObject              │
│                           ├─ outputs:   TObject              │
│                           └─ cumulative: TObject             │
│                                  │                          │
│                      ┌───────────┼───────────┐              │
│                      ▼           ▼           ▼              │
│               validateWorkflow  autocomplete  UI indicators │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────── Runtime (Execution Engine) ─────────────────────┐
│                                                             │
│  StrictWorkflowContext                                      │
│    ├─ set(key, value)  → validates against allowedOutputs   │
│    │    ├─ resolvePathSchema() → path must exist            │
│    │    └─ Value.Check()       → type must match            │
│    ├─ get(key)         → permissive (returns undefined)     │
│    ├─ evaluate(expr)   → interpolate {{ }} + comparisons    │
│    ├─ getSchema()      → return cumulative TObject          │
│    └─ fork()           → child context for next node        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. File Structure

```
src/ui/workflow/context/
├── schema.ts          — TypeBox schema utilities (merge, extract, resolve)
├── propagation.ts     — Topological sort + schema propagation engine
├── validation.ts      — Design-time validation + variable extraction
└── strict-context.ts  — Runtime WorkflowContext implementation
```

### 3.1 `schema.ts` — Core Utilities

**Types:**

```ts
interface ContextPath {
    path: string; // "trigger.itemKey"
    type: string; // "string", "number", "object", etc.
    optional: boolean; // wrapped in Type.Optional?
    description?: string;
}
```

**Functions:**

| Function                             | Purpose                                                                       | Used By                                    |
| ------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------ |
| `extractPaths(schema, prefix?)`      | Recursively flatten a `TObject` to a list of dot-paths with type metadata     | Properties panel, autocomplete, validation |
| `resolvePathSchema(schema, dotPath)` | Drill into a schema by dot-path, return sub-schema or `undefined`             | `StrictWorkflowContext.set()`, validation  |
| `mergeSchemas(a, b)`                 | Deep-merge two `TObject` schemas (recursive on shared keys, b wins on leaves) | Propagation engine                         |
| `mergeBranchSchemas(base, branch)`   | Merge where branch-only vars become `Type.Optional`                           | Propagation join-points                    |
| `markAllOptional(schema)`            | Wrap all top-level properties in `Type.Optional`                              | Branch handling                            |
| `EMPTY_SCHEMA`                       | `Type.Object({})` convenience constant                                        | Default fallback                           |

**Implementation note — TypeBox `Kind` symbol:**

TypeBox uses a unique symbol `Kind` to tag schema types. Accessing it requires
`(schema as any)[Kind]` because TypeScript's strict mode doesn't allow symbols
as index types on `Record<string, unknown>`. The `getKind()` helper encapsulates
this cast.

### 3.2 `propagation.ts` — Schema Propagation

**`topologicalSort(nodes, edges): string[]`**

Kahn's algorithm. Returns node IDs in execution order. If the graph has cycles,
the returned array is shorter than the node count — callers compare lengths to
detect cycles.

**`propagateSchemas(nodes, edges): Map<string, PropagatedSchema>`**

Walks the graph in topological order. For each node:

1. Compute `available` = merge of all predecessor nodes' `cumulative` schemas
2. Resolve `outputs` via `resolveContextOutputs(node.type, node.data)` from the registry
3. Compute `cumulative = mergeSchemas(available, outputs)`

**Join-point semantics:** When a node has multiple incoming edges (e.g., after
a condition node's true/false branches reconverge), variables present in only
some branches become `Type.Optional()` via `mergeBranchSchemas()`.

```
                    ┌── [true]  → ActionA (writes result.x) ──┐
Trigger → Condition ┤                                         ├→ MergeNode
                    └── [false] → ActionB (writes result.y) ──┘

At MergeNode:
  available = {
    trigger: { ... },          // from Trigger (always present)
    result: {
      x: Type.Optional(...)    // only from true branch
      y: Type.Optional(...)    // only from false branch
    }
  }
```

### 3.3 `validation.ts` — Design-Time Validation

**`validateWorkflow(nodes, edges): ValidationResult[]`**

Checks performed (in order):

1. **Trigger count** — exactly one trigger node required
2. **Cycle detection** — compares `topologicalSort()` output length vs node count
3. **Per-node `validate()`** — delegates to each node type's validator
4. **Undefined variable references** — scans all string data fields for `{{ }}`
   expressions, extracts dot-paths via `extractVariableRefs()`, checks each
   against the node's `propagated.available` schema

```ts
interface ValidationResult {
    nodeId?: string; // undefined for graph-level issues
    level: "error" | "warning";
    message: string;
}
```

**`extractVariableRefs(expression): string[]`**

Regex-based extraction of variable dot-paths from template expressions.
Finds `{{ ... }}` blocks, takes the first identifier-like token.

```
"{{trigger.itemType}} == \"book\""  →  ["trigger.itemType"]
"{{a.b}} and {{c.d}}"              →  ["a.b", "c.d"]
```

**`getAvailableContextPaths(nodeId, nodes, edges): ContextPath[]`**

Returns the flattened list of available variable paths at a specific node
(for autocomplete). Filters out `type: "object"` entries to only show leaf
paths.

### 3.4 `strict-context.ts` — Runtime Context

**`StrictWorkflowContext`** implements `WorkflowContext`:

| Method                              | Behavior                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get(key)`                          | Permissive — resolves dot-path against nested store, returns `undefined` for missing paths                                                                               |
| `set(key, value)`                   | Strict — validates path exists in `allowedOutputs` schema + `Value.Check()` type match. Throws `ZotFlowError` with `CONTEXT_UNDECLARED_WRITE` or `CONTEXT_TYPE_MISMATCH` |
| `evaluate(expr)`                    | Two-pass: (1) interpolate `{{ }}` templates, (2) evaluate simple comparisons (`==`, `!=`, `>`, `<`, `>=`, `<=`). Falls back to truthiness check                          |
| `getSchema()`                       | Returns cumulative `TObject` schema                                                                                                                                      |
| `fork(nextOutputs, nextCumulative)` | Creates a child context for the next node, carrying forward the store                                                                                                    |
| `snapshot()`                        | Returns `structuredClone` of the store for debugging                                                                                                                     |

**Internal store** is a nested JS object (not a flat Map):

```
store = {
  trigger: {
    itemKey: "ABC123",
    itemType: "journalArticle",
    libraryID: 1
  }
}

get("trigger")          → { itemKey: "ABC123", ... }
get("trigger.itemKey")  → "ABC123"
get("bogus.path")       → undefined (no error)
```

---

## 4. NodeType Context Declaration API

Each node declares its context contract via fields on the `NodeType<D>` interface:

```ts
interface NodeType<D extends BaseNodeData> {
    // ... existing fields ...

    /** Static output schema — variables this node writes to context. */
    contextOutputs?: TObject;

    /** Dynamic output schema derived from node instance data. */
    getContextOutputs?(data: D): TObject;

    /** Static input requirements (design-time validation only). */
    contextInputs?: TObject;

    /** Dynamic input requirements derived from node instance data. */
    getContextInputs?(data: D): TObject;
}
```

**Resolution order:** `getContextOutputs(data)` > `contextOutputs` > `EMPTY_SCHEMA`

This is handled by `resolveContextOutputs(type, data)` and
`resolveContextInputs(type, data)` in `node-registry.tsx`.

### Examples

**Static schema (ManualTriggerNode):**

```ts
contextOutputs: Type.Object({
    trigger: Type.Object({
        itemKey: Type.String({ description: "Zotero item key" }),
        itemType: Type.String({ description: "Zotero item type" }),
        libraryID: Type.Number({ description: "Zotero library ID" }),
        collectionKey: Type.Optional(
            Type.String({ description: "Parent collection key" }),
        ),
        dateAdded: Type.String({ description: "ISO date when item was added" }),
    }),
});
```

**Dynamic schema (future "Set Variable" node):**

```ts
getContextOutputs(data) {
    // Schema derived from user-configured variable mappings
    const props: Record<string, TSchema> = {};
    for (const [key, typeName] of Object.entries(data.variables)) {
        props[key] = typeName === "number" ? Type.Number() : Type.String();
    }
    return Type.Object({ custom: Type.Object(props) });
}
```

**No outputs (ConditionNode):**

```ts
contextOutputs: Type.Object({}); // reads only, writes nothing
```

---

## 5. Integration Points

### 5.1 Zustand Store

```ts
interface WorkflowState {
    // ... existing fields ...
    validationResults: ValidationResult[];
    validationByNode: Map<string, ValidationResult[]>;
    runValidation: () => void;
}
```

`runValidation()` calls `validateWorkflow()` and populates both the flat array
and the per-node lookup map.

### 5.2 WorkflowEditor

Validation runs on a 300ms debounce after `nodes` or `edges` change:

```ts
useEffect(() => {
    const timer = setTimeout(() => runValidation(), 300);
    return () => clearTimeout(timer);
}, [nodes, edges, runValidation]);
```

### 5.3 NodePropertiesPanel

- When a node is selected: shows validation errors from `validationByNode.get(nodeId)`
- When no node is selected (global settings view): shows graph-level errors (no `nodeId`)
- Error styling: `.zotflow-wf-validation-error` (red) and `.zotflow-wf-validation-warning` (amber)

### 5.4 Error Codes

Two new codes in `ZotFlowErrorCode`:

| Code                       | Thrown by                     | When                                                |
| -------------------------- | ----------------------------- | --------------------------------------------------- |
| `CONTEXT_UNDECLARED_WRITE` | `StrictWorkflowContext.set()` | Path not in `allowedOutputs` schema                 |
| `CONTEXT_TYPE_MISMATCH`    | `StrictWorkflowContext.set()` | Value fails `Value.Check()` against declared schema |

---

## 6. Key Design Decisions

| Decision                            | Rationale                                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **TypeBox over Zod**                | Schemas are JSON Schema natively (serializable); `Value.Check()` built-in; no ser/deser layer              |
| **Nested store, not flat Map**      | Aligns with `TObject` nesting; `get("trigger")` → full object; works with LiquidJS                         |
| **Writes strict, reads permissive** | `set()` rejects undeclared vars/type mismatches; `get()` returns `undefined` (no error)                    |
| **Static + dynamic schemas**        | `contextOutputs` for fixed schemas; `getContextOutputs(data)` for user-configurable nodes                  |
| **Join-point → Optional**           | Variables from only some branches become `Type.Optional()` downstream                                      |
| **Schemas in code, not in file**    | `.zotflow` files don't store schemas — they come from the `NodeType` registry. Avoids versioning headaches |
| **`getKind()` helper**              | TypeBox `Kind` is a unique symbol; wraps the `(schema as any)[Kind]` cast in one place                     |
| **300ms debounce for validation**   | Fast enough for interactive feedback, avoids thrashing on rapid edits                                      |

---

## 7. TODO / Future Work

### Expression Evaluation (Phase 4 completion)

The current `evaluate()` in `StrictWorkflowContext` handles simple template
interpolation and basic comparisons (`==`, `!=`, `>`, `<`, `>=`, `<=`). For
more complex expressions, consider:

- **Option A (recommended):** Add `filtrex` (~5KB, sandboxed, no `eval()`).
  Two-pass: interpolate `{{ }}` first, then evaluate the resulting expression
  with filtrex.
- **Option B:** Wrap LiquidJS — transform `expr` to
  `{% if expr %}__true__{% else %}__false__{% endif %}`. Works but fragile.
- **Option C:** `new Function()` — powerful but security risk. Not recommended.

### Expression Autocomplete (Phase 3, Step 10)

Infrastructure exists (`getAvailableContextPaths()`), but the UI autocomplete
component is not yet built. Needs:

- A `useContextSuggestions(nodeId)` hook that queries propagated schemas
- Dropdown/popover that activates when cursor is inside `{{ }}` in
  `PropertyInput` / `PropertyTextarea`
- Filter suggestions by typed prefix

### Node Error Indicators on Canvas

Validation results are shown in the properties panel but not yet visualized on
the node cards themselves. Options:

- Red border on nodes with errors (via CSS class toggled by validation state)
- Error count badge on the node header
- Both require `BaseNode.tsx` to read `validationByNode` from the store

### Worker Thread Migration

Currently all context modules live in `src/ui/workflow/context/`. When the
execution engine moves to the worker thread, `schema.ts` and
`strict-context.ts` will need to be importable from worker code. Options:

- Move to `src/workflow/context/` (shared between main and worker)
- Keep current location — TypeBox has no DOM deps, so imports work cross-thread
  as long as the bundler resolves the paths

### Schema Versioning

Schemas live in code (NodeType definitions), not in `.zotflow` files. If a node
type's schema changes, old files still work because schemas come from the
registry. If user-defined variable schemas are ever needed, they would go in
`WorkflowGlobals` or a new top-level field in `WorkflowFile`.

---

## 8. Adding a New Node — Context Checklist

When creating a new node type, follow this context declaration checklist:

1. **Define `contextOutputs`** — even if empty (`Type.Object({})`). This
   explicitly documents that the node writes nothing.

2. **Use namespace nesting** — group outputs under a namespace matching the
   node's purpose:

    ```ts
    contextOutputs: Type.Object({
        fetch: Type.Object({
            title: Type.String(),
            authors: Type.Array(Type.String()),
        }),
    });
    ```

3. **Add descriptions** to schema fields for autocomplete tooltips:

    ```ts
    Type.String({ description: "Zotero item key" });
    ```

4. **Use `getContextOutputs(data)` for dynamic schemas** — when the output
   shape depends on user configuration in the node's data.

5. **Ensure `execute()` writes match declarations** — every `context.set()`
   path must exist in the declared `contextOutputs`. The runtime will throw
   `CONTEXT_UNDECLARED_WRITE` otherwise.

6. **Optional: declare `contextInputs`** — documents expected upstream
   variables. Used for design-time validation to warn if required inputs
   aren't available.

---

## 9. Testing Guide

### Schema utilities (`schema.ts`)

```ts
// mergeSchemas with overlapping namespaces
const a = Type.Object({ ns: Type.Object({ x: Type.String() }) });
const b = Type.Object({ ns: Type.Object({ y: Type.Number() }) });
const merged = mergeSchemas(a, b);
// → Type.Object({ ns: Type.Object({ x: Type.String(), y: Type.Number() }) })

// extractPaths
const paths = extractPaths(merged);
// → [
//   { path: "ns",   type: "object",  optional: false },
//   { path: "ns.x", type: "string",  optional: false },
//   { path: "ns.y", type: "number",  optional: false },
// ]

// resolvePathSchema
resolvePathSchema(merged, "ns.x"); // → TString schema
resolvePathSchema(merged, "ns.z"); // → undefined
```

### Propagation (`propagation.ts`)

Test with a simple graph: `Trigger → Action → Condition → (true/false branches)`

Verify that:

- Trigger node: `available = {}`, `outputs = { trigger: { ... } }`
- Action node: `available = { trigger: { ... } }`
- Condition node: `available = { trigger: { ... } }` (action had empty outputs)

### Runtime enforcement (`strict-context.ts`)

```ts
const ctx = createInitialContext(
    Type.Object({ trigger: Type.Object({ itemKey: Type.String() }) }),
);

ctx.set("trigger.itemKey", "ABC"); // ✓ OK
ctx.set("trigger.itemKey", 123); // ✗ CONTEXT_TYPE_MISMATCH
ctx.set("bogus.path", "x"); // ✗ CONTEXT_UNDECLARED_WRITE
ctx.get("trigger.itemKey"); // → "ABC"
ctx.get("nonexistent"); // → undefined (no error)
```
