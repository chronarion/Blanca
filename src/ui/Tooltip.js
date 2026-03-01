import { UI_COLORS } from '../data/Constants.js';

export class Tooltip {
    constructor() {
        this.visible = false;
        this.x = 0;
        this.y = 0;
        this.title = '';
        this.lines = [];
        this.maxWidth = 200;
    }

    show(x, y, title, lines = []) {
        this.visible = true;
        this.x = x;
        this.y = y;
        this.title = title;
        this.lines = lines;
    }

    hide() {
        this.visible = false;
    }

    render(ctx) {
        if (!this.visible) return;

        const padding = 10;
        const lineHeight = 16;
        const titleHeight = this.title ? 22 : 0;
        const h = padding * 2 + titleHeight + this.lines.length * lineHeight;

        ctx.font = '12px monospace';
        let w = this.maxWidth;
        if (this.title) {
            ctx.font = 'bold 12px monospace';
            w = Math.max(w, ctx.measureText(this.title).width + padding * 2);
        }
        for (const line of this.lines) {
            ctx.font = '11px monospace';
            w = Math.max(w, ctx.measureText(line).width + padding * 2);
        }
        w = Math.min(w, 300);

        let tx = this.x + 10;
        let ty = this.y - h - 5;
        if (ty < 0) ty = this.y + 20;

        // Background
        ctx.fillStyle = UI_COLORS.bgLight;
        ctx.fillRect(tx, ty, w, h);
        ctx.strokeStyle = UI_COLORS.panelBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, w, h);

        // Title
        if (this.title) {
            ctx.font = 'bold 12px monospace';
            ctx.fillStyle = UI_COLORS.text;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(this.title, tx + padding, ty + padding);
        }

        // Lines
        ctx.font = '11px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        for (let i = 0; i < this.lines.length; i++) {
            ctx.fillText(this.lines[i], tx + padding, ty + padding + titleHeight + i * lineHeight);
        }
    }
}
