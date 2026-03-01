import { UI_COLORS } from '../data/Constants.js';

export class UITheme {
    static _patternCanvas = null;

    static getChessPattern() {
        if (this._patternCanvas) return this._patternCanvas;
        const c = document.createElement('canvas');
        c.width = 40;
        c.height = 40;
        const x = c.getContext('2d');
        x.fillStyle = 'rgba(255,255,255,0.025)';
        x.fillRect(0, 0, 20, 20);
        x.fillRect(20, 20, 20, 20);
        this._patternCanvas = c;
        return c;
    }

    static drawBackground(ctx, w, h) {
        ctx.fillStyle = UI_COLORS.bg;
        ctx.fillRect(0, 0, w, h);

        // Chess micro-pattern
        const pattern = ctx.createPattern(this.getChessPattern(), 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w, h);

        // Warm center glow
        const grad = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, w * 0.65);
        grad.addColorStop(0, 'rgba(55, 40, 18, 0.12)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    static drawVignette(ctx, w, h, strength = 0.5) {
        const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.75);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${strength})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    static roundRect(ctx, x, y, w, h, r) {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
    }

    static drawPanel(ctx, x, y, w, h, opts = {}) {
        const r = opts.radius || 8;
        const fill = opts.fill || UI_COLORS.panel;
        const border = opts.border || UI_COLORS.panelBorder;
        const highlight = opts.highlight || false;
        const glow = opts.glow || false;

        // Shadow
        ctx.save();
        if (opts.shadow !== false) {
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 16;
            ctx.shadowOffsetY = 4;
        }
        ctx.beginPath();
        this.roundRect(ctx, x, y, w, h, r);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.restore();

        // Border
        ctx.beginPath();
        this.roundRect(ctx, x, y, w, h, r);
        ctx.strokeStyle = highlight ? UI_COLORS.accent : border;
        ctx.lineWidth = highlight ? 2 : 1;
        ctx.stroke();

        // Glow
        if (glow) {
            ctx.save();
            ctx.beginPath();
            this.roundRect(ctx, x, y, w, h, r);
            ctx.shadowColor = UI_COLORS.accent;
            ctx.shadowBlur = 12;
            ctx.strokeStyle = 'rgba(201, 168, 78, 0.25)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }

        // Top edge highlight
        ctx.beginPath();
        ctx.moveTo(x + r + 2, y + 0.5);
        ctx.lineTo(x + w - r - 2, y + 0.5);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    static drawTitle(ctx, text, x, y, size = 48) {
        ctx.save();
        ctx.font = `bold ${size}px Georgia, 'Times New Roman', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.shadowColor = 'rgba(200, 168, 78, 0.35)';
        ctx.shadowBlur = 16;
        ctx.fillStyle = UI_COLORS.accent;
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    static drawDivider(ctx, x, y, w) {
        const midX = x + w / 2;

        const leftGrad = ctx.createLinearGradient(x, y, midX - 10, y);
        leftGrad.addColorStop(0, 'rgba(200, 168, 78, 0)');
        leftGrad.addColorStop(1, 'rgba(200, 168, 78, 0.25)');
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(midX - 10, y);
        ctx.strokeStyle = leftGrad;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Diamond
        ctx.beginPath();
        ctx.moveTo(midX, y - 3);
        ctx.lineTo(midX + 3, y);
        ctx.lineTo(midX, y + 3);
        ctx.lineTo(midX - 3, y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(200, 168, 78, 0.4)';
        ctx.fill();

        const rightGrad = ctx.createLinearGradient(midX + 10, y, x + w, y);
        rightGrad.addColorStop(0, 'rgba(200, 168, 78, 0.25)');
        rightGrad.addColorStop(1, 'rgba(200, 168, 78, 0)');
        ctx.beginPath();
        ctx.moveTo(midX + 10, y);
        ctx.lineTo(x + w, y);
        ctx.strokeStyle = rightGrad;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    static drawButton(ctx, x, y, w, h, text, isHover, opts = {}) {
        const r = 6;
        const fontSize = opts.fontSize || 14;

        ctx.beginPath();
        this.roundRect(ctx, x, y, w, h, r);
        if (isHover) {
            const grad = ctx.createLinearGradient(x, y, x, y + h);
            const hc = opts.hoverColor || 'rgba(200, 168, 78, 0.2)';
            grad.addColorStop(0, hc);
            grad.addColorStop(1, 'rgba(200, 168, 78, 0.06)');
            ctx.fillStyle = grad;
        } else {
            ctx.fillStyle = opts.fill || UI_COLORS.panel;
        }
        ctx.fill();

        ctx.beginPath();
        this.roundRect(ctx, x, y, w, h, r);
        ctx.strokeStyle = isHover ? (opts.hoverBorder || UI_COLORS.accent) : (opts.border || UI_COLORS.panelBorder);
        ctx.lineWidth = isHover ? 1.5 : 1;
        ctx.stroke();

        if (isHover) {
            ctx.save();
            ctx.beginPath();
            this.roundRect(ctx, x, y, w, h, r);
            ctx.shadowColor = opts.hoverBorder || UI_COLORS.accent;
            ctx.shadowBlur = 8;
            ctx.strokeStyle = 'rgba(200, 168, 78, 0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }

        ctx.font = `bold ${fontSize}px monospace`;
        ctx.fillStyle = isHover ? (opts.hoverText || UI_COLORS.accent) : (opts.textColor || UI_COLORS.text);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w / 2, y + h / 2);
    }

    static wrapText(ctx, text, x, y, maxWidth, lineHeight) {
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
        return lineNum + 1;
    }
}
