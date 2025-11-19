import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// 定义工业级导出参数预设
const EXPORT_PRESETS = {
    // 存档级：几乎无损，仅做数据去重和清理
    ARCHIVE: {
        simplifyRatio: 0,
        maxTextureSize: 4096,
        useDraco: false
    },
    // 标准级：平衡质量和体积，适合一般 Web 展示
    STANDARD: {
        simplifyRatio: 0.2, // 减面 20%
        maxTextureSize: 2048,
        useDraco: true
    },
    // 预览级：极致压缩，适合移动端查看
    PREVIEW: {
        simplifyRatio: 0.7, // 减面 70%
        maxTextureSize: 1024,
        useDraco: true
    }
};

export class IndustrialExporter {
    constructor() {
        this.worker = new Worker(new URL('./gltf-optimizer.worker.js', import.meta.url), { type: 'module' });
        this.exporter = new GLTFExporter();
    }

    /**
     * 导出模型
     * @param {THREE.Object3D} object3d - 要导出的对象
     * @param {string} filename - 文件名
     * @param {'ARCHIVE'|'STANDARD'|'PREVIEW'} presetKey - 预设 Key
     */
    async export(object3d, filename, presetKey = 'STANDARD') {
        const config = EXPORT_PRESETS[presetKey];
        
        console.time('Total Export Time');
        
        // 1. 第一阶段：Three.js 序列化 (主线程)
        // 我们这里导出 binary: true，但不做 draco，把繁重工作留给 worker
        const rawBuffer = await this.serializeFromThree(object3d);
        
        console.log(`原始数据大小: ${(rawBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

        // 2. 第二阶段：Worker 优化 (后台线程)
        const optimizedBuffer = await this.processInWorker(rawBuffer, config);

        console.log(`优化后大小: ${(optimizedBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
        console.timeEnd('Total Export Time');

        // 3. 下载
        this.download(optimizedBuffer, `${filename}_${presetKey}.glb`);
    }

    serializeFromThree(object3d) {
        return new Promise((resolve, reject) => {
            this.exporter.parse(
                object3d,
                (result) => resolve(result),
                (err) => reject(err),
                { binary: true, onlyVisible: true } // 基础配置
            );
        });
    }

    processInWorker(buffer, config) {
        return new Promise((resolve, reject) => {
            this.worker.onmessage = (e) => {
                if (e.data.error) {
                    reject(e.data.error);
                } else {
                    resolve(e.data.buffer);
                }
            };
            this.worker.onerror = (err) => reject(err);

            // 发送数据给 Worker，使用 Transferable 转移所有权，极大提升性能
            this.worker.postMessage({ buffer, config }, [buffer]);
        });
    }

    download(buffer, filename) {
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}