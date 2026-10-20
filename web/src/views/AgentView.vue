<script setup lang="ts">
import { AISDKThreads } from "@assistant-ui/ai-sdk";
import { Suggestions } from "@assistant-ui/core/store";
import { AuiConfig, AuiProvider } from "@assistant-ui/vue";
import ThreadList from "../components/assistant-ui/thread-list.vue";
import Thread from "../components/assistant-ui/thread.vue";

// 组合方式照抄 examples/with-nuxt/app/components/Assistant.client.vue，只是换成 Vite 的页面
const suggestions = Suggestions([
  {
    title: "现在有哪些客房在线？",
    label: "实时状态",
    prompt: "现在有哪些客房在线？各是什么状态？",
  },
  {
    title: "哪间房最费电？",
    label: "跟其他入住比",
    prompt: "最近哪间房最费电？跟店里其他入住比是什么水平？",
  },
  {
    title: "301 的用电怎么回事",
    label: "看单间明细",
    prompt: "301 这间房的用电情况怎么样？",
  },
]);

const config = AuiConfig({ threads: AISDKThreads(), suggestions });
</script>

<template>
  <AuiProvider :config="config">
    <div
      class="border-border bg-card relative flex h-[calc(100vh-9.5rem)] overflow-hidden rounded-xl border lg:h-[calc(100vh-4.25rem)]"
    >
      <aside
        class="border-border bg-background hidden w-60 shrink-0 flex-col overflow-y-auto border-r p-2 md:flex"
      >
        <ThreadList />
      </aside>
      <Thread class="min-w-0 flex-1" />
    </div>
  </AuiProvider>
</template>
