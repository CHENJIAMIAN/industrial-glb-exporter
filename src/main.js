import * as THREE from 'three';
import { IndustrialExporter } from './IndustrialExporter.js';

// 初始化场景
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 添加灯光
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// 创建复杂几何体 (模拟工业模型)
const group = new THREE.Group();
const material = new THREE.MeshStandardMaterial({ 
    color: 0x007bff, 
    roughness: 0.5,
    metalness: 0.1
});

// 生成大量球体以增加面数
const geometry = new THREE.SphereGeometry(1, 32, 32);
for (let i = 0; i < 500; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40
    );
    mesh.scale.setScalar(Math.random() * 2 + 0.5);
    group.add(mesh);
}
scene.add(group);

// 动画循环
function animate() {
    requestAnimationFrame(animate);
    group.rotation.x += 0.002;
    group.rotation.y += 0.002;
    renderer.render(scene, camera);
}
animate();

// 窗口大小调整
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 导出逻辑
const exporter = new IndustrialExporter();
const statusEl = document.getElementById('status');

async function handleExport(preset) {
    const btns = document.querySelectorAll('button');
    btns.forEach(b => b.disabled = true);
    statusEl.textContent = `正在导出 (${preset})... 请稍候`;

    try {
        await exporter.export(scene, 'industrial-model', preset);
        statusEl.textContent = `导出成功 (${preset})`;
    } catch (err) {
        console.error(err);
        statusEl.textContent = `导出失败: ${err.message}`;
    } finally {
        btns.forEach(b => b.disabled = false);
    }
}

document.getElementById('btn-archive').onclick = () => handleExport('ARCHIVE');
document.getElementById('btn-standard').onclick = () => handleExport('STANDARD');
document.getElementById('btn-preview').onclick = () => handleExport('PREVIEW');