import { UI_COLORS } from '../data/Constants.js';
import { UITheme } from '../ui/UITheme.js';
import { Button } from '../ui/Button.js';

export class PauseState {
    constructor() {
        this.stateMachine = null;
        this.eventBus = null;
        this.renderer = null;
        this.saveManager = null;
        this.runManager = null;

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
            if (data.code === 'Escape') this.stateMachine.pop();
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
        const btnW = 200;
        const btnH = 42;
        const x = (w - btnW) / 2;
        const startY = h / 2 - 20;
        const gap = 14;

        this.buttons = [
            new Button(x, startY, btnW, btnH, 'Resume', {
                onClick: () => this.stateMachine.pop(),
            }),
            new Button(x, startY + btnH + gap, btnW, btnH, 'Save Game', {
                onClick: () => this.saveGame(),
            }),
            new Button(x, startY + 2 * (btnH + gap), btnW, btnH, 'Quit to Menu', {
                color: UI_COLORS.panel,
                hoverColor: 'rgba(192, 64, 80, 0.2)',
                hoverBorder: UI_COLORS.danger,
                onClick: () => this.stateMachine.change('mainMenu'),
            }),
        ];
    }

    saveGame() {
        if (this.saveManager && this.runManager) {
            this.saveManager.save(this.runManager.serialize());
        }
    }

    update(dt) {}

    render(ctx) {
        const w = this.renderer.width;
        const h = this.renderer.height;

        // Dim overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, w, h);

        // Panel backdrop
        const panelW = 280;
        const panelH = 260;
        const px = (w - panelW) / 2;
        const py = (h - panelH) / 2 - 20;
        UITheme.drawPanel(ctx, px, py, panelW, panelH, { radius: 10 });

        // Title
        UITheme.drawTitle(ctx, 'PAUSED', w / 2, py + 40, 28);

        UITheme.drawDivider(ctx, px + 30, py + 64, panelW - 60);

        // Buttons
        for (const btn of this.buttons) {
            btn.render(ctx);
        }
    }
}
