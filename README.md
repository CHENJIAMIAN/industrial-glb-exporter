[English](./README.en.md)

<!-- codex-github-rules:bilingual-summary -->
> **中文简介**：基于 Web 的工业级 GLB 模型导出与优化工具
>
> **English summary**: A web-based industrial-grade GLB model export and optimization tool

---
# Industrial GLB Exporter

这是一个基于 Web 的工业级 GLB 模型导出与优化工具。它允许用户加载 GLB/GLTF 模型，并根据不同的应用场景（存档、标准展示、预览）选择不同的精度进行导出。

## 功能特性

- **多级精度导出**：提供三种预设导出选项，满足不同需求。
    - **存档级 (Archive)**：几乎无损，保留原始细节，仅做必要的数据清理。
    - **标准级 (Standard)**：平衡质量与体积，适合常规 Web 展示（20% 减面，Draco 压缩）。
    - **预览级 (Preview)**：极致压缩，适合移动端或快速预览（70% 减面，纹理压缩）。
- **高性能处理**：使用 Web Worker 在后台线程处理模型优化，避免阻塞主线程 UI。
- **高级优化算法**：
    - **几何优化**：使用 `meshoptimizer` 进行高质量减面和顶点焊接。
    - **数据压缩**：集成 Google Draco 压缩算法。
    - **纹理处理**：智能重采样和尺寸限制。
    - **清理**：自动去除未使用的节点、材质和重复数据。
- **实时预览**：基于 Three.js 的实时模型查看器。

## 程序运行原理

本项目的核心在于将繁重的 3D 模型处理任务从主线程分离，利用 Web Worker 实现高效的后台优化。以下是程序的完整运行流程：

1.  **初始化与启动**
    - 运行 `npm run dev` 启动 Vite 开发服务器。
    - 浏览器加载 `index.html`，引入 `src/main.js` 作为入口。
    - `main.js` 初始化 Three.js 场景（Scene, Camera, Renderer）和 UI 事件监听器。

2.  **模型加载 (Main Thread)**
    - 用户选择 `.glb` 文件后，`main.js` 使用 `GLTFLoader` (配合 `DRACOLoader`) 解析模型。
    - 解析后的模型被添加到 Three.js 场景中进行实时预览。

3.  **导出与优化 (Main Thread -> Worker)**
    - 用户点击导出按钮（如“标准级”），触发 `GlbExporter.export()`。
    - **序列化**：首先在主线程使用 `GLTFExporter` 将当前的 Three.js 场景对象序列化为标准的二进制 GLB 数据 (ArrayBuffer)。
    - **数据转移**：将此 ArrayBuffer 和优化配置（如压缩等级、减面比例）通过 `postMessage` 发送给 Web Worker。使用 `Transferable Objects` 技术零拷贝转移数据所有权，避免内存复制。

4.  **后台处理 (Web Worker)**
    - `gltf-optimizer.worker.js` 接收数据。
    - **WASM 加载**：Worker 线程自动加载并实例化 `meshoptimizer` 和 `draco3d` 的 WebAssembly (WASM) 模块，确保计算密集型任务以近乎原生的速度运行。
    - **读取**：使用 `@gltf-transform/core` 读取二进制流。
    - **优化**：根据配置执行一系列转换：
        - `simplify()`: 调用 WASM 版 `meshoptimizer` 进行高质量网格减面。
        - `weld()`: 合并重复顶点。
        - `textureCompress()`: (如有) 调整纹理尺寸。
        - `join()`: (预览模式) 合并网格以减少 Draw Calls。
        - `draco()`: 调用 WASM 版 Draco 编码器应用几何压缩。
    - **写回**：将优化后的模型重新写入为二进制 GLB 数据。
    - **返回**：将最终的 ArrayBuffer 发回主线程。

5.  **文件下载 (Main Thread)**
    - 主线程接收到优化后的数据，生成 Blob 对象。
    - 创建临时的 `<a>` 标签触发浏览器下载行为，保存文件到本地。

## Draco 3D 压缩详解

本项目深度集成了 **Google Draco** 压缩技术，这是实现“工业级”模型轻量化的关键。

### 1. 它是做什么的？
Draco 是一个用于压缩和解压 3D 几何网格（Meshes）与点云（Point Clouds）的开源库。它不压缩纹理图片（那是 WebP/JPEG 的工作），而是专门压缩**几何数据**：
-   **顶点位置 (Position)**
-   **法线向量 (Normal)**
-   **纹理坐标 (UV)**
-   **顶点颜色 (Color)**

### 2. 在本项目中如何工作？

Draco 的工作流分为**编码（压缩）**和**解码（解压）**两个部分，本项目完整实现了这一闭环：

