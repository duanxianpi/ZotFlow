# ZotFlow — Workflow Editor Architecture Guide

> **Scope:** Everything under `src/ui/workflow/` and `src/services/workflow-service.ts`.
> Read this before adding nodes, modifying the execution engine, or changing
> context propagation.

---

## 1. Paradigm

ZotFlow workflows use a **Control-Flow + Shared Context** model (like Power
Automate / n8n). Edges represent **execution order**, not data pipes. Nodes
read/write a **shared context store** via template expressions
(`{{trigger.itemKey}}`).

**Key libraries:**

| Library              | Version | Role                                            |
| -------------------- | ------- | ----------------------------------------------- |
| `@xyflow/react`      | 12.10.1 | Visual graph editor (React Flow)                |
| `@sinclair/typebox`  | —       | Schema language (JSON Schema compatible)        |
| `zustand`            | 5.0.11  | State management (vanilla store per `.zotflow`) |
| `react-querybuilder` | —       | Condition builder UI                            |
| `json-logic-js`      | —       | Condition evaluation at runtime                 |

---

## 2. File Structure

```
src/ui/workflow/
├── types.ts              — Core interfaces (NodeType, WorkflowContext, etc.)
├── store.ts              — Zustand store + dirty-state tracking
├── view.tsx              — Obsidian TextFileView integration
├── WorkflowEditor.tsx    — React Flow canvas + drag-drop + validation debounce
├── node-registry.tsx     — Node registration + auto-component generation
│
├── context/
│   ├── schema.ts         — TypeBox utilities (merge, resolve, extract paths)
│   ├── propagation.ts    — Topological sort + schema propagation engine
│   ├── validation.ts     — Design-time validation (triggers, cycles, refs)
│   ├── context-query.ts  — Query available variables at a node (autocomplete)
│   ├── strict-context.ts — Runtime WorkflowContext (enforces write schemas)
│   ├── template.grammar  — Lezer grammar for {{ }} expressions
│   └── template.ts       — Generated Lezer parser
│
├── execution/
│   ├── engine.ts         — Stateless execution engine (WorkflowEngine)
│   ├── workflow-run.ts   — Run lifecycle + ITaskInfo for Activity Center
│   └── types.ts          — Execution result types, TERMINATE_HANDLE
│
├── nodes/
│   ├── BaseNode.tsx      — Rendering shell for regular nodes
│   ├── CompoundNode.tsx  — Rendering shell for compound (group) nodes
│   ├── NodePalette.tsx   — Drag-and-drop sidebar
│   ├── triggers/
│   │   └── ManualTriggerNode.tsx
│   ├── actions/
│   │   └── ExampleActionNode.tsx
│   └── controls/
│       ├── ApplyToEachNode.tsx   — Compound loop node
│       ├── ConditionNode.tsx     — True/false branching
│       ├── SetVariableNode.tsx   — Write typed values to context
│       ├── SwitchNode.tsx        — Multi-case routing
│       └── TerminateNode.tsx     — Early workflow exit
│
├── properties/
│   ├── NodePropertiesPanel.tsx   — Property editor (global + per-node)
│   ├── PropertyControls.tsx      — Reusable form controls
│   └── ContextPathPicker.tsx     — Variable path autocomplete selector
│
└── utils/
    └── interpolate.ts    — Template expression interpolation
```

---

## 3. Core Type System

### 3.1 NodeType\<D\> — Node Definition

Every node is defined by a `NodeType<D>` registered with `registerNodeType()`:

```ts
interface NodeType<D extends BaseNodeData = BaseNodeData> {
    type: string; // unique key (e.g. "manual-trigger")
    category: NodeCategory; // "trigger" | "action" | "control"
    displayName: string;
    icon: string; // Lucide icon name
    colorVar?: string; // CSS variable, e.g. "var(--color-blue-rgb)"
    description?: string;
    isCompound?: boolean; // true = contains inner sub-graph

    // --- Handle topology ---
    inputs?: HandleDef[]; // defaults from category if omitted
    outputs?: HandleDef[]; // defaults from category if omitted
    getOutputs?(data: D): HandleDef[]; // dynamic handles (overrides static)

    // --- Context declarations ---
    contextOutputs?: TObject;
    getContextOutputs?(data: D): TObject; // dynamic, takes priority
    scopedContextOutputs?: TObject; // only visible inside compound body
    getScopedContextOutputs?(data: D, available: TObject): TObject;
    contextInputs?: TObject; // validation-only
    getContextInputs?(data: D): TObject;

    // --- Instance shape ---
    defaultData: D;
    Body?: React.ComponentType<{ data: D }>;
    Properties?: React.ComponentType<NodePropertiesProps>;

    // --- Runtime ---
    execute(
        context: WorkflowContext,
        data: D,
        signal: AbortSignal,
    ): Promise<string>;
    validate?(data: D): string[];
}
```

