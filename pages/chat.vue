<script setup lang="ts">
import { useChat } from "@ai-sdk/vue";
import { DefaultChatTransport, type UIMessage } from "ai";
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MTGCard from "@/components/mtg/Card.vue";

const { messages, sendMessage, status, error } = useChat({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
});

const input = ref("");
const showSources = ref(true);
const busy = computed(() => status.value === "submitted" || status.value === "streaming");

function submit() {
  const text = input.value.trim();
  if (!text || busy.value) return;
  input.value = "";
  void sendMessage({ text });
}

type Part = UIMessage["parts"][number];
type ToolPart = Extract<Part, { state: string }> & { type: `tool-${string}` };
type GlossaryHit = { term: string; definition: string };
type RuleHit = { rule_id: string; rule_text: string; rule_path?: string };
type CardFace = {
  name: string;
  mana_cost?: string;
  type_line: string;
  oracle_text?: string;
  image_uris?: { normal: string };
};
type CardHit = CardFace & { oracle_id: string; card_faces?: CardFace[] };
type SourceGroup = {
  id: string;
  label: string;
  glossary: GlossaryHit[];
  rules: RuleHit[];
  cards: CardHit[];
};

function isToolPart(part: Part): part is ToolPart {
  return part.type.startsWith("tool-") && "state" in part;
}

function toolCall(part: ToolPart): string {
  const name = part.type.slice("tool-".length);
  const input = part.input as { q?: string; ruleId?: string } | undefined;
  return `${name}("${input?.q ?? input?.ruleId ?? ""}")`;
}

function cardImage(card: CardHit): string | undefined {
  return card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
}

function cardFaces(card: CardHit): CardFace[] {
  return card.card_faces?.length ? card.card_faces : [card];
}

function toolHits(part: ToolPart): unknown[] {
  const output = part.output as { hits?: unknown[] } | undefined;
  return output?.hits ?? [];
}

function toolLabel(part: ToolPart): string {
  const call = toolCall(part);
  if (part.state === "output-error") return `${call} · failed`;
  if (part.state !== "output-available") return `${call} · searching…`;
  return `${call} · ${toolHits(part).length} hits`;
}

// Every document the agent retrieved, grouped by tool call. A document that
// came back from several calls is listed under the first one only.
const sources = computed<SourceGroup[]>(() => {
  const seen = new Set<string>();
  const groups: SourceGroup[] = [];
  for (const message of messages.value) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (!isToolPart(part) || part.state !== "output-available") continue;
      const group: SourceGroup = {
        id: part.toolCallId,
        label: toolCall(part),
        glossary: [],
        rules: [],
        cards: [],
      };
      for (const hit of toolHits(part)) {
        if (part.type === "tool-searchGlossary") {
          const { term, definition } = hit as GlossaryHit;
          if (!seen.has(`g:${term}`)) {
            seen.add(`g:${term}`);
            group.glossary.push({ term, definition });
          }
        } else if (part.type === "tool-searchCards") {
          const card = hit as CardHit;
          if (!seen.has(`c:${card.oracle_id}`)) {
            seen.add(`c:${card.oracle_id}`);
            group.cards.push(card);
          }
        } else {
          const rule = hit as RuleHit;
          if (!seen.has(`r:${rule.rule_id}`)) {
            seen.add(`r:${rule.rule_id}`);
            group.rules.push(rule);
          }
        }
      }
      if (group.glossary.length || group.rules.length || group.cards.length) groups.push(group);
    }
  }
  return groups;
});
const sourceCount = computed(() =>
  sources.value.reduce((n, g) => n + g.glossary.length + g.rules.length + g.cards.length, 0),
);
</script>

