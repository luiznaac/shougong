# Shougong

A Chinese handwriting trainer with a spaced-repetition engine and vocabulary-restricted reading practice. This glossary fixes the words the product and the code use.

## Language

**Item**:
One vocabulary entry scheduled by the SRS. A multi-character item is one word and carries one grade.
_Avoid_: card (a card is the scheduling state attached to an item, not the vocabulary entry)

**Handwriting step**:
The draw-from-memory part of an item, shown in the prompt phase when handwriting is on.
_Avoid_: writing quiz, drawing test

**Self-check**:
The learner's own comparison of their drawing with the model, followed by a manual SRS grade. The app does not grade the drawing.
_Avoid_: ungraded quiz, auto-grade

**Reveal**:
The transition from drawing to comparison. It happens automatically on the last character or when the learner asks for it.
_Avoid_: flip, answer phase

**Comparison**:
The reveal's view: the learner's drawing beside the model character, one pair per character slot.
_Avoid_: result, feedback

**Slot row**:
The per-character row that shows which character is being drawn, the completed drawings, and each drawing beside its model on reveal.
_Avoid_: progress bar, character tabs
