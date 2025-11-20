# GLB 导出优化 - 开发与故障排查日志

本文档记录了在实现 GLB 导出优化（特别是针对 "Preview" 预览模式）过程中遇到的技术挑战及其解决方案。

## 1. 优化策略演变

### 初始问题
`Archive`（归档）、`Standard`（标准）和 `Preview`（预览）三种模式导出的文件大小几乎相同（约 8MB），说明简单的顶点减面策略不足以拉开差距。

### 问题诊断
对于包含数百个零部件的工业模型：
1.  **节点开销 (Node Overhead)**：场景图层级结构本身占用了大量空间。
2.  **绘制调用 (Draw Calls)**：大量的小网格阻碍了有效的压缩。
3.  **材质壁垒 (Material Barriers)**：每个网格使用独立的材质，导致无法合并网格。

### 解决方案："Preview" 专用管线
我们为 Preview 模式设计了一套激进的优化管线：
1.  **Palette (材质合并)**：将所有材质合并为一个（创建纹理图集）。
2.  **Join (网格合并)**：将所有网格合并为一个单一网格（消除节点层级）。
3.  **Simplify (减面)**：激进地减少顶点数量（仅保留 5%）。
4.  **Draco (压缩)**：应用高强度的几何压缩。

---

## 2. 技术挑战与解决方案

### 问题 1：`ReferenceError: document is not defined`
**报错信息**：
```
[Worker] Error: ReferenceError: document is not defined at palette ...
```
**原因**：
`@gltf-transform` 库的 `palette` 函数尝试使用 `document.createElement('canvas')` 来创建画布以处理纹理。然而，Web Worker 运行在后台线程中，无法访问 DOM 对象（即 `document` 不存在）。

**解决方案**：
我们在 Worker 中添加了一个 Polyfill（补丁），模拟 `document` 对象，并将创建 canvas 的请求重定向到 `OffscreenCanvas`（Worker 环境支持的离屏画布）。

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

### 问题 2：`TypeError: canvas.toBlob is not a function`
**报错信息**：
```
[Worker] Error: TypeError: canvas.toBlob is not a function
```
**原因**：
该库期望 Canvas 对象具有标准的 HTML5 `toBlob()` 方法。但是，`OffscreenCanvas` 使用的是不同的 API 方法，名为 `convertToBlob()`。

**解决方案**：
我们扩展了模拟的 canvas 对象，手动实现了 `toBlob` 方法，将其包装调用 `convertToBlob`。

```javascript
// src/gltf-optimizer.worker.js
const canvas = new OffscreenCanvas(1, 1);
// Polyfill toBlob
canvas.toBlob = function(callback, type, quality) {
    this.convertToBlob({ type, quality }).then(callback);
};
```

### 问题 3：`ReferenceError: io is not defined`
**报错信息**：
```
Uncaught ReferenceError: io is not defined
```
**原因**：
在编辑文件添加 Polyfill 的过程中，初始化 `WebIO` 实例的代码行 `const io = new WebIO();` 被意外删除了。

**解决方案**：
在 `src/gltf-optimizer.worker.js` 中恢复了该初始化代码。

### 问题 4：浏览器自动化工具连接失败
**现象**：
Agent 内部的浏览器工具无法连接到调试端口，导致无法自动截图验证。

**原因**：
内部环境配置问题，导致无法控制无头浏览器实例。

**解决方案**：
我们修改了前端代码 (`src/main.js`)，在导出成功后的状态栏中直接显示 **“原始大小 -> 优化后大小”**。这样无需截图，用户也能直观地看到优化效果。

```javascript
// src/main.js
statusEl.textContent = `导出成功 (${preset}): ${result.originalSize}MB -> ${result.optimizedSize}MB`;
```
