import { UI_COLORS } from '../data/Constants.js';
import { UITheme } from './UITheme.js';

export class Button {
    constructor(x, y, w, h, text, options = {}) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.text = text;
        this.color = options.color || UI_COLORS.panel;
        this.hoverColor = options.hoverColor || null;
        this.hoverBorder = options.hoverBorder || null;
        this.textColor = options.textColor || UI_COLORS.text;
        this.borderColor = options.borderColor || UI_COLORS.panelBorder;
        this.fontSize = options.fontSize || 14;
        this.isHovered = false;
        this.onClick = options.onClick || null;
    }

    contains(x, y) {
        return x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h;
    }

    handleClick(x, y) {
        if (this.contains(x, y) && this.onClick) {
            this.onClick();
            return true;
        }
        return false;
    }

    handleMove(x, y) {
        this.isHovered = this.contains(x, y);
    }

    render(ctx) {
        UITheme.drawButton(ctx, this.x, this.y, this.w, this.h, this.text, this.isHovered, {
            fill: this.color,
            border: this.borderColor,
            textColor: this.textColor,
            fontSize: this.fontSize,
            hoverColor: this.hoverColor,
            hoverBorder: this.hoverBorder,
        });
    }
}