**Category defaults** (applied when `inputs`/`outputs`/`colorVar` omitted):

| Category  | Inputs               | Outputs               | Color  |
| --------- | -------------------- | --------------------- | ------ |
| `trigger` | `[]`                 | `[{ id:"flow-out" }]` | green  |
| `action`  | `[{ id:"flow-in" }]` | `[{ id:"flow-out" }]` | blue   |
| `control` | `[{ id:"flow-in" }]` | `[]`                  | yellow |

### 3.2 BaseNodeData — Shared Node Fields

```ts
interface BaseNodeData {
    label: string; // user-visible on canvas
    description?: string;
    outputName?: string; // configurable namespace for context variables
    [key: string]: unknown; // React Flow compatibility
}
```

The `outputName` field lets users choose the namespace key for variables this
node writes (e.g. `"loop"` for Apply-to-Each, `"variables"` for Set Variable).
It appears in the Properties panel only when `defaultData.outputName` is defined.

### 3.3 WorkflowContext — Runtime Interface

```ts
interface WorkflowContext {
    get(key: string): unknown; // permissive, returns undefined for missing
    set(key: string, value: unknown): void; // strict, validates against schema
    evaluateJsonLogic(logic: unknown): unknown;
    getSchema(): TObject; // cumulative schema at this point
}
```

### 3.4 WorkflowFile — Persistence Format

```ts
interface WorkflowFile {
    version: number; // always 1
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    viewport?: { x: number; y: number; zoom: number };
    globals?: WorkflowGlobals; // name, description, isEnabled
}
```

Schemas live in code (NodeType definitions), **not** in `.zotflow` files.

---

## 4. Context Schema System

The context system uses **TypeBox** (`@sinclair/typebox`) for declaring,
propagating, and enforcing variable schemas at both design-time and runtime.

### 4.1 Schema Utilities (`schema.ts`)

| Function              | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `extractPaths()`      | Flatten a `TObject` to `ContextPath[]` (dot-paths + type info) |
| `resolvePathSchema()` | Drill into schema by dot-path, return sub-schema or undefined  |
| `mergeSchemas(a, b)`  | Deep-merge two `TObject` schemas (recursive, b wins on leaves) |
| `EMPTY_SCHEMA`        | `Type.Object({})` convenience constant                         |

### 4.2 Schema Propagation (`propagation.ts`)

Walks the graph in topological order. For each node computes a
`PropagatedSchema`:

```ts
interface PropagatedSchema {
    available: TObject; // variables readable by this node (from upstream)
    outputs: TObject; // variables this node writes
    cumulative: TObject; // available + outputs (for downstream)
}
```

**Algorithm:**

