import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as Icons from '@element-plus/icons-vue';
import App from './App.vue';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GlbExporter } from './GlbExporter.js';

// --- Three.js Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// Append to body, but ensure it's behind the #app overlay
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.zIndex = '-1';
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const group = new THREE.Group();
const material = new THREE.MeshStandardMaterial({
    color: 0x007bff,
    roughness: 0.5,
    metalness: 0.1
});

function createDefaultScene() {
    group.clear();
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
}
createDefaultScene();
scene.add(group);

function animate() {
    requestAnimationFrame(animate);
    group.rotation.x += 0.002;
    group.rotation.y += 0.002;
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Service Logic ---
const exporter = new GlbExporter();
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
loader.setDRACOLoader(dracoLoader);

const threeService = {
    loadModel(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            loader.load(
                url,
                (gltf) => {
                    group.clear();
                    const box = new THREE.Box3().setFromObject(gltf.scene);
                    const size = box.getSize(new THREE.Vector3());
                    const center = box.getCenter(new THREE.Vector3());

                    gltf.scene.position.x += (gltf.scene.position.x - center.x);
                    gltf.scene.position.y += (gltf.scene.position.y - center.y);
                    gltf.scene.position.z += (gltf.scene.position.z - center.z);

                    const maxDim = Math.max(size.x, size.y, size.z);
                    if (maxDim > 0) {
                        const scale = 40 / maxDim;
                        gltf.scene.scale.multiplyScalar(scale);
                    }

                    group.add(gltf.scene);
                    URL.revokeObjectURL(url);
                    resolve();
                },
                undefined,
                (error) => {
                    URL.revokeObjectURL(url);
                    reject(error);
                }
            );
        });
    },
    exportModel(preset, filename) {
        return exporter.export(scene, filename || 'model_export', preset);
    }
};

// --- Vue App Setup ---
const app = createApp(App);
app.use(ElementPlus);
for (const [key, component] of Object.entries(Icons)) {
    app.component(key, component);
}
app.provide('threeService', threeService);
app.mount('#app');