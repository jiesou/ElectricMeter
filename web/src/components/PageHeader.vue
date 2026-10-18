<script setup lang="ts">
import NextDayButton from "./NextDayButton.vue";
import RoleSwitch from "./RoleSwitch.vue";
import StatusTag from "./StatusTag.vue";
</script>

<template>
  <header class="page-header">
    <h1>民宿智能用电管理系统</h1>
    <div class="tools">
      <RoleSwitch />
      <NextDayButton />
      <StatusTag />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

h1 {
  flex: 1 1 100%;
  font-size: 24px;
  font-weight: 700;
  text-align: center;
}

.tools {
  flex: 1 1 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* 宽屏左右各留一列等宽，标题正好居中在页面上，右侧那排贴右 */
@media (min-width: 640px) {
  .page-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
  }

  h1 {
    grid-column: 2;
    flex: none;
  }

  .tools {
    grid-column: 3;
    flex: none;
    justify-content: flex-end;
  }
}
</style>
