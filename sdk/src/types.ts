/**
 * artseek Protocol v1 & SDK TypeScript definitions.
 * Mirrors protocol/protocol.md 1:1.
 */

import type { HeapNodeExtensions } from './index.js';
export type { HeapNodeExtensions };

// ---------------------------------------------------------------------------
// Protocol Envelopes & Errors
// ---------------------------------------------------------------------------

export type ArtseekOp =
  | 'ping'
  | 'selfcheck'
  | 'calibrate'
  | 'roots'
  | 'tree'
  | 'strsearch'
  | 'dumpobj'
  | 'whorefs'
  | 'instances'
  | 'query'
  | 'batch';

export type ArtseekErrorCode =
  | 'PROCESS_NOT_FOUND'
  | 'STALE_REF'
  | 'CALIBRATION_FAILED'
  | 'INVALID_QUERY'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'TIMEOUT'
  | 'TRANSPORT_ERROR'
  | 'TRANSPORT_CLOSED'
  | (string & {});

export interface ArtseekErrorObject {
  code: ArtseekErrorCode;
  message: string;
}

export interface ArtseekMeta {
  pid?: number;
  starttime?: number;
  elapsedMs?: number;
  frozenMs?: number;
  cacheHit?: boolean;
  recalibrated?: boolean;
}

export interface TargetSpec {
  pid?: number;
  pkg?: string;
  freeze?: boolean;
  madvise?: boolean;
  timeoutMs?: number;
}

export interface ArtseekRequest<P = Record<string, unknown>> {
  id?: string | number;
  op: ArtseekOp;
  pid?: number;
  pkg?: string;
  freeze?: boolean;
  madvise?: boolean;
  timeoutMs?: number;
  params?: P;
}

export interface ArtseekResponse<T = unknown> {
  id?: string | number;
  ok: boolean;
  meta?: ArtseekMeta;
  data: T;
  error: ArtseekErrorObject | null;
}

export class ArtseekError extends Error {
  public readonly code: ArtseekErrorCode;
  public readonly meta?: ArtseekMeta;
  public readonly requestId?: string | number;

