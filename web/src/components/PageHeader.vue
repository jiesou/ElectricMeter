<template>
  <header class="page-header">
    <h1>民宿智能用电管理系统</h1>
    <slot />
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

h1 {
  flex: 1;
  font-size: 24px;
  font-weight: 700;
  text-align: center;
}

/* 宽屏左右各留一列等宽，标题正好居中在页面上 */
@media (min-width: 640px) {
  .page-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
  }

  h1 {
    grid-column: 2;
  }

  :slotted(*) {
    grid-column: 3;
    justify-self: end;
  }
}
</style>
