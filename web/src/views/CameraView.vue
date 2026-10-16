<script setup lang="ts">
import PageHeader from "../components/PageHeader.vue";
import StatusTag from "../components/StatusTag.vue";

const stream = "/api/cv/stream";
</script>

<template>
  <PageHeader>
    <StatusTag />
  </PageHeader>

  <div class="card frame">
    <img :src="stream" alt="实时画面" />
  </div>
</template>

<style scoped>
.frame {
  padding: 12px;
}

img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: contain;
  background: var(--gray-soft);
  border-radius: 8px;
}
</style>
