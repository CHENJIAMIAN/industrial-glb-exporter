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
│   ├── IndustrialExporter.js   # 导出管理器，协调 Worker
│   └── gltf-optimizer.worker.js # 核心优化逻辑（运行在 Worker 中）
├── public/                     # 静态资源（如 Draco 解码器）
├── index.html                  # 页面入口
└── package.json                # 项目配置
```

## 注意事项

- 首次运行时，程序会从 CDN 或本地加载 Draco 解码器，请确保网络通畅或 `public/draco` 目录配置正确。
- 极大的模型可能会消耗较多内存，建议在桌面端浏览器运行。
