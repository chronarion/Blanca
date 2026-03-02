import { PIECE_TYPES, TERRAIN_TYPES } from '../data/Constants.js';

export class CaptureResolver {
    constructor(board, eventBus) {
        this.board = board;
        this.eventBus = eventBus;
        this.modifierSystem = null;
        this.rng = Math;
    }

    canCapture(attacker, targetCol, targetRow) {
        const target = this.board.getPieceAt(targetCol, targetRow);
        if (!target) return false;
        if (target.team === attacker.team) return false;

        // Check terrain protection
        const tile = this.board.getTile(targetCol, targetRow);
        if (tile.terrain === TERRAIN_TYPES.FORTRESS) {
            return false;
        }

        // Delegate to modifier system for protection checks
        if (this.modifierSystem) {
            return this.modifierSystem.canBeCaptured(target, attacker);
        }

        return true;
    }

    resolveCapture(attacker, target) {
        // Gambler's Fate: 50% chance to survive
        if (target.hasModifier('gamblersFate') && !attacker.hasModifier('glasscannon')) {
            if (this.rng.random() < 0.5) {
                this.eventBus.emit('gamblersFateSurvived', {
                    piece: target,
                    attacker,
                });
                return null; // Capture fails, target survives
            }
        }

        this.board.removePiece(target);
        this.eventBus.emit('pieceCaptured', {
            captured: target,
            capturedBy: attacker,
            col: target.col,
            row: target.row,
        });

        return target;
    }

    resolveExplosion(attacker, adjacentEnemies) {
        const removed = [];
        for (const enemy of adjacentEnemies) {
            if (enemy.type === PIECE_TYPES.KING) continue; // Don't auto-remove kings
            this.board.removePiece(enemy);
            removed.push(enemy);
            this.eventBus.emit('pieceCaptured', {
                captured: enemy,
                capturedBy: attacker,
                col: enemy.col,
                row: enemy.row,
                explosive: true,
            });
        }
        return removed;
    }

    getGoldValue(piece) {
        return 1;
    }
}
