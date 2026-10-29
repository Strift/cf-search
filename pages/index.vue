<script setup lang="ts">
import type { Props } from "./index.server";
import { useNavigation, useRouter } from "@void/vue";
import { ref, watch } from "vue";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MTGCard from "@/components/mtg/Card.vue";
import { ALL_SETS, DEFAULT_SORTING, SORT_OPTIONS, type Sorting } from "@/lib/search";

const props = defineProps<Props>();
const router = useRouter();
const navigation = useNavigation();

const query = ref(props.q);
const sort = ref<Sorting>(props.sort);
const set = ref(props.set || ALL_SETS);

// Browser-side timing of the last navigation, in milliseconds.
const roundtrip = ref<{ total: number; network: number } | null>(null);

function searchUrl() {
  const params = new URLSearchParams();
  const q = query.value.trim();
  if (q) params.set("q", q);
  if (sort.value !== DEFAULT_SORTING) params.set("sort", sort.value);
  if (set.value !== ALL_SETS) params.set("set", set.value);
  const search = params.toString();
  return search ? `/?${search}` : "/";
}

async function search() {
  const url = searchUrl();
  if (
    url ===
    `${navigation.location?.pathname ?? window.location.pathname}${navigation.location?.search ?? window.location.search}`
  )
    return;
  const start = performance.now();
  await router.visit(url, { replace: true, preserveState: true, preserveScroll: true });
  const total = Math.round(performance.now() - start);
  roundtrip.value = { total, network: Math.max(0, total - props.trace.server) };
}

let debounce: ReturnType<typeof setTimeout> | undefined;
watch(query, () => {
  clearTimeout(debounce);
  debounce = setTimeout(search, 250);
});
watch([sort, set], () => {
  clearTimeout(debounce);
  void search();
});

// Keep the controls in sync when the URL changes without them (back/forward).
watch(
  () => [props.q, props.sort, props.set] as const,
  ([q, s, st]) => {
    if (q !== query.value.trim()) query.value = q;
    sort.value = s;
    set.value = st || ALL_SETS;
  },
);
</script>

<template>
  <header class="flex flex-col gap-4">
    <div class="flex items-baseline justify-between gap-4">
      <h1 class="text-2xl font-semibold tracking-tight">Card search</h1>
      <a href="/chat" class="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >Rules chat</a
      >
    </div>
    <Input
      v-model="query"
      type="search"
      placeholder="Search cards by name"
      autofocus
      aria-label="Search cards by name"
      class="h-11 text-base md:text-base"
    />
    <div class="flex flex-wrap items-center gap-4">
      <Select v-model="set">
        <SelectTrigger class="w-70" aria-label="Set">
          <SelectValue placeholder="Set" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem :value="ALL_SETS">All sets</SelectItem>
          <SelectItem v-for="option in sets" :key="option.code" :value="option.code">
            {{ option.name }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="sort">
        <SelectTrigger class="ml-auto w-45" aria-label="Sort by">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
    <p class="text-muted-foreground font-mono text-xs" data-testid="trace">
      <template v-if="roundtrip"
        >Roundtrip {{ roundtrip.total }} ms · network {{ roundtrip.network }} ms ·
      </template>
      server {{ trace.server }} ms (search {{ trace.search }} ms, sets {{ trace.sets }} ms)
    </p>
  </header>

  <p v-if="cards.length === 0 && navigation.state === 'idle'" class="text-muted-foreground text-sm">
    No cards match<template v-if="q"> "{{ q }}"</template>.
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
