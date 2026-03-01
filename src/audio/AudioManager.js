import { SFXPlayer } from './SFXPlayer.js';
import { MusicPlayer } from './MusicPlayer.js';

export class AudioManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.ctx = null;
        this.sfx = null;
        this.music = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.sfx = new SFXPlayer(this.ctx);
            this.music = new MusicPlayer(this.ctx);
            this.initialized = true;
            this.setupListeners();
        } catch (e) {
            console.warn('Audio not available:', e);
        }
    }

    setupListeners() {
        this.eventBus.on('click', () => {
            if (!this.initialized) this.init();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        });

        this.eventBus.on('pieceCaptured', () => this.playSFX('capture'));
        this.eventBus.on('piecePromoted', () => this.playSFX('promotion'));
        this.eventBus.on('combatEnd', (data) => {
            if (data.winner === 'player') this.playSFX('victory');
            else this.playSFX('defeat');
        });
        this.eventBus.on('shopPurchase', () => this.playSFX('shopBuy'));
        this.eventBus.on('bossPhaseChange', () => this.playSFX('bossPhase'));
    }

    playSFX(name) {
        if (!this.initialized) this.init();
        if (this.sfx) this.sfx.play(name);
    }

    startMusic() {
        if (!this.initialized) this.init();
        if (this.music) this.music.playAmbient();
    }

    stopMusic() {
        if (this.music) this.music.stop();
    }
}
