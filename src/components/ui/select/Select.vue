<script setup lang="ts">
import { SelectRoot, useForwardPropsEmits } from "reka-ui";

const props = defineProps<{
  modelValue?: string;
  defaultValue?: string;
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  autocomplete?: string;
  dir?: "ltr" | "rtl";
}>();
const emits = defineEmits<{
  "update:modelValue": [value: string];
  "update:open": [value: boolean];
}>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <SelectRoot v-slot="slotProps" data-slot="select" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </SelectRoot>
</template>
