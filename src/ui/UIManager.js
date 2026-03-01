import { Tooltip } from './Tooltip.js';
import { FloatingText } from './FloatingText.js';

export class UIManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.tooltip = new Tooltip();
        this.floatingText = new FloatingText();
        this.buttons = [];
    }

    addButton(button) {
        this.buttons.push(button);
    }

    clearButtons() {
        this.buttons = [];
    }

    handleClick(x, y) {
        for (const btn of this.buttons) {
            if (btn.handleClick(x, y)) return true;
        }
        return false;
    }

    handleMove(x, y) {
        for (const btn of this.buttons) {
            btn.handleMove(x, y);
        }
    }

    update(dt) {
        this.floatingText.update(dt);
    }

    render(ctx) {
        for (const btn of this.buttons) {
            btn.render(ctx);
        }
        this.floatingText.render(ctx);
        this.tooltip.render(ctx);
    }
}
