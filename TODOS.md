# TODOS

## Deferred from Full Vibe Package (2026-05-07)

### Full theme unification
Unify 5 theme variation components (Faithful, CommandCenter, Arcade, Mainframe, GameBoy — 950 lines total) into a single CSS-variable-driven parametric component. Enables the palette editor to control the entire dashboard, not just the server room scene. Eliminates 5x DRY violation.
- **Effort:** 2-3 weekends (high regression risk — each theme has unique layout logic)
- **Depends on:** Full Vibe Package shipped first
- **Context:** Deferred during eng review (D1) because it would have doubled the timeline. The 5 variations have structurally different layouts (GameBoy draws SVG pixel art inline, CommandCenter has radar-style gauges, etc.) — this is a rewrite, not a refactor.

### Sprite asset optimization
Compress existing PNG sprites (~21MB total, individual sprites 1-2MB each) using pngquant or convert to WebP. Target: ~5MB total with no visual quality loss at pixel-art scale.
- **Effort:** S (1-2 hours)
- **Depends on:** Nothing — can be done anytime
- **Context:** Directly impacts r/selfhosted first impression. A Pi user waiting 30 seconds for sprites is not going to say "whoa." Flagged during eng review (D10).
