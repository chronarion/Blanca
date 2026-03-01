export class SoundGenerator {
    constructor(audioCtx) {
        this.ctx = audioCtx;
    }

    createNoise(duration = 0.1) {
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    playTone(freq, duration = 0.15, type = 'square', volume = 0.1) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playNoise(duration = 0.05, volume = 0.05) {
        const buffer = this.createNoise(duration);
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        source.buffer = buffer;
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start();
    }

    playClick() {
        this.playTone(800, 0.05, 'square', 0.04);
    }

    playMove() {
        this.playTone(400, 0.08, 'triangle', 0.06);
        setTimeout(() => this.playTone(500, 0.06, 'triangle', 0.04), 40);
    }

    playCapture() {
        this.playNoise(0.08, 0.08);
        this.playTone(200, 0.15, 'sawtooth', 0.08);
        setTimeout(() => this.playTone(150, 0.1, 'sawtooth', 0.05), 50);
    }

    playPromotion() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.15, 'triangle', 0.06), i * 80);
        });
    }

    playVictory() {
        const melody = [523, 659, 784, 1047, 784, 1047];
        melody.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.2, 'triangle', 0.07), i * 120);
        });
    }

    playDefeat() {
        const melody = [400, 350, 300, 200];
        melody.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.3, 'sawtooth', 0.06), i * 200);
        });
    }

    playShopBuy() {
        this.playTone(600, 0.1, 'triangle', 0.05);
        setTimeout(() => this.playTone(800, 0.1, 'triangle', 0.05), 60);
    }

    playCheck() {
        this.playTone(880, 0.1, 'square', 0.06);
        setTimeout(() => this.playTone(660, 0.15, 'square', 0.04), 80);
    }

    playBossPhase() {
        this.playNoise(0.3, 0.06);
        this.playTone(150, 0.4, 'sawtooth', 0.1);
        setTimeout(() => this.playTone(100, 0.5, 'sawtooth', 0.08), 200);
    }
}
