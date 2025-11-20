import { WebIO } from '@gltf-transform/core';
import {
    prune, dedup, resample, textureCompress, draco, simplify, quantize, weld, join, palette
} from '@gltf-transform/functions';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3d';

// Polyfill for DOM environment in Worker (required for texture processing/palette)
if (typeof self.document === 'undefined') {
    self.document = {
        createElement: (tagName) => {
            if (tagName === 'canvas' && typeof OffscreenCanvas !== 'undefined') {
                const canvas = new OffscreenCanvas(1, 1);
                canvas.style = {}; // Mock style
                // Polyfill toBlob for OffscreenCanvas
                canvas.toBlob = function (callback, type, quality) {
                    this.convertToBlob({ type, quality }).then(callback);
                };
                return canvas;
            }
            return {};
        }
    };
}
if (typeof self.window === 'undefined') {
    self.window = self;
}
if (typeof self.HTMLCanvasElement === 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    self.HTMLCanvasElement = OffscreenCanvas;
}

// 初始化 IO
const io = new WebIO();

// 注册扩展
io.registerExtensions([KHRDracoMeshCompression]);
// 设置 Draco 依赖
io.registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule({ wasmBinary: await fetch('/draco/draco_decoder.wasm').then(res => res.arrayBuffer()) }),
    'draco3d.encoder': await draco3d.createEncoderModule({ wasmBinary: await fetch('/draco/draco_encoder.wasm').then(res => res.arrayBuffer()) }),
});

self.onmessage = async (e) => {
    const { buffer, config } = e.data;

    try {
        console.log('[Worker] Received config:', config);

        // 1. 读取原始 GLB
        const document = await io.readBinary(new Uint8Array(buffer));

        const root = document.getRoot();
        const originalMeshCount = root.listMeshes().length;
        const originalVertexCount = root.listMeshes().reduce((acc, mesh) => {
            return acc + mesh.listPrimitives().reduce((pAcc, prim) => {
                const pos = prim.getAttribute('POSITION');
                return pAcc + (pos ? pos.getCount() : 0);
            }, 0);
        }, 0);
        console.log(`[Worker] Original: ${originalMeshCount} meshes, ${originalVertexCount} vertices`);

        // 2. 构建处理链 (根据配置)
        const transforms = [];

        // A. 几何清理 (焊接顶点，去除孤立点，这对减面至关重要)
        transforms.push(weld({ tolerance: 0.0001 }));

        // A2. 材质合并 (Palette) & 网格合并 (Join)
        // 如果开启了 join，先运行 palette 将材质合并，这样 join 才能合并不同材质的网格
        if (config.join) {
            console.log('[Worker] Applying palette (merging materials)');
            transforms.push(palette({ min: 5 })); // 合并材质

            console.log('[Worker] Applying join (merging meshes)');
            transforms.push(join());
        }

        // B. 几何减面 (Simplification) - 核心步骤
        // 工业级方案使用 Meshopt Simplifier，保持拓扑结构更好
        if (config.simplifyRatio > 0) {
            await MeshoptSimplifier.ready; // 必须等待初始化
            console.log(`[Worker] Applying simplify: ratio=${config.simplifyRatio}, error=${config.simplifyError}`);
            transforms.push(simplify({
                simplifier: MeshoptSimplifier,
                ratio: config.simplifyRatio,
                error: config.simplifyError || 0.001
            }));
        }

        // C. 纹理重采样 (Resizing)
        if (config.maxTextureSize < 4096) {
            console.log(`[Worker] Applying resample: maxTextureSize=${config.maxTextureSize}`);
            transforms.push(resample({ ready: true, width: config.maxTextureSize, height: config.maxTextureSize }));
        }

        // D. 纹理转换/压缩 (转为 WebP 或只是压缩体积)
        // transforms.push(textureCompress({ targetFormat: 'webp', quality: 80 }));

        // E. 清理未使用的节点、材质
        transforms.push(prune());
        transforms.push(dedup());

        // F. 数据压缩 (Draco & Quantization)
        if (config.useDraco) {
            console.log(`[Worker] Applying Draco: bits=${JSON.stringify(config.quantizationBits)}`);
            // Draco 压缩
            transforms.push(draco({
                method: 'edgebreaker',
                quantizationVolume: 'high',
                quantizationBits: config.quantizationBits || {
                    POSITION: 14,
                    NORMAL: 10,
                    TEXCOORD: 12,
                    COLOR: 8,
                    GENERIC: 12,
                }
            }));
        }

        // 3. 执行所有变换
        await document.transform(...transforms);

        const finalVertexCount = root.listMeshes().reduce((acc, mesh) => {
            return acc + mesh.listPrimitives().reduce((pAcc, prim) => {
                const pos = prim.getAttribute('POSITION');
                return pAcc + (pos ? pos.getCount() : 0);
            }, 0);
        }, 0);
        console.log(`[Worker] Final: ${finalVertexCount} vertices`);

        // 4. 导出处理后的 GLB
        const outputBuffer = await io.writeBinary(document);

        // 5. 传回主线程 (使用 Transferable Objects 避免拷贝)
        self.postMessage({ buffer: outputBuffer }, [outputBuffer.buffer]);

    } catch (error) {
        console.error('[Worker] Error:', error);
        self.postMessage({ error: error.message });
    }
};