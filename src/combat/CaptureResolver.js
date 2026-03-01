import { PIECE_TYPES, TERRAIN_TYPES } from '../data/Constants.js';

export class CaptureResolver {
    constructor(board, eventBus) {
        this.board = board;
        this.eventBus = eventBus;
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

        // Check modifier-based protections
        for (const mod of target.modifiers) {
            if (mod.type === 'protection') {
                if (mod.id === 'sideProtection') {
                    if (attacker.col !== targetCol && attacker.row === targetRow) {
                        return false;
                    }
                }
                if (mod.id === 'firstTurnProtection' && target.moveCount <= 1) {
                    return false;
                }
            }
        }

        return true;
    }

    resolveCapture(attacker, target) {
        this.board.removePiece(target);
        this.eventBus.emit('pieceCaptured', {
            captured: target,
            capturedBy: attacker,
            col: target.col,
            row: target.row,
        });

        // Check for queen split modifier/relic
        if (target.type === PIECE_TYPES.QUEEN) {
            for (const mod of target.modifiers) {
                if (mod.id === 'queenSplit') {
                    this.eventBus.emit('queenSplit', { queen: target });
                }
            }
        }

        return target;
    }

    getGoldValue(piece) {
        return 1;
    }
}
