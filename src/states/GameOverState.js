import { UI_COLORS } from '../data/Constants.js';

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

        // Red vignette
        const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.5);
        grad.addColorStop(0, 'rgba(80, 10, 10, 0.6)');
        grad.addColorStop(1, 'rgba(10, 5, 5, 1)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.font = 'bold 52px monospace';
        ctx.fillStyle = UI_COLORS.danger;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAME OVER', w / 2, h / 2 - 80);

        ctx.font = '18px monospace';
        ctx.fillStyle = UI_COLORS.text;
        ctx.fillText('Your king has fallen.', w / 2, h / 2 - 30);

        if (this.stats) {
            ctx.font = '14px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            const lines = [
                `Floor Reached: ${this.stats.floorsCleared || 0}`,
                `Battles Won: ${this.stats.battlesWon || 0}`,
                `Pieces Lost: ${this.stats.piecesLost || 0}`,
            ];
            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], w / 2, h / 2 + 20 + i * 24);
            }
        }

        ctx.font = '14px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.fillText('Click to return to menu', w / 2, h - 50);

        ctx.globalAlpha = 1;
    }
}