<template>
  <header class="flex items-baseline justify-between gap-4">
    <h1 class="text-2xl font-semibold tracking-tight">Rules chat</h1>
    <a href="/" class="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >Card search</a
    >
  </header>

  <div class="flex flex-1 flex-col gap-8 md:flex-row">
    <div class="flex min-w-0 flex-1 flex-col gap-6">
      <section class="flex flex-1 flex-col gap-6">
        <p v-if="messages.length === 0" class="text-muted-foreground">
          Ask a question about the Magic: The Gathering rules. Answers come from the Comprehensive
          Rules and the glossary.
        </p>

        <article v-for="message in messages" :key="message.id" class="flex flex-col gap-2">
          <div class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {{ message.role === "user" ? "You" : "Agent" }}
          </div>
          <template v-for="(part, index) in message.parts" :key="index">
            <p v-if="part.type === 'text'" class="whitespace-pre-wrap leading-relaxed">
              {{ part.text }}
            </p>
            <div v-else-if="isToolPart(part)" class="font-mono text-xs text-muted-foreground">
              {{ toolLabel(part) }}
            </div>
          </template>
        </article>

        <p v-if="busy && messages.at(-1)?.role === 'user'" class="text-sm text-muted-foreground">
          Thinking…
        </p>
        <p v-if="error" class="text-sm text-destructive">
          Something went wrong. Send your question again.
        </p>
      </section>

      <form class="sticky bottom-0 flex gap-2 bg-background py-4" @submit.prevent="submit">
        <Input
          v-model="input"
          placeholder="How can a player lose in Magic?"
          autofocus
          aria-label="Your question"
          class="h-11 text-base md:text-base"
        />
        <Button type="submit" class="h-11" :disabled="busy || !input.trim()">Send</Button>
      </form>
    </div>

    <aside class="flex flex-col gap-3 md:w-80 md:shrink-0" :class="showSources ? '' : 'md:w-auto'">
      <Button
        variant="outline"
        size="sm"
        class="self-start"
        :aria-expanded="showSources"
        aria-controls="sources"
        @click="showSources = !showSources"
      >
        {{ showSources ? "Hide sources" : "Show sources" }} ({{ sourceCount }})
      </Button>
      <div v-if="showSources" id="sources" class="flex flex-col gap-5 text-sm">
        <p v-if="sources.length === 0" class="text-muted-foreground">
          Documents the agent retrieves will show up here.
        </p>
        <section v-for="group in sources" :key="group.id" class="flex flex-col gap-2">
          <h2 class="font-mono text-xs text-muted-foreground">{{ group.label }}</h2>
          <div v-for="hit in group.glossary" :key="hit.term" class="rounded-md border p-3">
            <div class="font-medium">{{ hit.term }}</div>
            <p class="mt-1 text-muted-foreground">{{ hit.definition }}</p>
          </div>
          <div
            v-for="card in group.cards"
            :key="card.oracle_id"
            class="flex gap-3 rounded-md border p-3"
          >
            <div v-if="cardImage(card)" class="w-20 shrink-0">
              <MTGCard :name="card.name" :image-url="cardImage(card)!" />
            </div>
            <div class="flex min-w-0 flex-col gap-2">
              <div v-for="face in cardFaces(card)" :key="face.name">
                <div class="font-medium">
                  {{ face.name }}
                  <span class="font-normal text-muted-foreground">{{ face.mana_cost }}</span>
                </div>
                <div class="text-xs text-muted-foreground">{{ face.type_line }}</div>
                <p v-if="face.oracle_text" class="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {{ face.oracle_text }}
                </p>
              </div>
            </div>
          </div>
          <div v-for="hit in group.rules" :key="hit.rule_id" class="rounded-md border p-3">
            <div class="font-mono text-xs font-medium">{{ hit.rule_id }}</div>
            <p class="mt-1 whitespace-pre-wrap text-muted-foreground">{{ hit.rule_text }}</p>
            <div v-if="hit.rule_path" class="mt-1 text-xs text-muted-foreground/70">
              {{ hit.rule_path }}
            </div>
          </div>
        </section>
      </div>
    </aside>
  </div>
</template>
