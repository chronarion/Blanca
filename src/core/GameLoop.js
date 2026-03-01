export class GameLoop {
    constructor(updateFn, renderFn) {
        this.updateFn = updateFn;
        this.renderFn = renderFn;
        this.running = false;
        this.lastTime = 0;
        this.accumulator = 0;
        this.fixedStep = 1000 / 60;
        this.maxDelta = 100;
        this.rafId = null;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        this.rafId = requestAnimationFrame(t => this.tick(t));
    }

    stop() {
        this.running = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    tick(timestamp) {
        if (!this.running) return;

        let delta = timestamp - this.lastTime;
        this.lastTime = timestamp;
        if (delta > this.maxDelta) delta = this.maxDelta;

        this.accumulator += delta;
        while (this.accumulator >= this.fixedStep) {
            this.updateFn(this.fixedStep / 1000);
            this.accumulator -= this.fixedStep;
        }

        this.renderFn();
        this.rafId = requestAnimationFrame(t => this.tick(t));
    }
}
