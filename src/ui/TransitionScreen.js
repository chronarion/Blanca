import { UI_COLORS } from '../data/Constants.js';

export class TransitionScreen {
    constructor() {
        this.active = false;
        this.progress = 0;
        this.duration = 0.5;
        this.text = '';
        this.fadeIn = true;
        this.onMidpoint = null;
        this.midpointTriggered = false;
    }

    start(text = '', onMidpoint = null, duration = 0.5) {
        this.active = true;
        this.progress = 0;
        this.text = text;
        this.duration = duration;
        this.onMidpoint = onMidpoint;
        this.midpointTriggered = false;
        this.fadeIn = true;
    }

    update(dt) {
        if (!this.active) return;

        this.progress += dt / this.duration;

        if (this.progress >= 0.5 && !this.midpointTriggered) {
            this.midpointTriggered = true;
            if (this.onMidpoint) this.onMidpoint();
        }

        if (this.progress >= 1) {
            this.active = false;
            this.progress = 0;
        }
    }

    render(ctx, width, height) {
        if (!this.active) return;

        const alpha = this.progress < 0.5
            ? this.progress * 2
            : (1 - this.progress) * 2;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = UI_COLORS.bg;
        ctx.fillRect(0, 0, width, height);

        if (this.text && alpha > 0.5) {
            ctx.font = 'bold 24px monospace';
            ctx.fillStyle = UI_COLORS.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.text, width / 2, height / 2);
        }

        ctx.globalAlpha = 1;
    }
}