  constructor(
    code: ArtseekErrorCode,
    message: string,
    options?: { meta?: ArtseekMeta; requestId?: string | number; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ArtseekError';
    this.code = code;
    this.meta = options?.meta;
    this.requestId = options?.requestId;
  }
}

// ---------------------------------------------------------------------------
// Geometry & Shared Heap/View Structures
// ---------------------------------------------------------------------------

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ScreenSize {
  width: number;
  height: number;
}

export type Visibility = 'VISIBLE' | 'INVISIBLE' | 'GONE';

export type OffscreenDirection = 'none' | 'above' | 'below' | 'left' | 'right' | 'hidden';

export interface HeapObjectRef {
  addr: string;
  className: string;
  pid?: number;
}

export interface RefOwner {
  refAddr: string;
  ownerAddr: string;
  ownerClass: string;
  fieldName: string;
  fieldType: string;
  preview?: Record<string, unknown>;
}

export interface CrawlHit {
  path: string;
  value: string;
  addr: string;
}

export interface ScrollableAncestor {
  addr: string;
  a11yViewId: number;
  className: string;
  visibleBounds: Bounds;
}

export interface ParentChainEntry {
  addr: string;
  className: string;
  a11yViewId: number;
  resourceIdInt: number;
}

export interface ViewMeta {
  addr: string;
  className: string;
  superClasses: string[];
  a11yViewId: number;
  resourceIdInt: number;
  visibility: Visibility;
  effectiveVisible: boolean;
  alpha: number;
  /**
   * Present when the view has a transform of its own. `"translate"` and `"affine"`
   * (scale/rotation) are exact: bounds are the transformed bounding box and descendants
   * inherit the full matrix. `"approximate"` means it could not be read exactly (3D
   * rotation, or the native node did not match the view), so bounds may be off.
   */
  transform?: 'translate' | 'affine' | 'approximate';
  clickable: boolean;
  scrollable: boolean;
  enabled: boolean;
  text: string | null;
  desc: string | null;
  screenBounds: Bounds;
  visibleBounds: Bounds;
  viewportBounds: Bounds;
  screenSize: ScreenSize;
  inViewport: boolean;
  visibleAreaRatio: number;
  offscreenDirection: OffscreenDirection;
  isFocusedWindow: boolean;
  scrollableAncestor: ScrollableAncestor | null;
  parentChain: ParentChainEntry[];
  /** See {@link TreeResult.transformSource}. */
  transformSource: 'rendernode' | 'unavailable';
}

// ---------------------------------------------------------------------------
// Direct Operation Params & Results
// ---------------------------------------------------------------------------

export interface PingResult {
  version: string;
  cacheDir: string;
  layoutLoaded: boolean;
  layoutPath: string;
  hasEmbeddedSentinel: boolean;
}

export interface SelfcheckParams {
  autoRecalibrate?: boolean;
}

export interface SelfcheckCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface SelfcheckResult {
  passed: boolean;
  recalibrated: boolean;
  checks: SelfcheckCheck[];
  layout: Record<string, number>;
}

export interface CalibrateResult {
  layout: Record<string, number>;
  layoutPath: string;
  elapsedMs: number;
}

export interface ActivityInfo {
  addr: string;
  className: string;
  paused: boolean;
  resumed: boolean;
  stopped: boolean;
  destroyed: boolean;
}

export interface ViewRootInfo {
  addr: string;
  viewAddr: string;
  viewClass: string;
  activityAddr?: string;
  activityClass?: string;
  width: number;
  height: number;
  nodeCount: number;
  added: boolean;
  hasWindowFocus: boolean;
  windowVisibility: number;
  winFrame: Bounds;
}

export interface RootsResult {
  activities: ActivityInfo[];
  viewRoots: ViewRootInfo[];
}

export interface TreeParams {
  onlyFocused?: boolean;
  rootAddr?: string;
  maxDepth?: number;
}

export interface ViewTreeNode {
  addr: string;
  className: string;
  superClasses: string[];
  a11yViewId: number;
  resourceIdInt: number;
  visibility: Visibility;
  effectiveVisible: boolean;
  clickable: boolean;
  scrollable: boolean;
  enabled: boolean;
  text: string | null;
  desc: string | null;
  tag: unknown;
  /**
   * Present when the view has a transform of its own. `"translate"` and `"affine"`
   * (scale/rotation) are exact: bounds are the transformed bounding box and descendants
   * inherit the full matrix. `"approximate"` means it could not be read exactly (3D
   * rotation, or the native node did not match the view), so bounds may be off.
   */
  transform?: 'translate' | 'affine' | 'approximate';
  localBounds: Bounds;
  screenBounds: Bounds;
  visibleBounds: Bounds;
  inViewport: boolean;
  visibleAreaRatio: number;
  children: ViewTreeNode[];
}

export interface TreeRootEntry {
  rootAddr: string;
  activityClass?: string;
  hasWindowFocus: boolean;
  winFrame: Bounds;
  tree: ViewTreeNode;
}

export interface TreeResult {
  roots: TreeRootEntry[];
  /**
   * Where view transforms were read from. `"unavailable"` means the native RenderNode layout
   * could not be located in this process, so no bounds include translation, scale or rotation.
   */
  transformSource: 'rendernode' | 'unavailable';
}

export interface StrSearchParams {
  needle: string;
  limit?: number;
  includeOwnerPreview?: boolean;
}

export interface StrSearchHit {
  addr: string;
  text: string;
  owners: RefOwner[];
}

export interface StrSearchResult {
  needle: string;
  hits: StrSearchHit[];
}

export interface DumpOptions {
  depth?: number;
  schemaOnly?: boolean;
  expandCollections?: boolean;
  maxArrayItems?: number;
}

export interface DumpObjParams extends DumpOptions {
  addr: string;
  expectedClass?: string;
}

export interface WhoRefsParams {
  addr: string;
  limit?: number;
}

export interface WhoRefsResult {
  targetAddr: string;
  owners: RefOwner[];
}

export interface InstancesParams {
  type: string;
  limit?: number;
  includeSubclasses?: boolean;
}

export interface InstanceItem {
  addr: string;
  className: string;
}

export interface InstancesResult {
  type: string;
  total: number;
  items: InstanceItem[];
}

// ---------------------------------------------------------------------------
// Unified Query VM AST (`RootSource`, `Step`, `QuerySpec`) & Batch
// ---------------------------------------------------------------------------

export interface ViewSelector {
  a11yViewId?: number;
  bounds?: Bounds;
  resourceIdInt?: number;
  text?: string;
  desc?: string;
  className?: string;
  onlyFocused?: boolean;
}

export interface ScanOptions {
  type: string;
  limit?: number;
  includeSubclasses?: boolean;
}

export type RootSource =
  | { kind: 'activity'; which: 'current' | 'all'; pattern?: string }
  | { kind: 'scan'; type: string; limit?: number; includeSubclasses?: boolean }
  | ({ kind: 'view' } & ViewSelector)
  | { kind: 'addr'; addr: string; expectedClass?: string };

export interface WhereOperator {
  $contains?: string;
  $startsWith?: string;
  $gt?: number;
  $lt?: number;
  $ne?: unknown;
}

export type WhereFilterValue = string | number | boolean | null | WhereOperator;
export type WhereFilter = Record<string, WhereFilterValue>;

export interface FindOwnerOptions {
  instanceOf?: string;
  maxHops?: number;
}

export interface OwnerViewOptions {
  maxHops?: number;
}

export interface CrawlOptions {
  depth?: number;
  maxObjects?: number;
}

export type Step =
  | { op: 'field'; name: string }
  | { op: 'index'; index: number }
  | { op: 'first' }
  | { op: 'where'; filter: WhereFilter }
  | { op: 'parent'; hops?: number }
  | { op: 'find_owner'; instanceOf?: string; maxHops?: number }
  | { op: 'crawl'; match?: string; depth?: number; maxObjects?: number }
  | { op: 'select'; shape: Record<string, string> }
  | ({ op: 'dump' } & DumpOptions)
  | { op: 'ref' }
  | { op: 'view_meta' };

export interface QuerySpec {
  root: RootSource;
  steps: Step[];
  collection: boolean;
}

export interface BatchSubQuery {
  id?: string;
  op: Exclude<ArtseekOp, 'batch'>;
  params?: Record<string, unknown>;
}

export interface BatchParams {
  queries: BatchSubQuery[];
}

export interface BatchSubResult<T = unknown> {
  id?: string;
  ok: boolean;
  data?: T;
  error?: ArtseekErrorObject | null;
}

export interface BatchResult {
  results: BatchSubResult[];
}

// ---------------------------------------------------------------------------
// Lazy Thenable HeapProxy & Module Augmentation Extension System
// ---------------------------------------------------------------------------

export type HeapExtensionFn = (node: HeapProxy<any>, ...args: any[]) => any;

export type HeapExtensionsMap = Record<`$${string}`, HeapExtensionFn>;

export interface HeapProxyBuiltins<T = any> extends PromiseLike<T> {
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T | TResult>;
  finally(onfinally?: (() => void) | null): Promise<T>;

