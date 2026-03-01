import { UI_COLORS } from '../data/Constants.js';
import { Button } from '../ui/Button.js';

export class SettingsState {
    constructor() {
        this.stateMachine = null;
        this.eventBus = null;
        this.renderer = null;

        this.buttons = [];
        this.clickHandler = null;
        this.moveHandler = null;
        this.keyHandler = null;
    }

    enter() {
        this.createButtons();

        this.clickHandler = (data) => {
            for (const btn of this.buttons) btn.handleClick(data.x, data.y);
        };
        this.moveHandler = (data) => {
            for (const btn of this.buttons) btn.handleMove(data.x, data.y);
        };
        this.keyHandler = (data) => {
            if (data.code === 'Escape') this.stateMachine.change('mainMenu');
        };
        this.eventBus.on('click', this.clickHandler);
        this.eventBus.on('mousemove', this.moveHandler);
        this.eventBus.on('keydown', this.keyHandler);
    }

    exit() {
        if (this.clickHandler) this.eventBus.off('click', this.clickHandler);
        if (this.moveHandler) this.eventBus.off('mousemove', this.moveHandler);
        if (this.keyHandler) this.eventBus.off('keydown', this.keyHandler);
    }

    createButtons() {
        const w = this.renderer.width;
        const h = this.renderer.height;
        const btnW = 180;
        const btnH = 40;
        const x = (w - btnW) / 2;

        this.buttons = [
            new Button(x, h - 80, btnW, btnH, 'Back', {
                onClick: () => this.stateMachine.change('mainMenu'),
            }),
        ];
    }

    update(dt) {}

    render(ctx) {
        const w = this.renderer.width;
        const h = this.renderer.height;

        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = 'center';
        ctx.fillText('Settings', w / 2, 50);

        ctx.font = '14px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.fillText('No configurable settings yet — all built-in defaults', w / 2, h / 2);

        for (const btn of this.buttons) {
            btn.render(ctx);
        }
    }
}
