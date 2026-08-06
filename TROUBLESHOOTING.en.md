# GLB Export Optimization - Development and Troubleshooting Log

> [中文](TROUBLESHOOTING.md)

This document records the technical challenges and solutions encountered while
implementing GLB export optimization, especially for the "Preview" mode.

## 1. Evolution of the optimization strategy

### Initial issue

Files exported in `Archive`, `Standard`, and `Preview` modes were almost the same
size, about 8 MB. This showed that simple vertex-reduction strategies were not
enough to create a meaningful difference.

### Diagnosis

For industrial models containing hundreds of parts:
1. **Node overhead**: the scene graph hierarchy itself consumes substantial space.
2. **Draw calls**: many small meshes prevent effective compression.
3. **Material barriers**: each mesh uses an independent material, preventing mesh
   merging.

### Solution: a dedicated "Preview" pipeline

We designed an aggressive optimization pipeline for Preview mode:
1. **Palette (material consolidation)**: consolidate all materials into one by
   creating a texture atlas.
2. **Join (mesh consolidation)**: merge all meshes into one mesh, eliminating the
   node hierarchy.
3. **Simplify (geometry reduction)**: aggressively reduce vertex count, retaining
   only 5%.
4. **Draco (compression)**: apply high-intensity geometry compression.

---

## 2. Technical challenges and solutions

### Issue 1: `ReferenceError: document is not defined`

**Error**:
```
[Worker] Error: ReferenceError: document is not defined at palette ...
```
**Cause**:
The `palette` function from `@gltf-transform` tries to use
`document.createElement('canvas')` to create a canvas for texture processing.
However, a Web Worker runs on a background thread and cannot access DOM objects,
so `document` does not exist.

**Solution**:
We added a polyfill in the Worker that simulates the `document` object and
redirects canvas-creation requests to `OffscreenCanvas`, the offscreen canvas
available in Worker environments.

```javascript
// src/gltf-optimizer.worker.js
if (typeof self.document === 'undefined') {
    self.document = {
        createElement: (tagName) => {
            if (tagName === 'canvas' && typeof OffscreenCanvas !== 'undefined') {
                return new OffscreenCanvas(1, 1);
            }
            return {};
        }
    };
}
```

### Issue 2: `TypeError: canvas.toBlob is not a function`

**Error**:
```
[Worker] Error: TypeError: canvas.toBlob is not a function
```
**Cause**:
The library expects Canvas objects to provide the standard HTML5 `toBlob()`
method. `OffscreenCanvas` exposes a different API, `convertToBlob()`.

**Solution**:
We extended the simulated canvas object with a `toBlob` implementation that wraps
`convertToBlob`.

```javascript
// src/gltf-optimizer.worker.js
const canvas = new OffscreenCanvas(1, 1);
// Polyfill toBlob
canvas.toBlob = function(callback, type, quality) {
    this.convertToBlob({ type, quality }).then(callback);
};
```
