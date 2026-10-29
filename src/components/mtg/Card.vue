<script setup lang="ts">
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
    <img v-if="imageUrl" :src="imageUrl" :alt="name" loading="lazy" class="w-full" />
  </div>
</template>
