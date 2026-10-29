<script setup lang="ts">
import "@/style.css";
import "@twicpics/components/style.css";
import TwicPics from "@twicpics/components/vue3";
import { getCurrentInstance } from "vue";

// Void builds the Vue app itself and exposes no plugin hook, so the TwicPics
// plugin is registered on the running app here. `app.use` ignores repeats.
getCurrentInstance()?.appContext.app.use(TwicPics, { domain: "https://strift.twic.pics" });
</script>

<template>
  <main class="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-10">
    <slot />
  </main>
</template>
