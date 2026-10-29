<script setup lang="ts">
import type { Props } from "./index.server";
import { useNavigation, useRouter } from "@void/vue";
import { ref, watch } from "vue";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card v-for="card in cards" :key="card.oracleId" size="sm">
      <img
        v-if="card.imageUrl"
        :src="card.imageUrl"
        :alt="card.name"
        loading="lazy"
        class="aspect-[488/680] w-full object-cover"
      />
      <CardHeader>
        <CardTitle>{{ card.name }}</CardTitle>
        <CardDescription>
          {{ card.typeLine }}<template v-if="card.manaCost"> · {{ card.manaCost }}</template>
        </CardDescription>
      </CardHeader>
    </Card>
  </section>
</template>
