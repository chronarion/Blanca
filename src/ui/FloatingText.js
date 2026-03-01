export class FloatingText {
    constructor() {
        this.texts = [];
    }

    add(x, y, text, color = '#ffffff', duration = 1000, fontSize = 18) {
        this.texts.push({
            x, y, startY: y, text, color, duration,
            elapsed: 0, fontSize, alpha: 1,
        });
    }

    update(dt) {
        for (const t of this.texts) {
            t.elapsed += dt * 1000;
            const progress = t.elapsed / t.duration;
            t.y = t.startY - progress * 40;
            t.alpha = 1 - progress;
        }
        this.texts = this.texts.filter(t => t.elapsed < t.duration);
    }

    render(ctx) {
        for (const t of this.texts) {
            ctx.globalAlpha = Math.max(0, t.alpha);
            ctx.font = `bold ${t.fontSize}px monospace`;
            ctx.fillStyle = t.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.globalAlpha = 1;
    }
}
