<script setup lang="ts">
import type { Props } from "./index.server";
import { useNavigation, useRouter } from "@void/vue";
import { ref, watch } from "vue";
import { Input } from "@/components/ui/input";
import MTGCard from "@/components/mtg/Card.vue";

const props = defineProps<Props>();
const router = useRouter();
const navigation = useNavigation();

const query = ref(props.q);
let debounce: ReturnType<typeof setTimeout> | undefined;

watch(query, (value) => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    const q = value.trim();
    if (q === props.q) return;
    router.visit(q ? `/?q=${encodeURIComponent(q)}` : "/", {
      replace: true,
      preserveState: true,
      preserveScroll: true,
    });
  }, 250);
});
</script>

<template>
  <header class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold tracking-tight">Card search</h1>
    <Input
      v-model="query"
      type="search"
      placeholder="Search cards by name"
      autofocus
      aria-label="Search cards by name"
      class="h-11 text-base md:text-base"
    />
  </header>

  <p v-if="!q" class="text-muted-foreground text-sm">Type a card name to search.</p>
  <p
    v-else-if="cards.length === 0 && navigation.state === 'idle'"
    class="text-muted-foreground text-sm"
  >
    No cards match "{{ q }}".
  </p>
  <section v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
    <MTGCard
      v-for="card in cards"
      :key="card.oracleId"
      :name="card.name"
      :image-url="card.imageUrl ?? ''"
    />
  </section>
</template>
