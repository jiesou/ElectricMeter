<script setup lang="ts">
import { role, type Role } from "../data.ts";

const ROLES: Role[] = ["访客", "保洁", "管理"];
</script>

<template>
  <div class="roles">
    <button
      v-for="r in ROLES"
      :key="r"
      class="role"
      :class="{ on: role === r }"
      @click="role = r"
    >
      {{ r }}
    </button>
  </div>
</template>

<style scoped>
.roles {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--gray-soft);
  border-radius: 8px;
}

.role {
  height: 28px;
  padding: 0 10px;
  font-size: 13px;
  color: var(--muted);
  background: none;
  border: none;
  border-radius: 6px;
}

.role.on {
  color: var(--primary);
  background: var(--primary-soft);
}
</style>
