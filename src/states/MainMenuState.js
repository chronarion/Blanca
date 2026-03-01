import { UI_COLORS } from '../data/Constants.js';
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
        const btnW = 200;
        const btnH = 44;
        const x = (w - btnW) / 2;
        const startY = h / 2 + 20;
        const gap = 12;

        this.buttons = [];

        this.buttons.push(new Button(x, startY, btnW, btnH, 'New Game', {
            color: UI_COLORS.panel,
            hoverColor: UI_COLORS.accent,
            onClick: () => this.stateMachine.change('armySelect'),
        }));

        const hasSave = this.saveManager && this.saveManager.hasSave();
        if (hasSave) {
            this.buttons.push(new Button(x, startY + btnH + gap, btnW, btnH, 'Continue', {
                color: UI_COLORS.panel,
                hoverColor: UI_COLORS.success,
                onClick: () => this.loadGame(),
            }));
        }

        this.buttons.push(new Button(x, startY + (hasSave ? 2 : 1) * (btnH + gap), btnW, btnH, 'Settings', {
            color: UI_COLORS.panel,
            hoverColor: UI_COLORS.info,
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

        // Title
        const pulse = Math.sin(this.titlePulse * 2) * 0.1 + 0.9;
        ctx.font = `bold ${Math.floor(64 * pulse)}px monospace`;
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BLANCA', w / 2, h / 2 - 80);

        ctx.font = '16px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.fillText('A Chess Roguelike', w / 2, h / 2 - 30);

        for (const btn of this.buttons) {
            btn.render(ctx);
        }

        ctx.font = '11px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.fillText('v0.1 — Chess IS the game', w / 2, h - 24);
    }
}
