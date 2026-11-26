# artseek Protocol Specification (v1)

`artseek` is a root, zero-injection, read-only Android ART heap & View inspector.
Communication uses **reusable NDJSON (newline-delimited JSON) over `stdin`/`stdout`**.
All diagnostic logs MUST go to `stderr` so `stdout` contains strictly one JSON object per line.

- **Persistent stdio session (default)**: reads JSON requests line-by-line until `stdin` EOF (or `--idle-ms` timeout), keeping in-RAM caches (`(pid, starttime)` -> `anchor`, `Class` table, `DexFile` map, `FieldLayout` map) warm across requests while clearing `/proc/<pid>/mem` page cache between requests so every request reads live memory.
- **One-shot compatibility**: piping a single JSON line and closing `stdin` executes 1 request and exits cleanly.

---

## 1. CLI Invocation

```text
artseek [--cache-dir /data/local/tmp/.artseek] [--idle-ms 0]
artseek --version
artseek --selfcheck [--pid <pid> | --pkg <pkg>]
artseek --calibrate
```

- Default cache directory: `/data/local/tmp/.artseek` (created with `0700`, owned by root).
- Cached layout file: `<cache-dir>/layout.json` (mode `0600`).
- Embedded `sentinel.dex` is linked directly into the binary via xmake `utils.bin2obj`.
- On startup / first query:
  1. Load `<cache-dir>/layout.json` if present; otherwise run auto-calibration using embedded `sentinel.dex`.
  2. Validate layout against the target process (anchor uniqueness + `java.lang.String` + `java.lang.Class` self-checks).
  3. If validation fails (e.g. ROM/ART update), automatically re-run sentinel calibration, rewrite `layout.json` (`0600`), unlink temporary `sentinel.dex`, and retry once.

---

## 2. Request & Response Envelopes

### Request (1 line JSON on `stdin`)
```json
{
  "id": "req_1",
  "op": "query",
  "pid": 12141,
  "pkg": "com.taobao.idlefish",
  "freeze": false,
  "madvise": true,
  "timeoutMs": 5000,
  "params": {}
}
```
- `id`: optional string/number echoed back in response.
- `op`: `"ping" | "selfcheck" | "calibrate" | "roots" | "tree" | "strsearch" | "dumpobj" | "whorefs" | "instances" | "query" | "batch"`.
- `pid` / `pkg`: target process. If `pid` is omitted and `pkg` is set, `artseek` resolves `pid` from `/proc/*/cmdline`. Not required for `ping` or `calibrate`.
- `freeze`: if `true`, pauses all tids in `/proc/<pid>/task` with `SIGSTOP` during memory reads and restores with `SIGCONT` via RAII guard (default `false`).
- `madvise`: if `true` (default), best-effort `process_madvise(MADV_DONTNEED)` cleanup after reads.

### Response (1 line JSON on `stdout`)
```json
{
  "id": "req_1",
  "ok": true,
  "meta": {
    "pid": 12141,
    "starttime": 1234567,
    "elapsedMs": 24,
    "frozenMs": 0,
    "cacheHit": true,
    "recalibrated": false
  },
  "data": {},
  "error": null
}
```

Error response:
```json
{
  "id": "req_1",
  "ok": false,
  "meta": { "elapsedMs": 3 },
  "data": null,
  "error": {
    "code": "PROCESS_NOT_FOUND | STALE_REF | CALIBRATION_FAILED | INVALID_QUERY | NOT_FOUND | INTERNAL_ERROR",
    "message": "human-readable message"
  }
}
```

---

## 3. Operations (`op`)

### `ping`
Returns `{ version: "0.1.0", cacheDir: string, layoutLoaded: boolean, layoutPath: string, hasEmbeddedSentinel: boolean }`.

### `selfcheck`
Params: `{ autoRecalibrate?: boolean }` (default `true`).
Returns `{ passed: boolean, recalibrated: boolean, checks: Array<{ name: string, ok: boolean, detail?: string }>, layout: Record<string, number> }`.

### `calibrate`
Forces sentinel calibration using embedded `sentinel.dex`, writes `<cache-dir>/layout.json` (`0600`), removes temp dex.
Returns `{ layout: Record<string, number>, layoutPath: string, elapsedMs: number }`.

### `roots`
Returns:
```json
{
  "activities": [
    { "addr": "0x...", "className": "com.example.MainActivity", "paused": false, "resumed": true, "stopped": false, "destroyed": false }
  ],
  "viewRoots": [
    {
      "addr": "0x...",
      "viewAddr": "0x...",
      "viewClass": "com.android.internal.policy.DecorView",
      "activityAddr": "0x...",
      "activityClass": "com.example.MainActivity",
      "width": 1080,
      "height": 2400,
      "nodeCount": 265,
      "added": true,
      "hasWindowFocus": true,
      "windowVisibility": 0,
      "winFrame": { "left": 0, "top": 0, "right": 1080, "bottom": 2400 }
    }
  ]
}
```

