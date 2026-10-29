<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "cn";
import { Primitive } from "reka-ui";
import { buttonVariants } from ".";

// Props declared inline: Void's SSR runner cannot resolve prop types imported
// from other modules (see the Select components).
const props = withDefaults(
  defineProps<{
    as?: string;
    asChild?: boolean;
    variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
    size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
    class?: HTMLAttributes["class"];
  }>(),
  { as: "button" },
);
</script>

<template>
  <Primitive
    data-slot="button"
    :data-variant="variant"
    :data-size="size"
    :as="as"
    :as-child="asChild"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <slot />
  </Primitive>
</template>
