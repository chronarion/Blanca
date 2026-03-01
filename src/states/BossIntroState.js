import { UI_COLORS, TEAMS } from '../data/Constants.js';
import { getBossForFloor } from '../data/BossData.js';
import { Piece } from '../pieces/Piece.js';
import { BossAI } from '../ai/BossAI.js';

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

        // Dark vignette
        const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
        grad.addColorStop(0, 'rgba(20, 10, 30, 0.8)');
        grad.addColorStop(1, 'rgba(10, 5, 15, 1)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Boss name
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = UI_COLORS.danger;
        ctx.textAlign = 'center';
        ctx.fillText(`FLOOR ${this.floor} BOSS`, w / 2, h / 2 - 80);

        ctx.font = 'bold 42px monospace';
        ctx.fillStyle = UI_COLORS.accent;
        ctx.fillText(this.bossData.name, w / 2, h / 2 - 30);

        ctx.font = 'italic 16px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.fillText(this.bossData.title, w / 2, h / 2 + 10);

        ctx.font = '13px monospace';
        ctx.fillStyle = UI_COLORS.text;
        this.wrapText(ctx, this.bossData.description, w / 2, h / 2 + 50, 500, 18);

        ctx.font = '14px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.fillText('Click to begin the fight', w / 2, h - 60);

        ctx.globalAlpha = 1;
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let lineNum = 0;
        for (const word of words) {
            const test = line + (line ? ' ' : '') + word;
            if (ctx.measureText(test).width > maxWidth && line) {
                ctx.fillText(line, x, y + lineNum * lineHeight);
                line = word;
                lineNum++;
            } else {
                line = test;
            }
        }
        if (line) ctx.fillText(line, x, y + lineNum * lineHeight);
    }
}
