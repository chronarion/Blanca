import { TEAMS, PIECE_TYPES } from '../data/Constants.js';
import { PIECE_VALUES } from '../data/PieceData.js';
import { MovementPattern } from '../pieces/MovementPattern.js';
import { AIBehaviors } from './AIBehaviors.js';
import { Evaluator } from './Evaluator.js';
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

        // Leaden Crown relic: enemy king skips every other turn
        const enemySlowed = this.relics.some(r => r.id === 'enemySlowed');
        const turnNum = this.turnManager ? this.turnManager.turnNumber : 0;

        // At difficulty 3+, use minimax for real lookahead
        if (this.difficulty >= 3) {
            const depth = this.difficulty >= 5 ? 3 : 2;
            const result = Evaluator.minimax(this.board, depth, true, team);
            if (result && result.piece && result.move) {
                // Verify the piece isn't frozen or slowed
                if (!result.piece.isFrozen) {
                    if (!(enemySlowed && result.piece.type === PIECE_TYPES.KING && turnNum % 2 === 0)) {
                        return result;
                    }
                }
            }
        }

        // Heuristic evaluation for all difficulties (and fallback for minimax)
        let allMoves = [];

        for (const piece of pieces) {
            if (piece.isFrozen) continue;
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

        // Difficulty 1: pick from top 3 moves (slight randomness, but still competent)
        if (this.difficulty <= 1) {
            const candidates = allMoves.slice(0, Math.min(3, allMoves.length));
            return candidates[Math.floor(Math.random() * candidates.length)];
        }

        // Difficulty 2+: always pick the best-scored move
        return allMoves[0];
    }
}
