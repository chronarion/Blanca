import { UI_COLORS } from '../data/Constants.js';
import { UITheme } from '../ui/UITheme.js';
import { Button } from '../ui/Button.js';

export class MainMenuState {
    constructor() {
        this.stateMachine = null;
        this.eventBus = null;
        this.renderer = null;
        this.runManager = null;
        this.saveManager = null;

        this.buttons = [];
        this.titlePulse = 0;

        this.clickHandler = null;
        this.moveHandler = null;
        this.keyHandler = null;
    }

    enter() {
        this.titlePulse = 0;
        this.createButtons();
        this.bindInput();
    }

    exit() {
        if (this.clickHandler) this.eventBus.off('click', this.clickHandler);
        if (this.moveHandler) this.eventBus.off('mousemove', this.moveHandler);
        if (this.keyHandler) this.eventBus.off('keydown', this.keyHandler);
    }

    createButtons() {
        const w = this.renderer.width;
        const h = this.renderer.height;
        const btnW = 220;
        const btnH = 46;
        const x = (w - btnW) / 2;
        const startY = h / 2 + 40;
        const gap = 14;

        this.buttons = [];

        this.buttons.push(new Button(x, startY, btnW, btnH, 'New Game', {
            onClick: () => {
                this.stateMachine.change('armySelect');
            },
        }));

        const hasSave = this.saveManager && this.saveManager.hasSave();
        if (hasSave) {
            this.buttons.push(new Button(x, startY + btnH + gap, btnW, btnH, 'Continue', {
                onClick: () => this.loadGame(),
            }));
        }

        this.buttons.push(new Button(x, startY + (hasSave ? 2 : 1) * (btnH + gap), btnW, btnH, 'Settings', {
            onClick: () => {
                if (this.stateMachine.states.has('settings')) {
                    this.stateMachine.change('settings');
                }
            },
        }));
    }

    bindInput() {
        this.clickHandler = (data) => {
            for (const btn of this.buttons) btn.handleClick(data.x, data.y);
        };
        this.moveHandler = (data) => {
            for (const btn of this.buttons) btn.handleMove(data.x, data.y);
        };
        this.keyHandler = (data) => {
            if (data.code === 'Enter') {
                this.stateMachine.change('armySelect');
            }
        };
        this.eventBus.on('click', this.clickHandler);
        this.eventBus.on('mousemove', this.moveHandler);
        this.eventBus.on('keydown', this.keyHandler);
    }

    loadGame() {
        if (this.saveManager && this.runManager) {
            const data = this.saveManager.load();
            if (data) {
                this.runManager.deserialize(data);
                this.stateMachine.change('map');
            }
        }
    }

    update(dt) {
        this.titlePulse += dt;
    }

    render(ctx) {
        const w = this.renderer.width;
        const h = this.renderer.height;

        UITheme.drawBackground(ctx, w, h);
        UITheme.drawVignette(ctx, w, h, 0.6);

        // Title with subtle pulse
        const pulse = Math.sin(this.titlePulse * 1.5) * 0.04 + 1;
        UITheme.drawTitle(ctx, 'BLANCA', w / 2, h / 2 - 80, Math.floor(56 * pulse));

        // Subtitle
        ctx.font = '15px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('A Chess Roguelike', w / 2, h / 2 - 25);

        // Divider
        UITheme.drawDivider(ctx, w / 2 - 120, h / 2 + 12, 240);

        // Buttons
        for (const btn of this.buttons) {
            btn.render(ctx);
        }

        // Version
        ctx.font = '11px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.5;
        ctx.fillText('v0.1  —  Chess IS the game', w / 2, h - 24);
        ctx.globalAlpha = 1;
    }
}
