<template>
  <el-dialog
    v-model="visible"
    title="导出 GLB 模型"
    width="500px"
    :close-on-click-modal="false"
    class="export-dialog"
    align-center
  >
    <div class="section-title">选择精度级别</div>
    
    <div 
      class="option-card" 
      :class="{ selected: precision === 'high' }"
      @click="precision = 'high'"
    >
      <div class="card-header">
        <el-radio v-model="precision" label="high" class="custom-radio">
          <span class="option-title">高精度 (High)</span>
          <el-tag type="danger" size="small" effect="light" class="option-tag">最大文件</el-tag>
        </el-radio>
      </div>
      <p class="option-desc">保留原始细节，适用于存档或高端渲染。</p>
    </div>

    <div 
      class="option-card" 
      :class="{ selected: precision === 'balanced' }"
      @click="precision = 'balanced'"
    >
      <div class="card-header">
        <el-radio v-model="precision" label="balanced" class="custom-radio">
          <span class="option-title">中等 (Balanced)</span>
          <el-tag type="primary" size="small" effect="light" class="option-tag">推荐</el-tag>
        </el-radio>
      </div>
      <p class="option-desc">质量与体积的最佳平衡。</p>
    </div>

    <div 
      class="option-card" 
      :class="{ selected: precision === 'low' }"
      @click="precision = 'low'"
    >
      <div class="card-header">
        <el-radio v-model="precision" label="low" class="custom-radio">
          <span class="option-title">低精度 (Low)</span>
          <el-tag type="success" size="small" effect="light" class="option-tag">Web优化</el-tag>
        </el-radio>
      </div>
      <p class="option-desc">简化网格以减小体积，适合网络传输。</p>
    </div>

    <div class="filename-section">
      <div class="section-title">输出文件名</div>
      <el-input v-model="filename" placeholder="请输入文件名">
        <template #append>.glb</template>
      </el-input>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="handleExport">确认导出</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, defineExpose, defineEmits } from 'vue'

const visible = ref(false)
const precision = ref('high')
const filename = ref('model_export')

const emit = defineEmits(['export'])

const show = () => {
  visible.value = true
}

const handleExport = () => {
  emit('export', {
    precision: precision.value,
    filename: filename.value
  })
  visible.value = false
}

defineExpose({ show })
</script>

<style scoped>
.section-title {
  font-size: 14px;
  color: #606266;
  margin-bottom: 12px;
  font-weight: 500;
}

.option-card {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.option-card:hover {
  border-color: #c0c4cc;
}

.option-card.selected {
  border-color: #409eff;
  background-color: #ecf5ff;
  box-shadow: 0 0 0 1px #409eff inset;
}

.card-header {
  display: flex;
  align-items: center;
}

.custom-radio {
  height: auto;
  margin-right: 0;
  width: 100%;
}

.custom-radio :deep(.el-radio__label) {
  display: flex;
  align-items: center;
  width: 100%;
}

.option-title {
  font-weight: 600;
  font-size: 15px;
  color: #303133;
  margin-right: 8px;
}

.option-tag {
  margin-left: 4px;
}

.option-desc {
  margin: 4px 0 0 28px;
  font-size: 13px;
  color: #909399;
  line-height: 1.4;
}

.filename-section {
  margin-top: 24px;
}
</style>
