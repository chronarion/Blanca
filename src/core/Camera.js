export class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeElapsed = 0;
    }

    shake(intensity = 5, duration = 300) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
        this.shakeElapsed = 0;
    }

    update(dt) {
        if (this.shakeIntensity > 0) {
            this.shakeElapsed += dt * 1000;
            if (this.shakeElapsed >= this.shakeDuration) {
                this.shakeX = 0;
                this.shakeY = 0;
                this.shakeIntensity = 0;
            } else {
                const decay = 1 - this.shakeElapsed / this.shakeDuration;
                this.shakeX = (Math.random() - 0.5) * this.shakeIntensity * 2 * decay;
                this.shakeY = (Math.random() - 0.5) * this.shakeIntensity * 2 * decay;
            }
        }
    }

    apply(ctx) {
        ctx.translate(this.x + this.shakeX, this.y + this.shakeY);
    }

    reset(ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
}
