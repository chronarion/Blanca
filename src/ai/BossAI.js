import { TEAMS, PIECE_TYPES } from '../data/Constants.js';
import { Evaluator } from './Evaluator.js';
import { MovementPattern } from '../pieces/MovementPattern.js';
import { Piece } from '../pieces/Piece.js';
import { PIECE_VALUES } from '../data/PieceData.js';

export class BossAI {
    constructor(board, eventBus, bossData) {
        this.board = board;
        this.eventBus = eventBus;
        this.bossData = bossData;
        this.currentPhase = 0;
        this.phaseTriggered = new Set([0]);
    }

    checkPhaseTransition() {
        const phases = this.bossData.phases;
        for (let i = this.currentPhase + 1; i < phases.length; i++) {
            if (this.phaseTriggered.has(i)) continue;
            const phase = phases[i];

            if (phase.triggerCondition === 'piecesRemaining') {
                const enemyCount = this.board.getTeamPieces(TEAMS.ENEMY).length;
                if (enemyCount <= phase.triggerValue) {
                    this.triggerPhase(i);
                    return true;
                }
            }
        }
        return false;
    }

    triggerPhase(phaseIndex) {
        const phase = this.bossData.phases[phaseIndex];
        this.currentPhase = phaseIndex;
        this.phaseTriggered.add(phaseIndex);

        // Add new pieces
        if (phase.addPieces) {
            for (const p of phase.addPieces) {
                const tile = this.board.getTile(p.col, p.row);
                if (tile && tile.isEmpty()) {
                    const piece = new Piece(p.type, TEAMS.ENEMY, p.col, p.row);
                    this.board.placePiece(piece, p.col, p.row);
                }
            }
        }

        // Add terrain
        if (phase.addTerrain) {
            for (const t of phase.addTerrain) {
                this.board.setTerrain(t.col, t.row, t.terrain);
            }
        }

        // Remove terrain
        if (phase.removeTerrain) {
            for (const t of phase.removeTerrain) {
                this.board.setTerrain(t.col, t.row, 'none');
            }
        }

        this.eventBus.emit('bossPhaseChange', {
            phase: phaseIndex,
            name: phase.name,
        });
    }

    getBestMove() {
        // Boss uses deeper search than regular AI
        const depth = this.currentPhase >= 2 ? 3 : 2;

        // Use minimax for smarter play
        const result = Evaluator.minimax(this.board, depth, true, TEAMS.ENEMY);

        if (result && result.piece && result.move) {
            return result;
        }

        // Fallback: basic evaluation
        return this.getFallbackMove();
    }

    getFallbackMove() {
        const pieces = this.board.getTeamPieces(TEAMS.ENEMY);
        let bestMove = null;
        let bestScore = -Infinity;

        for (const piece of pieces) {
            if (piece.isFrozen) continue;
            const moves = MovementPattern.getMoves(piece, this.board, false)
                .filter(m => m.type !== 'threat');

            for (const move of moves) {
                let score = Math.random() * 5;

                if (move.type === 'capture') {
                    const target = this.board.getPieceAt(move.col, move.row);
                    if (target) score += PIECE_VALUES[target.type] * 100;
                }

                const playerKing = this.board.findKing(TEAMS.PLAYER);
                if (playerKing) {
                    const dist = Math.abs(move.col - playerKing.col) + Math.abs(move.row - playerKing.row);
                    score += (20 - dist) * 3;
                }

                // Boss protects its own king more
                const ownKing = this.board.findKing(TEAMS.ENEMY);
                if (ownKing && piece.type !== PIECE_TYPES.KING) {
                    const distToOwnKing = Math.abs(move.col - ownKing.col) + Math.abs(move.row - ownKing.row);
                    if (distToOwnKing <= 2) score += 10;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { piece, move, score };
                }
            }
        }

        return bestMove;
    }
}
