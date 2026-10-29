<script setup lang="ts">
import { twicpicsUrl } from "@/utils/image";

export interface MTGCardProps {
  name: string;
  imageUrl: string;
}

defineProps<MTGCardProps>();
</script>

<template>
  <div
    class="relative aspect-63/88 overflow-hidden rounded-lg shadow-lg transition-transform duration-200 hover:scale-105 active:scale-95"
  >
    <TwicImg
      v-if="imageUrl"
      :src="twicpicsUrl(imageUrl)"
      :alt="name"
      ratio="5/7"
      mode="contain"
      placeholder="preview"
      class="w-full"
    />
  </div>
</template>