1. Topological sort (Kahn's) — also detects cycles.
2. For each node: `available` = merge of all predecessors' `cumulative`.
3. Resolve `outputs` via `resolveContextOutputs(type, data)`.
4. `cumulative = mergeSchemas(available, outputs)`.
5. For compound nodes: recursively propagate inner sub-graph with scoped
   outputs (e.g. `loop.item`, `loop.index`) merged into inner availability.

**Graph partitioning:**

| Function                  | Returns                                     |
| ------------------------- | ------------------------------------------- |
| `getTopLevelGraph()`      | Nodes/edges excluding compound children     |
| `getInnerGraph(parentId)` | Children + edges within a specific compound |

### 4.3 Design-Time Validation (`validation.ts`)

`validateWorkflow(nodes, edges)` → `ValidationResult[]`

Checks (in order):

1. **Trigger count** — exactly one trigger node required.
2. **Cycle detection** — compares topological sort length vs node count.
3. **Per-node `validate()`** — delegates to each node type's validator.
4. **Undefined variable references** — scans data fields for `{{ }}` expressions,
   extracts dot-paths via Lezer parser, checks each against the node's
   `propagated.available` schema.

### 4.4 Runtime Enforcement (`strict-context.ts`)

`StrictWorkflowContext` implements `WorkflowContext`:

| Method        | Behavior                                                                                |
| ------------- | --------------------------------------------------------------------------------------- |
| `get(key)`    | Permissive — resolves dot-path, returns `undefined` for missing paths                   |
| `set(key, v)` | **Strict** — validates path exists in `allowedOutputs` + type check via `Value.Check()` |
| `fork()`      | Creates child context for next node with new write permissions                          |
| `snapshot()`  | Deep clone of store for debugging                                                       |

**Error codes:**

| Code                       | When                               |
| -------------------------- | ---------------------------------- |
| `CONTEXT_UNDECLARED_WRITE` | `set()` path not in allowed schema |
| `CONTEXT_TYPE_MISMATCH`    | `set()` value fails type check     |

The engine **forks a context per node** so that even third-party nodes cannot
write outside their declared outputs.

### 4.5 Context Query (`context-query.ts`)

| Function                     | Purpose                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `getAvailableContextPaths()` | All available dot-paths at a node (for autocomplete)        |
| `getAvailableArrayPaths()`   | Only array-type paths (for Apply-to-Each collection picker) |

---

## 5. Execution Engine

### 5.1 Execution Flow

```
User clicks "Run" → WorkflowService.startRun()
    → WorkflowRun.start()
        → WorkflowEngine.execute(file, signal, callbacks)
```

**`WorkflowEngine.execute()` steps:**

1. **Validate** — runs `validateWorkflow()`; throws `WORKFLOW_VALIDATION_FAILED`
   on errors.
2. **Partition** — separates top-level nodes from compound children.
3. **Topological sort** — finds trigger, detects cycles.
4. **Propagate schemas** — computes context availability at every node.
5. **Execute loop** — follows edges from trigger node:
    - Yields to event loop between nodes (`setTimeout(0)`)
    - Forks `StrictWorkflowContext` per node with write permissions
    - Calls `nodeType.execute(context, data, signal)` → returns output handle ID
    - Routes to next node via matching edge
6. **Compound dispatch** — for `isCompound` nodes:
    - Merges `scopedContextOutputs` into forked context
    - Dispatches to `executeApplyToEach()` or generic `executeInnerChain()`
7. **Termination** — stops if any node returns `TERMINATE_HANDLE`

### 5.2 Compound Execution

**`executeInnerChain(parentId, ...)`** — Runs the linear chain of nodes inside a
compound container. Finds the first node with no inner predecessors and follows
edges. Returns `TERMINATE_HANDLE` or `undefined`.

**`executeApplyToEach(node, ...)`** — Iterates over the collection array,
setting `{outputName}.item` and `{outputName}.index` on each iteration, then
runs `executeInnerChain()`.

### 5.3 WorkflowRun

Wraps `WorkflowEngine.execute()` with:

- Lifecycle tracking (`pending → running → completed | failed | cancelled | terminated`)
- Abort support via `AbortController`
- `ITaskInfo` generation for the Activity Center / TaskMonitor
- Progress callbacks (`onNodeStart`, `onNodeComplete`, `onProgress`)
- Error capture (never throws — errors stored in `_status` / `_error`)

### 5.4 WorkflowService

Main-thread service that:

- Creates `WorkflowRun` instances
- Pushes state updates to `TaskMonitor` (for Activity Center UI)
- Notifies user on run failure via `NotificationService`
- Retains up to 50 historical runs (evicts old finished runs)

---

## 6. Node Registry

`node-registry.tsx` manages registration and lookup:

```ts
registerNodeType(nodeType)       // register + auto-generate React component
getNodeType(type)                // lookup resolved node type
getNodesByCategory(category)     // all nodes in a category
getRegisteredNodeTypes()         // { type: Component } map for React Flow

// Schema resolution (dynamic > static > empty)
resolveContextOutputs(type, data)
resolveScopedContextOutputs(type, data, available?)
resolveContextInputs(type, data)
resolveOutputs(type, data)       // handle topology
```

**Auto-generated components:** `registerNodeType()` creates a memoized React
component that renders `BaseNode` (regular) or `CompoundNode` (compound) with
the node type's optional `Body` component.

---

## 7. UI Layer

### 7.1 Obsidian Integration (`view.tsx`)

`ZotFlowWorkflowView` extends `TextFileView`:

- **`setViewData()`** — parses JSON into Zustand store
- **`getViewData()`** — serializes store back to JSON
- **Auto-save** — subscribes to `dirty` flag, debounced 1000ms
- **Run button** — toolbar "play" action triggers `WorkflowService.startRun()`

### 7.2 Canvas (`WorkflowEditor.tsx`)

- Wraps `<ReactFlow>` with provider and store bindings
- **Validation debounce** — runs `store.runValidation()` 300ms after node/edge changes
- **Drag-drop** — detects drop zone (inside compound or top-level), creates node
  with auto-assigned UUID, computes relative position for nested compounds
- **Single-input enforcement** — connection validator rejects duplicate inputs
  to same handle

### 7.3 Node Rendering

**`BaseNode.tsx`** — Regular node shell:

- Input handles (top), output handles (bottom)
- Header with icon + label + validation badges
- Optional Body component
- Handle labels for multi-output nodes

**`CompoundNode.tsx`** — Compound node shell:

- `NodeResizer` for user-resizable container
- Inner canvas area (children rendered by React Flow via `parentId`)
- Same validation badges as BaseNode

### 7.4 Properties Panel (`NodePropertiesPanel.tsx`)

- **No selection** → global settings (name, description, enabled toggle)
- **Node selected** → node type, label, output name (if applicable), custom
  Properties component, validation errors/warnings

### 7.5 State Management (`store.ts`)

Vanilla Zustand store per `.zotflow` file:

```ts
interface WorkflowState {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    viewport: Viewport;
    dirty: boolean;
    validationResults: ValidationResult[];
    validationByNode: Map<string, ValidationResult[]>;
    globals: WorkflowGlobals;

    // Actions
    loadWorkflow;
    onNodesChange;
    onEdgesChange;
    onConnect;
    onViewportChange;
    addNode;
    removeNode;
    updateNodeData;
    updateGlobals;
    toWorkflowFile;
    markClean;
    runValidation;
}
```

`removeNode()` cascades — deleting a compound also removes its children and
their edges. `onConnect()` enforces single-input (replaces existing incoming
edge to the same target handle).

---

## 8. Existing Nodes

### Triggers

| Type             | Outputs    | Context Outputs                                            |
| ---------------- | ---------- | ---------------------------------------------------------- |
| `manual-trigger` | `flow-out` | `trigger.itemKey`, `.itemType`, `.libraryID`, `.dateAdded` |

### Actions

| Type             | Outputs    | Context Outputs | Behavior                  |
| ---------------- | ---------- | --------------- | ------------------------- |
| `example-action` | `flow-out` | (none)          | Logs interpolated message |

### Controls

| Type            | Outputs              | Context Outputs          | Compound | Notes                                 |
| --------------- | -------------------- | ------------------------ | -------- | ------------------------------------- |
| `condition`     | `true`, `false`      | `result` (boolean)       | No       | react-querybuilder + json-logic       |
| `set-variable`  | `flow-out`           | `{outputName}.{varName}` | No       | string/number/boolean vars            |
| `switch`        | per-case + `default` | `{outputName}.matched`   | No       | Multi-case routing                    |
| `apply-to-each` | `flow-out`           | —                        | **Yes**  | Scoped: `{outputName}.item`, `.index` |
| `terminate`     | (none)               | (none)                   | No       | Returns `TERMINATE_HANDLE`            |

---

## 9. Adding a New Node — Checklist

1. **Create the file** under `src/ui/workflow/nodes/{category}/YourNode.tsx`.

2. **Export a `NodeType<D>` object** with all required fields.

3. **Declare `contextOutputs`** — even `Type.Object({})` if no outputs. Use
   namespace nesting (group under a key matching the node's purpose).

4. **Add descriptions** to schema fields for autocomplete tooltips:

    ```ts
    Type.String({ description: "Zotero item key" });
    ```

5. **Use `getContextOutputs(data)` for dynamic schemas** when the output shape
   depends on user configuration.

6. **Ensure `execute()` writes match declarations** — every `context.set()`
   path must exist in the declared outputs or `StrictWorkflowContext` will throw
   `CONTEXT_UNDECLARED_WRITE`.

7. **Implement `validate(data)`** to catch configuration errors at design time.

8. **Register** by calling `registerNodeType(yourNode)` in the plugin's
   initialization code.

9. **If compound:** set `isCompound: true` and declare `getScopedContextOutputs()`
   for variables only visible inside the body. Add a dispatch case in
   `engine.ts` if the compound has custom iteration logic.

10. **Validate `outputName`** if your node uses it — check `/^[a-zA-Z_]\w*$/`.

---

## 10. Architecture Decisions

| Decision                            | Rationale                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------- |
| **TypeBox over Zod**                | Schemas are JSON Schema natively; serializable; `Value.Check()` built-in  |
| **Nested store, not flat Map**      | Aligns with `TObject` nesting; `get("trigger")` → full object             |
| **Writes strict, reads permissive** | `set()` validates; `get()` returns undefined (no error)                   |
| **Static + dynamic schemas**        | `contextOutputs` for fixed; `getContextOutputs(data)` for configurable    |
| **Scoped outputs for compounds**    | Loop vars (`loop.item`) don't leak outside compound body                  |
| **Fork context per node**           | Ensures third-party nodes can't write outside declared outputs            |
| **Schemas in code, not file**       | `.zotflow` files don't version schemas — they come from NodeType registry |
| **Validation in engine**            | All entry points (manual run, future event triggers) get validated        |
| **300ms validation debounce**       | Fast interactive feedback without thrashing on rapid edits                |
| **`outputName` configurable**       | Sequential loops need unique namespaces; user picks the name              |

---

## 11. Error Codes (Workflow-specific)

| Code                         | Source                        | When                                       |
| ---------------------------- | ----------------------------- | ------------------------------------------ |
| `WORKFLOW_VALIDATION_FAILED` | `WorkflowEngine.execute()`    | Design-time validation finds errors        |
| `WORKFLOW_CYCLE_DETECTED`    | `WorkflowEngine.execute()`    | Graph has cycles                           |
| `WORKFLOW_NO_TRIGGER`        | `WorkflowEngine.execute()`    | No trigger node found                      |
| `WORKFLOW_NODE_NOT_FOUND`    | `WorkflowEngine.execute()`    | Node or node type missing during execution |
| `WORKFLOW_NODE_FAILED`       | `WorkflowEngine.execute()`    | Node's `execute()` threw                   |
| `WORKFLOW_TERMINATED`        | —                             | Workflow ended via Terminate node          |
| `CONTEXT_UNDECLARED_WRITE`   | `StrictWorkflowContext.set()` | Write path not in allowed schema           |
| `CONTEXT_TYPE_MISMATCH`      | `StrictWorkflowContext.set()` | Value fails type check                     |

---

## 12. Data Flow Diagrams

### Context Schema Flow

```
NodeType declarations
    ├── contextOutputs / getContextOutputs()
    ├── scopedContextOutputs / getScopedContextOutputs()
    └── contextInputs / getContextInputs()
            │
            ▼
    propagateSchemas(nodes, edges)
            │
            ▼
    PropagatedSchema per node
    ├── available   (what this node can read)
    ├── outputs     (what this node writes)
    └── cumulative  (available + outputs, for downstream)
            │
    ┌───────┼───────────┐
    ▼       ▼           ▼
Validation  Autocomplete  Execution
(design)    (UI)          (runtime fork)
```

### Execution Flow

```
WorkflowService.startRun(file)
    └── WorkflowRun.start()
            └── WorkflowEngine.execute(file, signal, callbacks)
                    │
                    ├── 1. validateWorkflow() — fail fast on errors
                    ├── 2. getTopLevelGraph() — partition
                    ├── 3. topologicalSort() — order + cycle check
                    ├── 4. propagateSchemas() — context availability
                    │
                    └── 5. Execute loop (from trigger):
                            │
                            ├── fork StrictWorkflowContext (per-node writes)
                            ├── nodeType.execute(context, data, signal)
                            │       └── returns output handle ID
                            │
                            ├── [if compound]:
                            │       ├── merge scopedContextOutputs
                            │       └── executeApplyToEach() or executeInnerChain()
                            │
                            ├── [if TERMINATE_HANDLE]: stop
                            └── follow edge to next node
```
