import { WebIO } from '@gltf-transform/core';
import { 
    prune, dedup, resample, textureCompress, draco, simplify, quantize, weld 
} from '@gltf-transform/functions';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3d'; 

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
        // 1. 读取原始 GLB
        const document = await io.readBinary(new Uint8Array(buffer));

        // 2. 构建处理链 (根据配置)
        const transforms = [];

        // A. 几何清理 (焊接顶点，去除孤立点，这对减面至关重要)
        transforms.push(weld({ tolerance: 0.0001 }));

        // B. 几何减面 (Simplification) - 核心步骤
        // 工业级方案使用 Meshopt Simplifier，保持拓扑结构更好
        if (config.simplifyRatio > 0) {
            transforms.push(simplify({ 
                simplifier: MeshoptSimplifier, 
                ratio: config.simplifyRatio, // 0.5 = 减少50%
                error: 0.001 // 允许的几何误差阈值
            }));
        }

        // C. 纹理重采样 (Resizing)
        if (config.maxTextureSize < 4096) {
            transforms.push(resample({ ready: true, width: config.maxTextureSize, height: config.maxTextureSize }));
        }
        
        // D. 纹理转换/压缩 (转为 WebP 或只是压缩体积)
        // 这里示例使用简单的格式转换，如果需要 KTX2 需要引入 KTX 编码器，体积较大
        // 这里假设我们将纹理转为 WebP 以节省体积
        // transforms.push(textureCompress({ targetFormat: 'webp', quality: 80 }));

        // E. 清理未使用的节点、材质
        transforms.push(prune());
        transforms.push(dedup());

        // F. 数据压缩 (Draco & Quantization)
        if (config.useDraco) {
            // 量化：将32位浮点数转为16位或更低，大幅减少体积
            transforms.push(quantize({
                pattern: /^(POSITION|NORMAL|TEXCOORD|COLOR)_\d+$/
            }));
            
            // Draco 压缩
            transforms.push(draco({
                method: 'edgebreaker',
                quantizationVolume: 'high',
                quantizationBits: {
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

        // 4. 导出处理后的 GLB
        const outputBuffer = await io.writeBinary(document);

        // 5. 传回主线程 (使用 Transferable Objects 避免拷贝)
        self.postMessage({ buffer: outputBuffer }, [outputBuffer.buffer]);

    } catch (error) {
        self.postMessage({ error: error.message });
    }
};