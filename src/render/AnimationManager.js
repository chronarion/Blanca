import { Tween } from './Tween.js';

export class AnimationManager {
    constructor() {
        this.tweens = [];
        this.animations = [];
    }

    addTween(target, props, duration, easing, onComplete) {
        const tween = new Tween(target, props, duration, easing, onComplete);
        this.tweens.push(tween);
        return tween;
    }

    addAnimation(anim) {
        this.animations.push(anim);
        return anim;
    }

    update(dt) {
        this.tweens = this.tweens.filter(t => !t.update(dt));
        this.animations = this.animations.filter(a => {
            a.elapsed = (a.elapsed || 0) + dt * 1000;
            if (a.elapsed >= a.duration) {
                if (a.onComplete) a.onComplete();
                return false;
            }
            if (a.update) a.update(a.elapsed / a.duration);
            return true;
        });
    }

    get isAnimating() {
        return this.tweens.length > 0 || this.animations.length > 0;
    }

    clear() {
        this.tweens = [];
        this.animations = [];
    }
}
