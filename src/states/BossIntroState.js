import { UI_COLORS, TEAMS } from '../data/Constants.js';
import { getBossForFloor } from '../data/BossData.js';
import { Piece } from '../pieces/Piece.js';
import { BossAI } from '../ai/BossAI.js';
import { UITheme } from '../ui/UITheme.js';

export class BossIntroState {
    constructor() {
        this.stateMachine = null;
        this.eventBus = null;
        this.renderer = null;
        this.runManager = null;

        this.bossData = null;
        this.floor = 0;
        this.fadeIn = 0;

        this.clickHandler = null;
        this.keyHandler = null;
    }

    enter(params = {}) {
        this.floor = params.floor || 5;
        this.bossData = getBossForFloor(this.floor);
        this.fadeIn = 0;

        this.clickHandler = () => this.startBoss();
        this.keyHandler = (data) => {
            if (data.code === 'Enter' || data.code === 'Space') this.startBoss();
        };
        this.eventBus.on('click', this.clickHandler);
        this.eventBus.on('keydown', this.keyHandler);
    }

    exit() {
        if (this.clickHandler) this.eventBus.off('click', this.clickHandler);
        if (this.keyHandler) this.eventBus.off('keydown', this.keyHandler);
    }

    startBoss() {
        if (!this.bossData) return;

        const phase1 = this.bossData.phases[0];
        const encounter = {
            name: this.bossData.name,
            cols: this.bossData.boardSize.cols,
            rows: this.bossData.boardSize.rows,
            enemyPieces: phase1.pieces,
            terrain: phase1.terrain || [],
            goldReward: this.bossData.goldReward,
            isBoss: true,
            difficulty: this.bossData.difficulty,
            bossData: this.bossData,
        };

        const combatParams = this.runManager.prepareCombat(encounter);
        combatParams.isBoss = true;
        combatParams.bossData = this.bossData;
        this.stateMachine.change('combat', combatParams);
    }

    update(dt) {
        this.fadeIn = Math.min(1, this.fadeIn + dt * 2);
    }

    render(ctx) {
        if (!this.bossData) return;

        const w = this.renderer.width;
        const h = this.renderer.height;
        const alpha = this.fadeIn;

        ctx.globalAlpha = alpha;

        // Dark crimson vignette
        const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
        grad.addColorStop(0, 'rgba(40, 8, 12, 0.85)');
        grad.addColorStop(1, 'rgba(9, 5, 6, 1)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Chess pattern very faint
        const pattern = ctx.createPattern(UITheme.getChessPattern(), 'repeat');
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = alpha;

        // Floor label
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = UI_COLORS.danger;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.letterSpacing = '3px';
        ctx.fillText(`FLOOR ${this.floor} BOSS`, w / 2, h / 2 - 80);
        ctx.letterSpacing = '0px';

        // Boss name
        ctx.save();
        ctx.font = `bold 40px Georgia, 'Times New Roman', serif`;
        ctx.shadowColor = 'rgba(192, 64, 80, 0.5)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = UI_COLORS.danger;
        ctx.fillText(this.bossData.name, w / 2, h / 2 - 30);
        ctx.restore();

        // Title
        ctx.font = 'italic 15px Georgia, serif';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.fillText(this.bossData.title, w / 2, h / 2 + 10);

        UITheme.drawDivider(ctx, w / 2 - 100, h / 2 + 30, 200);

        // Description
        ctx.font = '12px monospace';
        ctx.fillStyle = UI_COLORS.text;
        UITheme.wrapText(ctx, this.bossData.description, w / 2, h / 2 + 55, 450, 18);

        // Continue prompt
        ctx.font = '12px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillText('Click to begin the fight', w / 2, h - 55);

        ctx.globalAlpha = 1;
    }
}
