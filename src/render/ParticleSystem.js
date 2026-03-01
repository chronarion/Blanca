import { ObjectPool } from '../util/ObjectPool.js';

export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.pool = new ObjectPool(
            () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, color: '', alpha: 1, gravity: 0 }),
            p => { p.life = 0; p.alpha = 1; },
            100
        );
    }

    emit(x, y, count, options = {}) {
        const {
            color = '#ffffff',
            speed = 100,
            spread = Math.PI * 2,
            angle = 0,
            life = 600,
            size = 4,
            gravity = 50,
            sizeDecay = true,
        } = options;

        for (let i = 0; i < count; i++) {
            const p = this.pool.get();
            const a = angle + (Math.random() - 0.5) * spread;
            const s = speed * (0.5 + Math.random() * 0.5);
            p.x = x;
            p.y = y;
            p.vx = Math.cos(a) * s;
            p.vy = Math.sin(a) * s;
            p.life = 0;
            p.maxLife = life * (0.7 + Math.random() * 0.6);
            p.size = size * (0.5 + Math.random() * 0.5);
            p.startSize = p.size;
            p.color = color;
            p.alpha = 1;
            p.gravity = gravity;
            p.sizeDecay = sizeDecay;
            this.particles.push(p);
        }
    }

    burst(x, y, count = 20, color = '#ffffff') {
        this.emit(x, y, count, {
            color, speed: 150, spread: Math.PI * 2,
            life: 500, size: 5, gravity: 80,
        });
    }

    sparkle(x, y, count = 8, color = '#ffd700') {
        this.emit(x, y, count, {
            color, speed: 60, spread: Math.PI * 2,
            life: 800, size: 3, gravity: -20,
        });
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life += dt * 1000;

            if (p.life >= p.maxLife) {
                this.pool.release(p);
                this.particles.splice(i, 1);
                continue;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += p.gravity * dt;

            const progress = p.life / p.maxLife;
            p.alpha = 1 - progress;
            if (p.sizeDecay) {
                p.size = p.startSize * (1 - progress);
            }
        }
    }

    render(ctx) {
        for (const p of this.particles) {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }

    clear() {
        for (const p of this.particles) {
            this.pool.release(p);
        }
        this.particles = [];
    }
}
