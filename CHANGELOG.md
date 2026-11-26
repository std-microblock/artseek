# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions adhere to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- View bounds now include translation, scale and rotation. Since Android 5 these live only in
  the native `RenderNode`, which was not read, so every view under a transformed ancestor (a
  `CoordinatorLayout` child below a collapsing app bar, for example) was reported hundreds of
  pixels away from where it is drawn. The properties block is located at runtime from the
  view's own bounds, and the full matrix is propagated to descendants.

### Added

- `transform` on `ViewTreeNode` and `ViewMeta` (`"translate"`, `"affine"`, `"approximate"`).
- `transformSource` on the `tree` result and `ViewMeta` (`"rendernode"` or `"unavailable"`).

## [0.1.1] - 2026-11-22

### Fixed

- Lazily open `/proc/<pid>/mem` only when `process_vm_readv` returns `ENOSYS`, `EPERM`, or
  `EACCES`, avoiding `IN_OPEN` triggers on `/proc/<pid>/mem` `inotify` watches in hardened apps.
- Support merged `Class.fields_` layout on newer ART (`29ef591`).

## [0.1.0] - 2026-11-22

First public release: the SDK is published to npm as `artseek`, and the native
`arm64-v8a` binary is attached to the GitHub release.

### Added

- Read-only ART heap access over `/proc/<pid>/mem`: object field reads, instance scans by
  class name (dot name, JNI descriptor, or `*` glob), array and collection reads.
- View layer: live `Activity`/`ViewRootImpl` enumeration, view hierarchy dumps, and view
  lookup by text with `$viewMeta()` (bounds, visibility, enabled state).
- String layer: `strsearch` over live `java.lang.String` instances, with owner references
  via `$whoRefs()` / `find_owner`.
- `QuerySpec` query VM: `field`, `index`, `first`, `where`, `parent`, `find_owner`, `crawl`,
  `select`, `dump`, `ref`, and `view_meta` steps executed on-device in a single request.
- Zero-injection transport: the native binary is pushed to `/data/local/tmp/.artseek/` and
  driven over NDJSON; no agent is injected, no target process is patched.
- `artseek` CLI (`ping`, `selfcheck`, `calibrate`, `roots`, `tree`, `strsearch`, `instances`,
  `dumpobj`, `whorefs`, `query`).
- Persistent and one-shot stdio transports with idle shutdown, reconnect, and per-request
  timeouts.
