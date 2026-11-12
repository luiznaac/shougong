// The Add/Import workspace's densities and paging arithmetic. Dictionary search
// is five server rows per page on both presentations; CSV results are paged
// client-side twelve rows at a time.

import { type ItemPageRequest, pageOffset } from "./pagination.ts";
import type { Presentation } from "./useMediaQuery.ts";

export const DICTIONARY_PAGE_SIZE = 5;
export const CSV_RESULT_PAGE_SIZE = 12;

/**
 * The dictionary pages one presentation needs: desktop one numbered server page,
 * mobile every five-row page shown so far behind "Carregar mais".
 */
export function dictionaryPageRequests(
  presentation: Presentation,
  page: number,
  shown: number,
): ItemPageRequest[] {
  if (presentation === "desktop") {
    return [{ limit: DICTIONARY_PAGE_SIZE, offset: pageOffset(page, DICTIONARY_PAGE_SIZE) }];
  }
  const pages = Math.max(1, Math.ceil(shown / DICTIONARY_PAGE_SIZE));
  return Array.from({ length: pages }, (_, index) => ({
    limit: DICTIONARY_PAGE_SIZE,
    offset: index * DICTIONARY_PAGE_SIZE,
  }));
}

/** The honest shown count for the dictionary caption. */
export function dictionaryShown(
  presentation: Presentation,
  page: number,
  rowCount: number,
): number {
  return presentation === "desktop" ? pageOffset(page, DICTIONARY_PAGE_SIZE) + rowCount : rowCount;
}
