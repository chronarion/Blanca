# Blanca — Chess Roguelike

## Build

After editing any source files, rebuild the bundle:

```
npx esbuild src/main.js --bundle --outfile=dist/game.js
```

Open `index.html` directly in a browser (no server needed).

## Architecture

- Vanilla JS, ES modules in `src/`, bundled to `dist/game.js` via esbuild
- Canvas rendering, procedural audio (Web Audio API), zero asset files
- Seeded RNG for reproducible runs

### Key directories

- `src/core/` — Game loop, EventBus, StateMachine, InputManager
- `src/combat/` — CombatManager, TurnManager, CaptureResolver, CheckDetector
- `src/pieces/` — Piece, MovementPattern, ModifierSystem
- `src/ai/` — AIController, BossAI, Evaluator, ThreatMap
- `src/states/` — Game states (mainMenu, armySelect, map, combat, shop, event, etc.)
- `src/progression/` — RunManager, Shop, FloorGenerator, RelicSystem
- `src/data/` — Constants, ArmyData, BossData, ModifierData, RelicData, etc.
- `src/render/` — Renderer, PieceRenderer, BoardRenderer, AnimationManager
- `src/audio/` — Procedural SFX & music
- `src/ui/` — Buttons, panels, floating text, tooltips
- `src/util/` — GridUtil, SeededRNG, easing, math helpers
- `src/save/` — localStorage save/load

### Core flow

Entry: `index.html` → `dist/game.js` (bundled from `src/main.js` → `src/core/Game.js`)

EventBus decouples systems. StateMachine manages state transitions. RunManager owns the full run lifecycle (roster, gold, relics, floor progression). CombatManager wraps Board, AI, TurnManager, CaptureResolver, CheckDetector, and ModifierSystem.

### Coordinate system

- Board: col=0,row=0 is top-left; player at bottom, enemy at top
- Renderer uses DPR scaling via `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`
- InputManager uses CSS-space coordinates

## Style

- No frameworks, no dependencies beyond esbuild for bundling
- Keep code simple and direct — avoid over-abstraction
- Chess IS the game: no HP bars, no RPG stats, captures via chess rules
