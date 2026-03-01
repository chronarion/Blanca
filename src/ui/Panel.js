import { UI_COLORS } from '../data/Constants.js';

export class Panel {
    constructor(x, y, w, h, options = {}) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.bg = options.bg || UI_COLORS.panel;
        this.border = options.border || UI_COLORS.panelBorder;
        this.alpha = options.alpha !== undefined ? options.alpha : 1;
        this.title = options.title || '';
    }

    render(ctx) {
        ctx.globalAlpha = this.alpha;

        ctx.fillStyle = this.bg;
        ctx.fillRect(this.x, this.y, this.w, this.h);

        ctx.strokeStyle = this.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.w, this.h);

        if (this.title) {
            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = UI_COLORS.text;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(this.title, this.x + 10, this.y + 8);

            ctx.strokeStyle = this.border;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + 28);
            ctx.lineTo(this.x + this.w, this.y + 28);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    contains(x, y) {
        return x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h;
    }
}
