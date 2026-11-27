---
title: Mobile practice-stage layout — sizing a square canvas beside a pinned dock
source: MDN, web.dev, W3C specs, and community write-ups on CSS sizing, container queries, viewport units and touch targets; gathered 2026-11-27
date: 2026-11-27
status: research
---

# Mobile practice-stage layout — sizing a square canvas beside a pinned dock

## Question

How should a full-height mobile practice screen size a square drawing canvas so it never overflows its padded stage or hides under the pinned bottom action dock, while a "clear" button stays reachable beside it?

## Summary

Size the square from its available slot in both axes (not from `vw`), make the slot a size container (`container-type: size`) and use `min(100cqw, 100cqh)` with `aspect-ratio: 1`; keep the dock an in-flow `auto` row of a `grid-template-rows: minmax(0,1fr) auto` shell (never a `position: fixed` bar) so it reserves its own height; set `min-width:0`/`min-height:0` at every flex/grid nesting level to defeat the automatic `min-content` minimum; and replace `justify-content: center` inside a scroll container with `margin:auto` / `safe center`.

## Sizing the square from its slot

`vw`/`90vw` is 1% of the viewport's initial containing block; it cannot see the parent's padding, a sibling button, or the dock, and it ignores scrollbars, so size the square from percent, container units, or a `ResizeObserver` measuring the slot instead ([web.dev viewport units](https://web.dev/blog/viewport-units), [Smashing Magazine 2023-12-20](https://www.smashingmagazine.com/2023/12/new-css-viewport-units-not-solve-classic-scrollbar-problem/)).

`container-type: size` + `width: min(100cqw, 100cqh); aspect-ratio: 1` (or `100cqmin`) picks the limiting axis in CSS; `aspect-ratio` alone only works when at least one dimension is automatic, and `max-height` clamps height without shrinking width ([MDN aspect-ratio](https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio), [MDN container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries), [css-tip.com 2025-06-10](https://css-tip.com/safe-align/), [Jay Freestone 2020-11-14](https://www.jayfreestone.com/writing/contained-aspect-ratio-boxes/)).

`min()` (not `clamp()`) is the operation that picks the smaller of width/height ([web.dev min/max/clamp, Una Kravets 2020-10-14](https://web.dev/articles/min-max-clamp)).

## The flex/grid minimum-size gotcha

Flex and grid items default to `min-width/min-height: auto` = their min-content size, so a row overflows instead of the canvas shrinking; set `min-width: 0; min-height: 0` (or `minmax(0,1fr)`, or a non-visible `overflow`) at every level, while a scroll container's automatic minimum is already 0 ([MDN min-width](https://developer.mozilla.org/en-US/docs/Web/CSS/min-width), [CSS Flexbox §4.5](https://www.w3.org/TR/css-flexbox-1/#min-size-auto), [Stack Overflow Michael Benjamin 2016-03-27](https://stackoverflow.com/a/36247448)).

## Centering inside a scroll container

`justify-content: center` (or `align-items: center`) in a scrolling main spills overflow off the start edge, which a scroll container cannot reach; use `margin: auto` on the child, `safe center`, or an outer non-scrolling wrapper with an inner scroller ([MDN justify-content `safe`](https://developer.mozilla.org/en-US/docs/Web/CSS/justify-content), [MDN box alignment](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_alignment), [Stack Overflow Michael Benjamin 2015](https://stackoverflow.com/questions/33454533/cant-scroll-to-top-of-flex-item-that-is-overflowing-container)).

## Full-height shell and the pinned dock

Shell: `height: 100dvh; display: grid; grid-template-rows: minmax(0,1fr) auto; overflow: hidden` (only main scrolls), with the dock as the `auto` in-flow footer; the flex equivalent is main `flex: 1 1 0; min-height: 0; overflow-y: auto`, dock `flex: none` ([MDN sticky footers cookbook](https://developer.mozilla.org/en-US/docs/Web/CSS/Layout_cookbook/Sticky_footers), [CSS-Tricks Adam Rackis 2020-09-02](https://css-tricks.com/how-to-use-css-grid-for-sticky-headers-and-footers/)).

`100dvh` tracks the mobile URL bar; `100svh` guarantees the dock stays visible with toolbars expanded; `100vh`/`100lvh` overshoot under the bar, and `vh` currently equals `lvh` ([web.dev viewport units, Bramus 2022-11-29](https://web.dev/blog/viewport-units), [MDN `<length>`](https://developer.mozilla.org/en-US/docs/Web/CSS/length)).

Add `viewport-fit=cover` and pad the dock with `max(<pad>, env(safe-area-inset-bottom))` for the home indicator ([WebKit Timothy Horton 2017-09-22](https://webkit.org/blog/7929/designing-websites-for-iphone-x/), [MDN env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env)).

For a non-modal always-visible bar prefer the in-flow grid/flex footer (or `position: sticky`); reserve `padding-bottom` = bar height only if using `position: fixed`, which is removed from flow, and add `scroll-padding-bottom` = dock height so focus/`scrollIntoView` never lands under it — `IntersectionObserver` reserves no layout space ([MDN position `fixed`](https://developer.mozilla.org/en-US/docs/Web/CSS/position), [MDN scroll-padding](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-padding), [MDN IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver)).

## Touch targets

≥44×44 CSS px preferred (WCAG 2.5.5 / Apple HIG 44pt), ≥24×24 minimum (WCAG 2.5.8); Material 48×48dp with ≥8dp gap; web.dev ~48px ([WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/buttons), [Material M3](https://m3.material.io/foundations/accessible-design/accessibility-basics), [web.dev accessible tap targets](https://web.dev/articles/accessible-tap-targets)).

## Horizontal overflow

A row wider than the padded stage overflows because block boxes grow to content and `overflow: visible` does not clip; fix with `min-width: 0` on flex/grid children, `max-width: 100%`, `overflow-x: clip/hidden/auto` on the stage, and `flex-wrap: wrap` ([MDN overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow), [MDN flex-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-wrap)).

## Row composition

Make the canvas the shrinkable item (`flex: 1 1 auto; min-width: 0`) and the button the fixed one (`flex: 0 0 auto`, ≥44×44), keep them side-by-side while the square clears its legible minimum, otherwise switch the row to column (`flex-direction: column`) below ~20–22rem via a container/media query, and keep DOM order canvas-then-button so the column fallback puts the button below and focus order matches ([derived guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-direction), [WCAG 2.5.5](https://www.w3.org/TR/WCAG22/)).

## Canvas crispness (DPR)

Lay out in CSS pixels; set the backing store to `Math.round(cssPx * devicePixelRatio)` and `ctx.setTransform(dpr,0,0,dpr,0,0)`, remembering that assigning `canvas.width/height` clears the canvas and resets context state, so redo it from a `ResizeObserver` (ideally `box: ['device-pixel-content-box']`) ([web.dev High DPI Canvas 2012](https://web.dev/articles/canvas-hidipi), [web.dev device-pixel-content-box, Surma 2020](https://web.dev/blog/device-pixel-content-box)).

## Recommended CSS skeleton (derived, not quoted)

```css
html, body { height: 100%; margin: 0; }
.app    { height: 100dvh; display: grid;
          grid-template-rows: minmax(0, 1fr) auto; overflow: hidden; }
.main   { overflow-y: auto; -webkit-overflow-scrolling: touch;
          scroll-padding-bottom: 8rem; }
.main__content { margin-block: auto; }            /* safe centering */
.row    { display: flex; gap: .75rem; align-items: center;
          min-height: 0; }
.slot   { container-type: size; flex: 1 1 auto;
          min-width: 0; min-height: 0; display: grid; place-items: center; }
.square { width: min(100cqw, 100cqh); aspect-ratio: 1; display: block; }
.action { flex: 0 0 auto; min-inline-size: 44px; min-block-size: 44px; }
.dock   { padding-bottom: max(.6rem, env(safe-area-inset-bottom)); }
@container (max-width: 22rem) {
  .row { flex-direction: column; }
  .action { inline-size: 100%; }
}
```

## Community sources

- Michael Benjamin, Stack Overflow, 2016-03-27, https://stackoverflow.com/a/36247448
- Michael Benjamin, Stack Overflow, 2015, https://stackoverflow.com/questions/33454533/cant-scroll-to-top-of-flex-item-that-is-overflowing-container
- Adam Rackis, CSS-Tricks, 2020-09-02, https://css-tricks.com/how-to-use-css-grid-for-sticky-headers-and-footers/
- Šime Vidas, Smashing Magazine, 2023-12-20, https://www.smashingmagazine.com/2023/12/new-css-viewport-units-not-solve-classic-scrollbar-problem/
- Jay Freestone, personal blog, 2020-11-14, https://www.jayfreestone.com/writing/contained-aspect-ratio-boxes/
- Jigar Gosar, personal blog, 2025-11-12, https://jigargosar.github.io/posts/css-responsive-square/
- Neil Lin, neillin.com, 2026-10-13, https://neillin.com/en/blog/css-safe-alignment/
- Temani Afif, css-tip.com, 2025-06-10, https://css-tip.com/safe-align/

## Primary sources

- [MDN aspect-ratio](https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio)
- [MDN min-width](https://developer.mozilla.org/en-US/docs/Web/CSS/min-width)
- [MDN container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)
- [MDN container-type](https://developer.mozilla.org/en-US/docs/Web/CSS/container-type)
- [MDN @container](https://developer.mozilla.org/en-US/docs/Web/CSS/@container)
- [MDN `<length>`](https://developer.mozilla.org/en-US/docs/Web/CSS/length)
- [MDN env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
- [MDN scroll-padding](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-padding)
- [MDN sticky footers cookbook](https://developer.mozilla.org/en-US/docs/Web/CSS/Layout_cookbook/Sticky_footers)
- [MDN flex-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-wrap)
- [MDN overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow)
- [MDN justify-content](https://developer.mozilla.org/en-US/docs/Web/CSS/justify-content)
- [MDN position](https://developer.mozilla.org/en-US/docs/Web/CSS/position)
- [CSS Flexbox §4.5](https://www.w3.org/TR/css-flexbox-1/#min-size-auto)
- [web.dev viewport units (Bramus 2022-11-29)](https://web.dev/blog/viewport-units)
- [web.dev min/max/clamp (Una Kravets 2020-10-14)](https://web.dev/articles/min-max-clamp)
- [web.dev High DPI Canvas (Paul Lewis, 2012)](https://web.dev/articles/canvas-hidipi)
- [web.dev device-pixel-content-box (Surma 2020)](https://web.dev/blog/device-pixel-content-box)
- [WebKit iPhone X (Timothy Horton 2017-09-22)](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [WCAG 2.2 SC 2.5.5 / 2.5.8](https://www.w3.org/TR/WCAG22/)
- [Apple HIG Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Material M3 structure](https://m3.material.io/foundations/accessible-design/accessibility-basics)
- [web.dev accessible tap targets](https://web.dev/articles/accessible-tap-targets)