### `tree`
Params: `{ onlyFocused?: boolean, rootAddr?: string, maxDepth?: number }`.
Returns `{ roots: Array<{ rootAddr, activityClass, hasWindowFocus, winFrame, tree: ViewTreeNode }> }`.
Each `ViewTreeNode` has:
`addr`, `className`, `superClasses`, `a11yViewId`, `resourceIdInt`, `visibility` (`"VISIBLE" | "INVISIBLE" | "GONE"`), `effectiveVisible`, `clickable`, `scrollable`, `enabled`, `text`, `desc`, `tag`, `localBounds`, `screenBounds`, `visibleBounds`, `inViewport`, `visibleAreaRatio`, `children`, and `transform` when the view has a transform matrix.

`transform` is `"translate"`, `"affine"` (scale/rotation) or `"approximate"`. Translation, scale, rotation and pivot are read from the view's native `RenderNode` (libhwui `RenderProperties`), where Android keeps them since 5.0; the block is located at runtime by matching the view's own left/top/right/bottom/width/height. `screenBounds` is the transformed bounding box and descendants inherit the full matrix. `"approximate"` marks a view whose transform could not be read exactly (3D rotation, or no properties block matching the view's bounds). The result also carries `transformSource`: `"rendernode"`, or `"unavailable"` when the layout could not be located and bounds therefore ignore view transforms. `view_meta` reports the same two fields.

### `strsearch`
Params: `{ needle: string, limit?: number, includeOwnerPreview?: boolean }`.
Returns `{ needle, hits: Array<{ addr, text, owners: Array<{ refAddr, ownerAddr, ownerClass, fieldName, fieldType, preview?: Record<string, unknown> }> }> }`.

### `dumpobj`
Params: `{ addr: string, expectedClass?: string, depth?: number, schemaOnly?: boolean, expandCollections?: boolean, maxArrayItems?: number }`.
Returns structured object dump (with primitives, strings, expanded collections if enabled, and nested objects up to `depth`).

### `whorefs`
Params: `{ addr: string, limit?: number }`.
Returns `{ targetAddr, owners: Array<{ refAddr, ownerAddr, ownerClass, fieldName, fieldType }> }`.

### `instances`
Params: `{ type: string, limit?: number }`. (`type` supports dot name `com.foo.Bar`, JNI descriptor `Lcom/foo/Bar;`, or glob wildcard `*DescModel`).
Returns `{ type, total: number, items: Array<{ addr, className }> }`.

### `query` (Unified Query VM)
Params:
```json
{
  "root": RootSource,
  "steps": Step[],
  "collection": false
}
```

#### `RootSource`
1. `{ "kind": "activity", "which": "current" | "all", "pattern"?: string }`
   - `"current"`: single resumed/focused Activity (`ActivityThread` non-paused activity, with focused `ViewRootImpl.mContext` fallback/tie-breaker).
   - `"all"`: array of all live activities in the process.
2. `{ "kind": "scan", "type": string, "limit"?: number }`
   - Collection of instances whose class (or superclass if `includeSubclasses: true`) matches `type` (exact or `*` wildcard).
3. `{ "kind": "view", "a11yViewId"?: number, "bounds"?: Bounds, "resourceIdInt"?: number, "text"?: string, "desc"?: string, "className"?: string, "onlyFocused"?: boolean }`
   - Locates a single `View` object. If `a11yViewId` is provided (> 0), performs O(1)/exact `mAccessibilityViewId` match first! Falls back to `bounds`/`resourceIdInt`/`text`/`desc` scoring if `a11yViewId` is absent.
4. `{ "kind": "addr", "addr": string, "expectedClass"?: string }`
   - Direct object reference. If `expectedClass` is provided and `klass_` does not match, returns `STALE_REF`.

#### `Step` (executed left-to-right; maps over arrays when operating on a collection)
1. `{ "op": "field", "name": string }`
   - Reads instance field by name (including superclass chain). If target is a `java.util.Map` / `org.json.JSONObject` / `android.os.Bundle`, looks up key `name`!
2. `{ "op": "index", "index": number }`
   - Indexes a collection result, Java array, `ArrayList` / `List`, or `SparseArray` (supports negative indices). Unwraps collection into single element if applied to a collection.
3. `{ "op": "first" }`
   - Takes first non-null item from collection (returns `null` if empty).
4. `{ "op": "where", "filter": Record<string, unknown> }`
   - Filters collection elements on-device. Filter values support exact primitive/string equality or operator objects: `{ "$contains": "sub" }`, `{ "$startsWith": "pre" }`, `{ "$gt": 10 }`, `{ "$lt": 100 }`, `{ "$ne": null }`. Supports dotted sub-paths as keys (e.g. `{ "priceInfo.price": "199" }`).
5. `{ "op": "parent", "hops"?: number }`
   - Follows `View.mParent` upward `hops` times (default `1`).
6. `{ "op": "find_owner", "instanceOf"?: string, "maxHops"?: number }`
   - Reverse BFS via `WhoRefs` (starting from the current object itself — if current object already matches `instanceOf`, returns itself immediately!) up to `maxHops` (default `6`) to find the nearest object whose class or superclass matches `instanceOf` (default `"android.view.View"`).
7. `{ "op": "crawl", "match"?: string, "depth"?: number, "maxObjects"?: number }`
   - Object-graph BFS collecting `{ path, value, addr }` strings containing `match` (if `match` omitted, collects all non-empty strings).
8. `{ "op": "select", "shape": Record<string, string> }`
   - Projects `{ key: "a.b[*].c" }` into a clean JSON object in one pass (expands arrays/Lists/Maps along the path).
9. `{ "op": "dump", "depth"?: number, "schemaOnly"?: boolean, "expandCollections"?: boolean, "maxArrayItems"?: number }`
   - Terminal serialization of current object(s) to structured JSON.
10. `{ "op": "ref" }`
    - Terminal returning `{ addr, className, pid }` (or array of refs, or `null`).
11. `{ "op": "view_meta" }`
    - Terminal for `android.view.View` object(s). Computes full layout, clipping, visibility, and offscreen scroll metadata:
      ```json
      {
        "addr": "0x...",
        "className": "com.example.MyView",
        "superClasses": ["android.widget.FrameLayout", "android.view.ViewGroup", "android.view.View"],
        "a11yViewId": 7847,
        "resourceIdInt": 2131298194,
        "visibility": "VISIBLE | INVISIBLE | GONE",
        "effectiveVisible": true,
        "alpha": 1.0,
        "clickable": true,
        "scrollable": false,
        "enabled": true,
        "text": "...",
        "desc": "...",
        "screenBounds": { "left": 33, "top": 1563, "right": 1047, "bottom": 2915 },
        "visibleBounds": { "left": 33, "top": 1563, "right": 1047, "bottom": 2246 },
        "viewportBounds": { "left": 0, "top": 232, "right": 1080, "bottom": 2246 },
        "screenSize": { "width": 1080, "height": 2400 },
        "inViewport": true,
        "visibleAreaRatio": 0.505,
        "offscreenDirection": "none | above | below | left | right | hidden",
        "isFocusedWindow": true,
        "scrollableAncestor": {
          "addr": "0x...",
          "a11yViewId": 7801,
          "className": "androidx.recyclerview.widget.RecyclerView",
          "visibleBounds": { "left": 0, "top": 232, "right": 1080, "bottom": 2246 }
        },
        "parentChain": [
          { "addr": "0x...", "className": "...", "a11yViewId": 7846, "resourceIdInt": 0 }
        ]
      }
      ```
    - `offscreenDirection` calculation:
      - If `!effectiveVisible` or `screenBounds` has zero/negative area → `"hidden"`.
      - Compare `screenBounds` against `viewportBounds` (the intersection of `scrollableAncestor.visibleBounds` if any and screen `[0,0,screenW,screenH]`):
        - If `visibleBounds` has usable area inside viewport (`visibleAreaRatio >= 0.15` and width >= 8 and height >= 8) → `"none"` (`inViewport: true`).
        - Else if `screenBounds.bottom <= viewportBounds.top + 8` or `centerY < viewportBounds.top` → `"above"`.
        - Else if `screenBounds.top >= viewportBounds.bottom - 8` or `centerY > viewportBounds.bottom` → `"below"`.
        - Else if `screenBounds.right <= viewportBounds.left + 8` or `centerX < viewportBounds.left` → `"left"`.
        - Else if `screenBounds.left >= viewportBounds.right - 8` or `centerX > viewportBounds.right` → `"right"`.
        - Else → `"hidden"`.

- **Default terminal behavior for `query`**: if the final step is NOT one of `dump`, `select`, `ref`, `crawl`, `view_meta`, automatically materialize the current value:
  - primitives & `java.lang.String` / `CharSequence` → native JSON primitive/string
  - `null` → `null`
  - `Array` / `List` / `Map` / `JSONObject` / `Bundle` → expanded JSON (depth 2, max 64 items)
  - regular Java object → shallow dump (`depth: 1`, `expandCollections: true`) including `$addr` and `$class`.

### `batch`
Params: `{ queries: Array<{ id?: string, op: string, params?: Record<string, unknown> }> }`.
Executes all sub-queries against the same target `pid` within a **single** freeze window (if `freeze: true`) and returns `{ results: Array<{ id?, ok, data?, error? }> }`.
