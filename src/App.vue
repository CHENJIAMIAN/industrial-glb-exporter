<template>
  <div class="ui-container">
    <div class="panel">
      <h2>GLB 导出测试</h2>
      <p>场景包含大量几何体，用于测试性能。</p>

      <div class="upload-wrapper">
        <input 
          type="file" 
          id="file-input" 
          accept=".glb,.gltf" 
          class="hidden-input"
          @change="handleFileChange"
        >
        <label for="file-input" class="custom-file-upload">
          <el-icon class="upload-icon"><FolderOpened /></el-icon>
          上传自定义 GLB
        </label>
        <span class="file-chosen">{{ fileName || '未选择文件' }}</span>
      </div>

      <el-button type="primary" class="main-btn" @click="openExportDialog">
        导出模型
      </el-button>

      <div class="status-text">{{ statusText }}</div>
    </div>

    <ExportDialog ref="exportDialogRef" @export="handleExportConfirm" />
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import { FolderOpened } from '@element-plus/icons-vue'
import ExportDialog from './components/ExportDialog.vue'

const exportDialogRef = ref(null)
const fileName = ref('')
const statusText = ref('就绪')

// Inject services provided by main.js
const threeService = inject('threeService')

const handleFileChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    fileName.value = file.name
    statusText.value = '正在加载模型...'
    threeService.loadModel(file)
      .then(() => {
        statusText.value = `模型加载成功: ${file.name}`
      })
      .catch((err) => {
        console.error(err)
        statusText.value = '模型加载失败'
      })
  }
}

const openExportDialog = () => {
  exportDialogRef.value.show()
}

const handleExportConfirm = async ({ precision, filename }) => {
  statusText.value = `正在导出 (${precision})...`
  try {
    // Map precision to preset name expected by exporter
    const presetMap = {
      high: 'ARCHIVE',
      balanced: 'STANDARD',
      low: 'PREVIEW'
    }
    const preset = presetMap[precision] || 'STANDARD'
    
    const result = await threeService.exportModel(preset, filename)
    statusText.value = `导出成功: ${result.originalSize}MB -> ${result.optimizedSize}MB`
  } catch (err) {
    console.error(err)
    statusText.value = `导出失败: ${err.message}`
  }
}
</script>

<style scoped>
.ui-container {
  position: absolute;
  top: 20px;
  left: 20px;
  width: 300px;
  pointer-events: none; /* Let clicks pass through to canvas by default */
}

.panel {
  background: rgba(255, 255, 255, 0.95);
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  pointer-events: auto; /* Re-enable clicks for the panel */
}

h2 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 20px;
  color: #333;
  font-weight: 600;
}

p {
  font-size: 13px;
  color: #666;
  margin-bottom: 20px;
  line-height: 1.5;
}

.upload-wrapper {
  margin-bottom: 20px;
  text-align: center;
}

.hidden-input {
  display: none;
}

.custom-file-upload {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 12px 0;
  cursor: pointer;
  background: linear-gradient(135deg, #6e8efb, #a777e3);
  color: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(110, 142, 251, 0.3);
  box-sizing: border-box;
}

.custom-file-upload:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(110, 142, 251, 0.4);
}

.upload-icon {
  margin-right: 8px;
  font-size: 16px;
}

.file-chosen {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.main-btn {
  width: 100%;
  padding: 20px 0; /* Taller button */
  font-weight: 500;
}

.status-text {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #eee;
  font-size: 13px;
  color: #555;
  text-align: center;
}
</style>
