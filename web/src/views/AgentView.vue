<script setup lang="ts">
import { AISDKThreads } from "@assistant-ui/ai-sdk";
import { Suggestions } from "@assistant-ui/core/store";
import { AuiConfig, AuiProvider } from "@assistant-ui/vue";
import { computed, ref } from "vue";
import ThreadList from "../components/assistant-ui/thread-list.vue";
import Thread from "../components/assistant-ui/thread.vue";
import { mockTransport } from "../mock-agent.ts";

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
    label: "要连上真模型才答得出来",
    prompt: "301 这间房的用电情况怎么样？",
  },
]);

const real = AuiConfig({ threads: AISDKThreads(), suggestions });
const mock = AuiConfig({
  threads: AISDKThreads({ transport: () => mockTransport }),
  suggestions,
});

/** 演示模式：现场模型不通时，换成一段写死的流式，界面照样演 */
const demo = ref(false);
const config = computed(() => (demo.value ? mock : real));
</script>

<template>
  <AuiProvider :key="demo ? 'demo' : 'real'" :config="config">
    <div
      class="border-border bg-card relative flex h-[calc(100vh-9.5rem)] overflow-hidden rounded-xl border lg:h-[calc(100vh-4.25rem)]"
    >
      <button
        type="button"
        class="border-border hover:bg-muted absolute top-3 right-3 z-10 rounded-lg border px-2.5 py-1 text-xs"
        @click="demo = !demo"
      >
        {{ demo ? "退出演示" : "演示模式" }}
      </button>
      <aside
        class="border-border bg-background hidden w-60 shrink-0 flex-col overflow-y-auto border-r p-2 md:flex"
      >
        <ThreadList />
      </aside>
      <Thread class="min-w-0 flex-1" />
    </div>
  </AuiProvider>
</template>
