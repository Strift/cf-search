// Same options and order as mtgbuilder.ai's CARD_SORT_OPTIONS.
export type Sorting = "relevance" | "release_date" | "cmc";

export const SORT_OPTIONS: { value: Sorting; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "release_date", label: "Release Date" },
  { value: "cmc", label: "Mana Cost" },
];

export const DEFAULT_SORTING: Sorting = "relevance";

export function parseSorting(value: string | undefined): Sorting {
  return SORT_OPTIONS.some((option) => option.value === value)
    ? (value as Sorting)
    : DEFAULT_SORTING;
}

// Sentinel for "no set filter"; must not collide with a Scryfall set code (e.g. `all` is Alliances).
export const ALL_SETS = "*";
