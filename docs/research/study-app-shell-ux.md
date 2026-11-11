---
source: "wayfinder ticket #106 — study-app shell and list UX"
branch: "research/study-app-shell-ux"
date: "2026-11-10"
---

# Study-app shell, list UX and visual language

Research for wayfinder ticket #106, feeding the shell prototype of the responsive SPA redesign (map #104). Two read-only readers surveyed primary sources first; community sources appear only where primary material was silent.

Scope note: map #104 explicitly drops accessibility from this effort. Accessibility observations are recorded here as research only and are not adopted as requirements.

## Shell and information architecture

**Anki (desktop)** has no rail or tab bar. It is one main window reached through the menu bar plus a top toolbar: Decks (the home screen with today counts), per-deck Study, Add, Browse, Stats, Sync. "Study Now" is an action on the deck overview after picking a deck, not a global shell button. Source: <https://docs.ankiweb.net/manual/studying.md>.

**AnkiMobile** keeps the same shell on a phone: the Deck List is home (not a tab bar), with help, Stats, Browse and Preferences along the top and Add/Export plus Synchronize at the bottom. Practice is a full-screen card where a tap exposes two to four answer buttons with their intervals. Sources: <https://docs.ankiweb.net/ankimobile/deck-list.md>, <https://docs.ankiweb.net/ankimobile/study-screen.md>.

**WaniKani (desktop)** organises the SPA under a global top navigation over Dashboard (today), Lessons, Reviews and the Radicals / Kanji / Vocabulary subject libraries, with a lesson picker/modal and zoom-in review screens. It is a responsive PWA with no separate mobile shell. Sources: <https://www.wanikani.com/>, <https://www.wanikani.com/vocabulary>.

**HanziHero** is a WaniKani-style web SRS built around components → mnemonics → SRS lessons/reviews across separate Traditional and Simplified tracks, plus a dictionary lookup surface. It is web-only; an offline app exists only on the roadmap. Sources: <https://hanzihero.com/>, <https://hanzihero.com/chinese-spaced-repetition-app>, <https://community.hanzihero.com/>.

**Bunpro** is a grammar SRS with a web app and official native apps. Its top-level areas are the Grammar Library, Reading Passages, Kana charts and Content Search, alongside a community forum. Sources: <https://bunpro.jp/>, <https://bunpro.jp/grammar_points>, <https://bunpro.jp/apps>.

**Duolingo (mobile)** uses a bottom tab bar: Learn (the path/home) is the do-now root, Leaderboards is confirmed as a tab by Duolingo's Help Center, and practice runs as full-screen quiz sessions launched from home. A community thread complains about the growing number of tabs. Sources: <https://www.duolingo.com/help/leaderboards-and-league>, plus the community entries below.

**Synthesis.** Across the five, the persistent IA set is today/practice + library/queue + progress/stats + settings. Reading/content is optional and only Bunpro exposes it as a first-class area; Anki, WaniKani and HanziHero keep it out of the shell. Implication for shougong: a four-item Painel / Adicionar / Importar / Leitura top bar is unusual in this class — the recurring shape is today + library + progress + settings, with mobile navigation collapsing to a small bottom tab bar and practice leaving the chrome entirely.

Open gap: the exact WaniKani review dock and the logged-in mobile bottom bars of Bunpro and HanziHero were inferred from first-party structure rather than screenshots, because auth/Cloudflare blocked capture. Confirm from App Store/Play listings or logged-in screenshots before locking the shell prototype's recommended pattern.

## Long lists

- Infinite scroll fits homogeneous browsing but fails when users must find a specific item, compare items far apart, or reach a footer. The "Load More" variant fixes footer access, the illusion of completeness and bandwidth cost at the price of one extra tap. Source: <https://www.nngroup.com/articles/infinite-scrolling-tips/>.
- Infinite scroll breaks position preservation: after a detail-view detour, Back returns users to the top of a regenerated list ("pogo sticking"). Pagination confines pogo-back to a single page. Same source.
- Desktop→mobile table standard: stacked cards or key-value rows, dropping less-important columns. Keep a real table only when comparison genuinely needs sticky headers and horizontal scroll. Touch targets of at least 44×44 px. Sources: <https://www.nngroup.com/articles/mobile-tables/>, <https://uxpatterns.dev/patterns/data-display/table>.
- Sort, filter and paging state must survive navigation: never reset filters/sort on page change; persist preferences in the URL or localStorage; paginate at 100+ rows; debounce search around 300 ms. Source: <https://uxpatterns.dev/patterns/data-display/table>.
- W3C APG's feed role and grid row/column indices are the sanctioned pattern for partially rendered lists; not adopted here (accessibility out of scope). Source: <https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/data-grids/>.

Implication: explicit page controls on desktop and a "Load more" button on mobile match the research; list state belongs in the URL so back-navigation restores it.

## Visual language

- Dark themes should use semantic/adaptive colours rather than hard-coded ones, with system label colours and at least 4.5:1 contrast. HanziHero's shipped dark mode lost the meaning-vs-pronunciation hue distinction and users mistyped because they had cued their answer on colour; the team raised contrast after feedback. Sources: <https://developer.apple.com/design/human-interface-guidelines/dark-mode>, community entry below.
- HanziHero keys component, character and sound by hue (for example dark cyan for "learned" sound tiles); WaniKani keys five SRS groups from Apprentice to Burned. Sources: <https://hanzihero.com/docs/sounds>, <https://knowledge.wanikani.com/wanikani/srs-stages/>.
- Mandarin tone colours are an established convention, but red-versus-green (Pleco's default for tones 1 and 2) is the classic colour-blindness collision. Pair colour with tone marks and allow recolouring. Community entry below.

## Community sources

| Claim | Author | Venue | Date | Permalink |
| --- | --- | --- | --- | --- |
| Duolingo mobile tab bar and full-screen learning flow | PageFlows | PageFlows (iOS flow capture) | 2023-08 | <https://pageflows.com/post/ios/learning/duolingo/> |
| Duolingo extra tabs complaint | not captured | r/duolingo | 2022 | <https://www.reddit.com/r/duolingo/comments/vysdic/whats_up_with_all_the_new_tabs/> |
| HanziHero dark-mode hue/contrast postmortem | HanziHero product team | HanziHero community forum | 2025-04 | <https://community.hanzihero.com/t/dark-mode/5645> |
| Table state, page size and search-debounce guidance | not captured | uxpatterns.dev | updated 2026-03 | <https://uxpatterns.dev/patterns/data-display/table> |
| Tone-colour colour-blindness caveat | not captured | HSK Studio devlog (itch.io) | not captured | <https://hskstudio.itch.io/> |
