<script setup lang="ts">
defineProps<{ variant: "side" | "bottom" }>();
</script>

<template>
  <nav class="links" :class="`links--${variant}`" aria-label="主导航">
    <RouterLink class="link" to="/rooms">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h16M6 20V10l6-5 6 5v10M10 20v-5h4v5" fill="none" stroke="currentColor" stroke-width="1.8" />
      </svg>
      <span>客房用电</span>
    </RouterLink>
    <RouterLink class="link" to="/camera">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 7h11v10H3zM14 11l6-3v8l-6-3" fill="none" stroke="currentColor" stroke-width="1.8" />
      </svg>
      <span>视频监控</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.links {
  display: flex;
}

.icon {
  width: 22px;
  height: 22px;
}

.link {
  display: flex;
  align-items: center;
}

.link.router-link-active {
  color: var(--primary);
  background: var(--primary-soft);
}

/* 手机和平板：底部两个导航项，高 64px */
.links--bottom {
  height: 64px;
}

.links--bottom .link {
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  font-size: 14px;
}

/* 桌面：左侧竖排 */
.links--side {
  flex-direction: column;
  gap: 4px;
}

.links--side .link {
  gap: 12px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 16px;
}
</style>
