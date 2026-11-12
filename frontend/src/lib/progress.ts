import type { VocabularyCategory, VocabularySummary } from "../api/types.ts";
import { VOCABULARY_CATEGORIES, vocabularyCategoryLabel } from "../i18n/vocabularyCategory.ts";

/** One HSK level's coverage, joined with how many queued words sit at it. */
export interface HskCoverageRow {
  level: number;
  known: number;
  coverage: number;
}

/**
 * The Progresso coverage rows. The aggregate keys coverage by level; join it with
 * the known-word counts and order the levels numerically. No HSK totals in the
 * dictionary means no rows — the panel then shows its own empty state instead of
 * a misleading zero.
 */
export function hskCoverageRows(summary: VocabularySummary): HskCoverageRow[] {
  return Object.entries(summary.proficiency.coverage_by_level)
    .map(([key, coverage]) => ({ level: Number(key), coverage }))
    .filter((row) => Number.isInteger(row.level) && row.level > 0)
    .sort((a, b) => a.level - b.level)
    .map((row) => ({
      level: row.level,
      known: summary.by_hsk_level[String(row.level)] ?? 0,
      coverage: row.coverage,
    }));
}

/** `HSK 3` for a mastered level, `Iniciante` for the zero estimate. */
export function estimatedLevelLabel(level: number): string {
  return level > 0 ? `HSK ${level}` : "Iniciante";
}

/** One vocabulary class with its display label and membership count. */
export interface CategoryRow {
  category: VocabularyCategory;
  label: string;
  count: number;
}

/** The vocabulary classes that carry words, greatest first (ties by label). */
export function categoryRows(byCategory: Record<string, number>): CategoryRow[] {
  const known = new Set<string>(VOCABULARY_CATEGORIES);
  return Object.entries(byCategory)
    .filter(([category, count]) => count > 0 && known.has(category))
    .map(([category, count]) => ({
      category: category as VocabularyCategory,
      label: vocabularyCategoryLabel(category as VocabularyCategory),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}
