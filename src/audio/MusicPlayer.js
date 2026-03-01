export class MusicPlayer {
    constructor(audioCtx) {
        this.ctx = audioCtx;
        this.enabled = true;
        this.volume = 0.03;
        this.currentLoop = null;
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.gainNode.connect(this.ctx.destination);
        this.playing = false;
    }

    playAmbient() {
        if (!this.enabled || this.playing) return;
        this.playing = true;
        this.scheduleLoop();
    }

    scheduleLoop() {
        if (!this.playing) return;

        const now = this.ctx.currentTime;
        const notes = [
            { freq: 130, time: 0 },
            { freq: 164, time: 1.5 },
            { freq: 196, time: 3 },
            { freq: 164, time: 4.5 },
            { freq: 130, time: 6 },
            { freq: 110, time: 7.5 },
        ];

        for (const note of notes) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(note.freq, now + note.time);
            gain.gain.setValueAtTime(0, now + note.time);
            gain.gain.linearRampToValueAtTime(this.volume, now + note.time + 0.3);
            gain.gain.linearRampToValueAtTime(0, now + note.time + 1.4);
            osc.connect(gain);
            gain.connect(this.gainNode);
            osc.start(now + note.time);
            osc.stop(now + note.time + 1.5);
        }

        // Schedule next loop
        this.currentLoop = setTimeout(() => this.scheduleLoop(), 9000);
    }

    stop() {
        this.playing = false;
        if (this.currentLoop) {
            clearTimeout(this.currentLoop);
            this.currentLoop = null;
        }
    }

    setVolume(vol) {
        this.volume = vol;
        this.gainNode.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
}
