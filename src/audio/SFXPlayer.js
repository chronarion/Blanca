import { SoundGenerator } from './SoundGenerator.js';

export class SFXPlayer {
    constructor(audioCtx) {
        this.generator = new SoundGenerator(audioCtx);
        this.enabled = true;
    }

    play(sfxName) {
        if (!this.enabled) return;
        switch (sfxName) {
            case 'click': this.generator.playClick(); break;
            case 'move': this.generator.playMove(); break;
            case 'capture': this.generator.playCapture(); break;
            case 'promotion': this.generator.playPromotion(); break;
            case 'victory': this.generator.playVictory(); break;
            case 'defeat': this.generator.playDefeat(); break;
            case 'shopBuy': this.generator.playShopBuy(); break;
            case 'check': this.generator.playCheck(); break;
            case 'bossPhase': this.generator.playBossPhase(); break;
        }
    }
}
