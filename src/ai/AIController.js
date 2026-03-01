import { TEAMS, PIECE_TYPES } from '../data/Constants.js';
import { PIECE_VALUES } from '../data/PieceData.js';
import { MovementPattern } from '../pieces/MovementPattern.js';
import { AIBehaviors } from './AIBehaviors.js';
import { ThreatMap } from './ThreatMap.js';

export class AIController {
    constructor(board, eventBus) {
        this.board = board;
        this.eventBus = eventBus;
        this.difficulty = 1; // 1-5
        this.threatMap = new ThreatMap(board);
        this.modifierSystem = null;
        this.relics = [];
        this.turnManager = null;
    }

    setDifficulty(level) {
        this.difficulty = Math.max(1, Math.min(5, level));
    }

    getBestMove(team = TEAMS.ENEMY) {
        const pieces = this.board.getTeamPieces(team);
        const enemyTeam = team === TEAMS.PLAYER ? TEAMS.ENEMY : TEAMS.PLAYER;
        this.threatMap.build(enemyTeam);

        let allMoves = [];

        // Leaden Crown relic: enemy king skips every other turn
        const enemySlowed = this.relics.some(r => r.id === 'enemySlowed');
        const turnNum = this.turnManager ? this.turnManager.turnNumber : 0;

        for (const piece of pieces) {
            if (piece.isFrozen) continue;
            // Skip king on even turns if enemySlowed is active
            if (enemySlowed && piece.type === PIECE_TYPES.KING && turnNum % 2 === 0) continue;

            const baseMoves = MovementPattern.getMoves(piece, this.board, false)
                .filter(m => m.type !== 'threat');
            const moves = this.modifierSystem
                ? this.modifierSystem.getModifiedMoves(piece, baseMoves)
                : baseMoves;

            for (const move of moves) {
                const score = AIBehaviors.evaluateMove(
                    piece, move, this.board, team, enemyTeam
                );
                allMoves.push({ piece, move, score });
            }
        }

        if (allMoves.length === 0) return null;

        // Sort by score
        allMoves.sort((a, b) => b.score - a.score);

        // Add randomness based on difficulty (lower difficulty = more random)
        if (this.difficulty < 5) {
            const topN = Math.max(1, Math.ceil(allMoves.length * (1 - this.difficulty * 0.22)));
            const candidates = allMoves.slice(0, topN);
            return candidates[Math.floor(Math.random() * candidates.length)];
        }

        return allMoves[0];
    }
}
