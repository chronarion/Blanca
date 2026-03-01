import { TEAMS } from '../data/Constants.js';

export class TurnManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.currentTeam = TEAMS.PLAYER;
        this.turnNumber = 0;
        this.extraTurns = 0;
        this.consecutiveCaptures = 0;
    }

    reset() {
        this.currentTeam = TEAMS.PLAYER;
        this.turnNumber = 0;
        this.extraTurns = 0;
        this.consecutiveCaptures = 0;
    }

    get isPlayerTurn() {
        return this.currentTeam === TEAMS.PLAYER;
    }

    nextTurn() {
        if (this.extraTurns > 0) {
            this.extraTurns--;
            this.eventBus.emit('extraTurn', { team: this.currentTeam });
            return;
        }

        this.currentTeam = this.currentTeam === TEAMS.PLAYER ? TEAMS.ENEMY : TEAMS.PLAYER;
        this.turnNumber++;
        this.eventBus.emit('turnChanged', {
            team: this.currentTeam,
            turn: this.turnNumber,
        });
    }

    grantExtraTurn(count = 1) {
        this.extraTurns += count;
    }

    onCapture() {
        this.consecutiveCaptures++;
    }

    onNonCapture() {
        this.consecutiveCaptures = 0;
    }

    getConsecutiveCaptures() {
        return this.consecutiveCaptures;
    }
}