#### A. 编码端 (Web Worker)
在 `gltf-optimizer.worker.js` 中，我们通过 `@gltf-transform` 调用 Draco 编码器：
-   **WASM 注入**：Worker 启动时，会从 `/public/draco/` 目录加载 `draco_encoder.wasm`。这是编译为 WebAssembly 的 C++ 核心库，负责高性能压缩。
-   **量化 (Quantization)**：这是压缩的核心。程序根据用户选择的精度（如标准级 vs 预览级），将浮点数坐标转换为整数。
    -   *例如：标准级使用 11-bit 位置量化，预览级使用 8-bit。位数越低，体积越小，但几何变形越大。*
-   **Edgebreaker 算法**：使用 Draco 专有的 Edgebreaker 算法进一步压缩网格的拓扑连接信息。

#### B. 解码端 (Main Thread)
在 `src/main.js` 中，为了能预览导入的模型（如果它已经是 Draco 压缩的），我们配置了 `DRACOLoader`：
-   **WASM 解码**：加载器会自动请求 `/public/draco/draco_decoder.wasm`。
-   **实时解压**：当用户上传一个 Draco 压缩的 GLB 文件时，浏览器会在后台线程解压几何数据，还原为 Three.js 可用的 BufferGeometry。

### 3. 核心协作机制：@gltf-transform 与 draco3d

你可能会疑惑：为什么既用了 `@gltf-transform` 又用了 `draco3d`？它们的关系是**编排者**与**执行者**的关系。

-   **@gltf-transform (编排者)**：
    -   它是一个高层级的 GLTF 处理库。它负责解析 GLB 文件结构，遍历场景图，找到所有的网格（Mesh）。
    -   它本身**不包含** Draco 的压缩算法代码，以保持库的轻量。
    -   它定义了标准化的 `draco()` 变换函数，用于声明“我想对这个文档进行 Draco 压缩”。

-   **draco3d (执行者)**：
    -   这是 Google 官方的底层算法库，包含核心的 C++ 编译出的 WASM 模块。
    -   它只懂如何压缩二进制数据，不懂 GLTF 的文件结构。

-   **协作流程 (依赖注入)**：
    1.  我们在 Worker 中手动加载 `draco3d` 的 WASM 模块。
    2.  通过 `io.registerDependencies({ 'draco3d.encoder': ... })` 将这些底层模块**注入**给 `@gltf-transform` 的 IO 系统。
    3.  当执行 `document.transform(draco(...))` 时，`@gltf-transform` 会自动调用我们注入的 `draco3d` 模块，将网格数据喂给它进行压缩，然后将压缩后的数据重新封装成符合 `KHR_draco_mesh_compression` 标准的 GLTF 数据块。

通过这种机制，我们能在浏览器端实现媲美桌面专业软件（如 Blender）的模型压缩能力。

## 技术栈

- **核心引擎**：[Three.js](https://threejs.org/)
- **模型处理**：[@gltf-transform](https://gltf-transform.donmccurdy.com/)
- **网格优化**：[meshoptimizer](https://github.com/zeux/meshoptimizer)
- **构建工具**：[Vite](https://vitejs.dev/)

## 安装与运行

### 前置要求

- Node.js (推荐 v16+)
- pnpm (推荐) 或 npm

### 安装依赖

```bash
npm install
# 或者
pnpm install
```

### 启动开发服务器

```bash
npm run dev
# 或者
pnpm dev
```

启动后，访问控制台输出的本地地址（通常是 `http://localhost:5173`）。

## 使用说明

1. **加载模型**：点击页面上的“选择文件”按钮，上传本地的 `.glb` 或 `.gltf` 文件。
2. **预览模型**：模型加载后会自动显示在 3D 场景中。
3. **导出模型**：点击下方的导出按钮选择所需的精度：
    - **存档级**：用于备份原始高质量数据。
    - **标准级**：用于一般的网页 3D 展示。
    - **预览级**：用于缩略图或低带宽环境。
4. **下载**：处理完成后，浏览器会自动下载优化后的 `.glb` 文件。

## 目录结构

```
├── src/
│   ├── main.js                 # 主程序入口，UI 与 Three.js 场景逻辑
│   ├── GlbExporter.js   # 导出管理器，协调 Worker
│   └── gltf-optimizer.worker.js # 核心优化逻辑（运行在 Worker 中）
├── public/                     # 静态资源（如 Draco 解码器）
├── index.html                  # 页面入口
└── package.json                # 项目配置
```

## 注意事项

- 首次运行时，程序会从 CDN 或本地加载 Draco 解码器，请确保网络通畅或 `public/draco` 目录配置正确。
- 极大的模型可能会消耗较多内存，建议在桌面端浏览器运行。
