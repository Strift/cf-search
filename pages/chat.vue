<script setup lang="ts">
import { useChat } from "@ai-sdk/vue";
import { DefaultChatTransport, type UIMessage } from "ai";
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const { messages, sendMessage, status, error } = useChat({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
});

const input = ref("");
const busy = computed(() => status.value === "submitted" || status.value === "streaming");

function submit() {
  const text = input.value.trim();
  if (!text || busy.value) return;
  input.value = "";
  void sendMessage({ text });
}

type Part = UIMessage["parts"][number];

function toolLabel(part: Part): string | null {
  if (!part.type.startsWith("tool-") || !("state" in part)) return null;
  const name = part.type.slice("tool-".length);
  const input = part.input as { q?: string; ruleId?: string } | undefined;
  const arg = input?.q ?? input?.ruleId ?? "";
  const call = `${name}("${arg}")`;
  if (part.state === "output-error") return `${call} · failed`;
  if (part.state !== "output-available") return `${call} · searching…`;
  const output = part.output as { hits?: unknown[] } | undefined;
  return `${call} · ${output?.hits?.length ?? 0} hits`;
}
</script>

<template>
  <header class="flex items-baseline justify-between gap-4">
    <h1 class="text-2xl font-semibold tracking-tight">Rules chat</h1>
    <a href="/" class="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >Card search</a
    >
  </header>

  <section class="flex flex-1 flex-col gap-6">
    <p v-if="messages.length === 0" class="text-muted-foreground">
      Ask a question about the Magic: The Gathering rules. Answers come from the Comprehensive Rules
      and the glossary.
    </p>

    <article v-for="message in messages" :key="message.id" class="flex flex-col gap-2">
      <div class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {{ message.role === "user" ? "You" : "Agent" }}
      </div>
      <template v-for="(part, index) in message.parts" :key="index">
        <p v-if="part.type === 'text'" class="whitespace-pre-wrap leading-relaxed">
          {{ part.text }}
        </p>
        <div v-else-if="toolLabel(part)" class="font-mono text-xs text-muted-foreground">
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
</template>
