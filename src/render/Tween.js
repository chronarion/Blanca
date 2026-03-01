import { Easing } from '../util/EasingFunctions.js';

export class Tween {
    constructor(target, props, duration, easing = 'easeOutCubic', onComplete = null) {
        this.target = target;
        this.startValues = {};
        this.endValues = {};
        this.duration = duration;
        this.elapsed = 0;
        this.easing = typeof easing === 'function' ? easing : (Easing[easing] || Easing.linear);
        this.onComplete = onComplete;
        this.done = false;
        this.delay = 0;

        for (const key of Object.keys(props)) {
            this.startValues[key] = target[key];
            this.endValues[key] = props[key];
        }
    }

    setDelay(ms) {
        this.delay = ms;
        return this;
    }

    update(dt) {
        if (this.done) return true;

        if (this.delay > 0) {
            this.delay -= dt * 1000;
            if (this.delay > 0) return false;
        }

        this.elapsed += dt * 1000;
        const progress = Math.min(this.elapsed / this.duration, 1);
        const t = this.easing(progress);

        for (const key of Object.keys(this.endValues)) {
            this.target[key] = this.startValues[key] + (this.endValues[key] - this.startValues[key]) * t;
        }

        if (progress >= 1) {
            this.done = true;
            if (this.onComplete) this.onComplete();
            return true;
        }
        return false;
    }
}
