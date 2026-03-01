import { EventBus } from './EventBus.js';
import { GameLoop } from './GameLoop.js';
import { StateMachine } from './StateMachine.js';
import { InputManager } from './InputManager.js';
import { Renderer } from '../render/Renderer.js';
import { AudioManager } from '../audio/AudioManager.js';
import { SaveManager } from '../save/SaveManager.js';
import { RunManager } from '../progression/RunManager.js';
import { EffectsRenderer } from '../render/EffectsRenderer.js';

// States
import { MainMenuState } from '../states/MainMenuState.js';
import { ArmySelectState } from '../states/ArmySelectState.js';
import { MapState } from '../states/MapState.js';
import { CombatState } from '../states/CombatState.js';
import { ShopState } from '../states/ShopState.js';
import { EventState } from '../states/EventState.js';
import { BossIntroState } from '../states/BossIntroState.js';
import { VictoryState } from '../states/VictoryState.js';
import { GameOverState } from '../states/GameOverState.js';
import { PauseState } from '../states/PauseState.js';
import { SettingsState } from '../states/SettingsState.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.eventBus = new EventBus();
        this.renderer = new Renderer(canvas);
        this.input = new InputManager(canvas, this.eventBus);
        this.stateMachine = new StateMachine(this.eventBus);
        this.audioManager = new AudioManager(this.eventBus);
        this.saveManager = new SaveManager();
        this.runManager = new RunManager(this.eventBus);
        this.effects = new EffectsRenderer(this.eventBus);

        this.loop = new GameLoop(
            dt => this.update(dt),
            () => this.render()
        );

        this.setupStates();
        this.setupRunEvents();
    }

    setupStates() {
        const states = {
            mainMenu: new MainMenuState(),
            armySelect: new ArmySelectState(),
            map: new MapState(),
            combat: new CombatState(),
            shop: new ShopState(),
            event: new EventState(),
            bossIntro: new BossIntroState(),
            victory: new VictoryState(),
            gameOver: new GameOverState(),
            pause: new PauseState(),
            settings: new SettingsState(),
        };

        for (const [name, state] of Object.entries(states)) {
            state.renderer = this.renderer;
            state.runManager = this.runManager;
            state.saveManager = this.saveManager;
            state.audioManager = this.audioManager;
            this.stateMachine.add(name, state);
        }
    }

    setupRunEvents() {
        this.eventBus.on('combatEnd', (data) => {
            if (data.winner === 'player') {
                this.audioManager.playSFX('victory');
            } else {
                this.audioManager.playSFX('defeat');
            }
        });

        this.eventBus.on('combatFinished', (data) => {
            if (data.victory) {
                const rewards = this.runManager.onBattleWon(data);
                this.saveManager.save(this.runManager.serialize());
                this.stateMachine.change('map', { goldGained: data.goldEarned || 0 });
            } else {
                // onBattleLost emits 'runEnded' which handles the state change
                this.runManager.onBattleLost();
            }
        });

        this.eventBus.on('runEnded', (data) => {
            this.saveManager.deleteSave();
            if (data.victory) {
                this.stateMachine.change('victory', { stats: data.stats });
            } else {
                this.stateMachine.change('gameOver', { stats: data.stats });
            }
        });
    }

    start() {
        this.stateMachine.change('mainMenu');
        this.loop.start();
    }

    update(dt) {
        this.stateMachine.update(dt);
        this.effects.update(dt);
    }

    render() {
        this.renderer.clear();
        const ctx = this.renderer.context;
        this.stateMachine.render(ctx);
        this.effects.render(ctx);
    }
}