  /** Escape hatch for fields named `then`, `catch`, `toJSON`, `$xxx`, etc. */
  $field<V = any>(name: string): HeapProxy<V>;
  /** Takes the first non-null item from a collection. */
  $first(): HeapProxy<any>;
  /** Filters collection elements on-device. */
  $where(filter: WhereFilter): HeapProxy<any[]>;
  /** Follows `View.mParent` upward `hops` times (default: 1). */
  $parent(hops?: number): HeapProxy<any>;
  /** Reverse BFS via WhoRefs to locate the nearest owner matching `instanceOf`. */
  $findOwner(opts?: FindOwnerOptions): HeapProxy<any>;
  /** Shorthand for `$findOwner({ instanceOf: 'android.view.View', ...opts })`. */
  $ownerView(opts?: OwnerViewOptions): HeapProxy<any>;
  /** Computes full View layout, clipping, visibility, and offscreen scroll metadata. */
  $viewMeta(): HeapProxy<ViewMeta | null>;
  /** Object-graph BFS collecting strings matching `match` (or all non-empty strings). */
  $crawl(match?: string, opts?: CrawlOptions): HeapProxy<CrawlHit[]>;
  /** Projects `{ key: "a.b[*].c" }` into a structured JSON object in one pass. */
  $select<S extends Record<string, string>>(shape: S): HeapProxy<{ [K in keyof S]: any }>;
  /** Terminal serialization of current object(s) to structured JSON. */
  $dump(opts?: DumpOptions): HeapProxy<any>;
  /** Resolves incoming references to the current object(s). */
  $whoRefs(limit?: number): HeapProxy<RefOwner[]>;
  /** Terminal returning `{ addr, className, pid }` (or `null`). */
  $ref(): HeapProxy<HeapObjectRef | null>;
  /** Synchronous inspector returning a cloned compiled `{ root, steps, collection }` AST. */
  $query(): QuerySpec;
}

export interface HeapProxyFields {
  readonly [index: number]: HeapProxy<any>;
  readonly [prop: string]: HeapProxy<any>;
}

export type HeapProxy<T = any> = HeapProxyBuiltins<T> &
  HeapNodeExtensions &
  HeapProxyFields;

// ---------------------------------------------------------------------------
// Transport Interface
// ---------------------------------------------------------------------------

export interface ArtseekTransport {
  request<T = unknown>(req: ArtseekRequest): Promise<ArtseekResponse<T>>;
  close(): Promise<void>;
}
