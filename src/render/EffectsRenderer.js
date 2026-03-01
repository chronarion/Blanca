import { ParticleSystem } from './ParticleSystem.js';
import { UI_COLORS } from '../data/Constants.js';

export class EffectsRenderer {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.particles = new ParticleSystem();
        this.screenFlashes = [];
        this.boardRenderer = null;

        this.setupListeners();
    }

    setupListeners() {
        this.eventBus.on('pieceCaptured', (data) => this.onCapture(data));
        this.eventBus.on('piecePromoted', (data) => this.onPromotion(data));
        this.eventBus.on('relicGained', (data) => this.onRelicGained(data));
    }

    setBoardRenderer(br) {
        this.boardRenderer = br;
    }

    onCapture(data) {
        if (!this.boardRenderer) return;
        const pos = this.boardRenderer.boardToScreen(data.col || data.captured.col, data.row || data.captured.row);
        const ts = this.boardRenderer.tileSize;
        this.particles.burst(pos.x + ts / 2, pos.y + ts / 2, 15, UI_COLORS.accent);
        this.addScreenFlash(UI_COLORS.accent, 150);
    }

    onPromotion(data) {
        if (!this.boardRenderer) return;
        const pos = this.boardRenderer.boardToScreen(data.piece.col, data.piece.row);
        const ts = this.boardRenderer.tileSize;
        this.particles.sparkle(pos.x + ts / 2, pos.y + ts / 2, 20, UI_COLORS.gold);
        this.addScreenFlash(UI_COLORS.gold, 200);
    }

    onRelicGained() {
        this.addScreenFlash(UI_COLORS.gold, 300);
    }

    addScreenFlash(color, duration) {
        this.screenFlashes.push({ color, duration, elapsed: 0 });
    }

    update(dt) {
        this.particles.update(dt);

        for (let i = this.screenFlashes.length - 1; i >= 0; i--) {
            this.screenFlashes[i].elapsed += dt * 1000;
            if (this.screenFlashes[i].elapsed >= this.screenFlashes[i].duration) {
                this.screenFlashes.splice(i, 1);
            }
        }
    }

    render(ctx) {
        this.particles.render(ctx);

        for (const flash of this.screenFlashes) {
            const progress = flash.elapsed / flash.duration;
            const alpha = 0.3 * (1 - progress);
            ctx.fillStyle = flash.color;
            ctx.globalAlpha = alpha;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.globalAlpha = 1;
        }
    }
}
