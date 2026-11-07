---
paths:
  - 'resources/**'
---

# Resources

## Text meets WCAG AA on the surface it sits on
Every text colour must reach at least 4.5:1 against the surface it is placed on (3:1 for text from 24px, or 19px bold, and for icons and control borders). Measure against the real surface: canvas, canvas-strong and bg-muted are darker than white. stone-500 (4.2–4.5:1 off white) is not for text on canvas or tinted tiles; use stone-600 for secondary text there. Lists and tables on the canvas get their own white surface. tests/frontend/color-contrast.test.mjs guards the muted-foreground token.
