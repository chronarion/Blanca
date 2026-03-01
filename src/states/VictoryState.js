import { UI_COLORS } from '../data/Constants.js';
import { UITheme } from '../ui/UITheme.js';

export class VictoryState {
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

        this.clickHandler = () => this.returnToMenu();
        this.keyHandler = (data) => {
            if (data.code === 'Enter' || data.code === 'Space') this.returnToMenu();
        };
        this.eventBus.on('click', this.clickHandler);
        this.eventBus.on('keydown', this.keyHandler);
    }

    exit() {
        if (this.clickHandler) this.eventBus.off('click', this.clickHandler);
        if (this.keyHandler) this.eventBus.off('keydown', this.keyHandler);
    }

    returnToMenu() {
        this.stateMachine.change('mainMenu');
    }

    update(dt) {
        this.fadeIn = Math.min(1, this.fadeIn + dt);
    }

    render(ctx) {
        const w = this.renderer.width;
        const h = this.renderer.height;

        ctx.globalAlpha = this.fadeIn;

        // Gold background glow
        const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.5);
        grad.addColorStop(0, 'rgba(200, 168, 78, 0.08)');
        grad.addColorStop(1, 'rgba(9, 9, 13, 1)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        const pattern = ctx.createPattern(UITheme.getChessPattern(), 'repeat');
        ctx.globalAlpha = this.fadeIn * 0.5;
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = this.fadeIn;

        UITheme.drawTitle(ctx, 'VICTORY', w / 2, h / 2 - 80, 52);

        ctx.font = '16px monospace';
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('You have conquered the board!', w / 2, h / 2 - 30);

        UITheme.drawDivider(ctx, w / 2 - 100, h / 2 - 8, 200);

        if (this.stats) {
            const lines = [
                `Battles Won: ${this.stats.battlesWon || 0}`,
                `Pieces Lost: ${this.stats.piecesLost || 0}`,
                `Pieces Recruited: ${this.stats.piecesRecruited || 0}`,
                `Floors Cleared: ${this.stats.floorsCleared || 0}`,
                `Gold Spent: ${this.stats.goldSpent || 0}`,
            ];

            ctx.font = '13px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], w / 2, h / 2 + 16 + i * 24);
            }
        }

        ctx.font = '12px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.globalAlpha = this.fadeIn * 0.5;
        ctx.fillText('Click to return to menu', w / 2, h - 50);

        ctx.globalAlpha = 1;
    }
}
