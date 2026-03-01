import { UI_COLORS } from '../data/Constants.js';

export class Button {
    constructor(x, y, w, h, text, options = {}) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.text = text;
        this.color = options.color || UI_COLORS.panel;
        this.hoverColor = options.hoverColor || UI_COLORS.accent;
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
        ctx.fillStyle = this.isHovered ? this.hoverColor : this.color;
        ctx.fillRect(this.x, this.y, this.w, this.h);

        ctx.strokeStyle = this.isHovered ? this.hoverColor : this.borderColor;
        ctx.lineWidth = this.isHovered ? 2 : 1;
        ctx.strokeRect(this.x, this.y, this.w, this.h);

        ctx.font = `bold ${this.fontSize}px monospace`;
        ctx.fillStyle = this.textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.x + this.w / 2, this.y + this.h / 2);
    }
}
