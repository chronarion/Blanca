import { UI_COLORS } from '../data/Constants.js';
import { UITheme } from '../ui/UITheme.js';

export class GameOverState {
    constructor() {
        this.stateMachine = null;
        this.eventBus = null;
        this.renderer = null;
        this.runManager = null;

        this.stats = null;
        this.fadeIn = 0;
        this.clickHandler = null;
        this.keyHandler = null;
    }

    enter(params = {}) {
        this.stats = params.stats || (this.runManager ? this.runManager.stats : {});
        this.fadeIn = 0;

        this.clickHandler = () => {
            if (this.fadeIn > 0.5) this.stateMachine.change('mainMenu');
        };
        this.keyHandler = (data) => {
            if (data.code === 'Enter' || data.code === 'Space') this.stateMachine.change('mainMenu');
        };
        this.eventBus.on('click', this.clickHandler);
        this.eventBus.on('keydown', this.keyHandler);
    }

    exit() {
        if (this.clickHandler) this.eventBus.off('click', this.clickHandler);
        if (this.keyHandler) this.eventBus.off('keydown', this.keyHandler);
    }

    update(dt) {
        this.fadeIn = Math.min(1, this.fadeIn + dt);
    }

    render(ctx) {
        const w = this.renderer.width;
        const h = this.renderer.height;

        ctx.globalAlpha = this.fadeIn;

        // Dark crimson vignette
        const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.55);
        grad.addColorStop(0, 'rgba(60, 8, 8, 0.7)');
        grad.addColorStop(0.6, 'rgba(30, 5, 8, 0.9)');
        grad.addColorStop(1, 'rgba(9, 5, 6, 1)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Faint chess pattern
        const pattern = ctx.createPattern(UITheme.getChessPattern(), 'repeat');
        ctx.globalAlpha = this.fadeIn * 0.3;
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = this.fadeIn;

        // "GAME OVER" — crimson serif with glow
        ctx.save();
        ctx.font = `bold 48px Georgia, 'Times New Roman', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(192, 64, 80, 0.35)';
        ctx.shadowBlur = 16;
        ctx.fillStyle = UI_COLORS.danger;
        ctx.fillText('GAME OVER', w / 2, h / 2 - 80);
        ctx.restore();

        // Subtitle
        ctx.font = `italic 16px Georgia, serif`;
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Your king has fallen.', w / 2, h / 2 - 32);

        UITheme.drawDivider(ctx, w / 2 - 100, h / 2 - 10, 200);

        // Stats
        if (this.stats) {
            const lines = [
                `Floor Reached: ${this.stats.floorsCleared || 0}`,
                `Battles Won: ${this.stats.battlesWon || 0}`,
                `Pieces Lost: ${this.stats.piecesLost || 0}`,
            ];

            ctx.font = '13px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], w / 2, h / 2 + 16 + i * 24);
            }
        }

        // Continue prompt
        ctx.font = '12px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.globalAlpha = this.fadeIn * 0.5;
        ctx.fillText('Click to return to menu', w / 2, h - 50);

        ctx.globalAlpha = 1;
    }
}
