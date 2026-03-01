import { Board } from '../board/Board.js';
import { TurnManager } from './TurnManager.js';
import { CaptureResolver } from './CaptureResolver.js';
import { CheckDetector } from './CheckDetector.js';
import { AIController } from '../ai/AIController.js';
import { MovementPattern } from '../pieces/MovementPattern.js';
import { ModifierSystem } from '../pieces/ModifierSystem.js';
import { TEAMS, PIECE_TYPES, TERRAIN_TYPES } from '../data/Constants.js';

export class CombatManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.board = null;
        this.turnManager = new TurnManager(eventBus);
        this.captureResolver = null;
        this.checkDetector = null;
        this.ai = null;

        this.capturedByPlayer = [];
        this.capturedByEnemy = [];
        this.goldEarned = 0;
        this.gameOver = false;
        this.winner = null;

        this.relics = [];
        this.modifierSystem = null;
    }

    initBattle(board, options = {}) {
        this.board = board;
        this.captureResolver = new CaptureResolver(board, this.eventBus);
        this.checkDetector = new CheckDetector(board);
        this.ai = new AIController(board, this.eventBus);
        this.ai.setDifficulty(options.difficulty || 2);

        this.turnManager.reset();
        this.capturedByPlayer = [];
        this.capturedByEnemy = [];
        this.goldEarned = 0;
        this.gameOver = false;
        this.winner = null;
        this.relics = options.relics || [];
        this.armyAbility = options.armyAbility || null;

        // Create modifier system and pass to AI
        this.modifierSystem = new ModifierSystem(board, this.relics);
        this.ai.modifierSystem = this.modifierSystem;
        this.ai.relics = this.relics;
        this.ai.turnManager = this.turnManager;

        // Grant free move relic
        if (this.hasRelic('freeMove')) {
            this.turnManager.grantExtraTurn(1);
        }
    }

    getLegalMoves(piece) {
        if (piece.isFrozen) return [];
        const rawMoves = MovementPattern.getMoves(piece, this.board, false)
            .filter(m => m.type !== 'threat');

        return this.modifierSystem
            ? this.modifierSystem.getModifiedMoves(piece, rawMoves)
            : rawMoves;
    }

    executeMove(piece, toCol, toRow, moveData = {}) {
        const fromCol = piece.col;
        const fromRow = piece.row;
        const target = this.board.getPieceAt(toCol, toRow);
        let captured = null;

        // Handle castling
        if (moveData.type === 'castle') {
            const rook = this.board.getPieceAt(moveData.rookFromCol, piece.row);
            if (rook) {
                // Move king
                const kingFrom = this.board.getTile(fromCol, fromRow);
                const kingTo = this.board.getTile(toCol, toRow);
                kingFrom.removePiece();
                kingTo.setPiece(piece);
                piece.hasMoved = true;
                piece.moveCount++;

                // Move rook
                const rookFrom = this.board.getTile(moveData.rookFromCol, piece.row);
                const rookTo = this.board.getTile(moveData.rookToCol, piece.row);
                rookFrom.removePiece();
                rookTo.setPiece(rook);
                rook.hasMoved = true;
                rook.moveCount++;

                return {
                    success: true,
                    piece,
                    from: { col: fromCol, row: fromRow },
                    to: { col: toCol, row: toRow },
                    captured: null,
                    promoted: false,
                    extraTurn: false,
                    castle: {
                        rook,
                        rookFrom: { col: moveData.rookFromCol, row: piece.row },
                        rookTo: { col: moveData.rookToCol, row: piece.row },
                    },
                };
            }
        }

        if (target && target.team !== piece.team) {
            if (!this.captureResolver.canCapture(piece, toCol, toRow)) {
                return { success: false, reason: 'protected' };
            }
            captured = this.captureResolver.resolveCapture(piece, target);
        }

        // Move the piece
        const fromTile = this.board.getTile(fromCol, fromRow);
        const toTile = this.board.getTile(toCol, toRow);
        fromTile.removePiece();
        toTile.setPiece(piece);
        piece.hasMoved = true;
        piece.moveCount++;

        const result = {
            success: true,
            piece,
            from: { col: fromCol, row: fromRow },
            to: { col: toCol, row: toRow },
            captured,
            promoted: false,
            extraTurn: false,
        };

        if (captured) {
            if (piece.team === TEAMS.PLAYER) {
                this.capturedByPlayer.push(captured);
                this.goldEarned += this.captureResolver.getGoldValue(captured);
            } else {
                this.capturedByEnemy.push(captured);
            }
            this.turnManager.onCapture();

            if (captured.type === PIECE_TYPES.KING) {
                this.endBattle(piece.team);
                result.kingCaptured = true;
                return result;
            }

            // Check 3-in-a-row capture relic
            if (this.hasRelic('captureStreak') && this.turnManager.getConsecutiveCaptures() >= 3) {
                this.turnManager.grantExtraTurn(1);
                result.extraTurn = true;
                this.turnManager.consecutiveCaptures = 0;
            }

            // Post-capture modifier effects (e.g. knight/bishop double capture)
            if (this.modifierSystem) {
                const postCapture = this.modifierSystem.handlePostCapture(piece, captured);
                if (postCapture.extraMove) {
                    this.turnManager.grantExtraTurn(1);
                    result.extraTurn = true;
                }
            }
        } else {
            this.turnManager.onNonCapture();
        }

        // Terrain effects
        const landedTile = this.board.getTile(toCol, toRow);
        if (landedTile.terrain === TERRAIN_TYPES.BRAMBLE) {
            piece.isFrozen = true;
        }
        if (landedTile.terrain === TERRAIN_TYPES.ICE) {
            result.iceSlide = this.applyIceSlide(piece, toCol - fromCol, toRow - fromRow);
        }

        // Pawn promotion check
        if (piece.type === PIECE_TYPES.PAWN) {
            const promoRow = piece.team === TEAMS.PLAYER ? 0 : this.board.rows - 1;
            let promoRank = promoRow;
            // Check relic or army ability for early promotion
            if ((this.hasRelic('earlyPromotion') || this.armyAbility === 'earlyPromotion') && piece.team === TEAMS.PLAYER) {
                promoRank = 1;
            }
            if ((piece.team === TEAMS.PLAYER && toRow <= promoRank) ||
                (piece.team === TEAMS.ENEMY && toRow >= promoRank)) {
                result.needsPromotion = true;
            }

            // Altar terrain
            if (landedTile.terrain === TERRAIN_TYPES.ALTAR) {
                result.needsPromotion = true;
            }
        }

        return result;
    }

    applyIceSlide(piece, dx, dy) {
        if (dx === 0 && dy === 0) return null;
        const dirCol = dx === 0 ? 0 : dx > 0 ? 1 : -1;
        const dirRow = dy === 0 ? 0 : dy > 0 ? 1 : -1;
        const slideCol = piece.col + dirCol;
        const slideRow = piece.row + dirRow;

        const tile = this.board.getTile(slideCol, slideRow);
        if (tile && tile.isEmpty() && tile.isPassable()) {
            const fromTile = this.board.getTile(piece.col, piece.row);
            fromTile.removePiece();
            tile.setPiece(piece);
            return { col: slideCol, row: slideRow };
        }
        return null;
    }

    promotePiece(piece, newType) {
        piece.promote(newType);
        this.eventBus.emit('piecePromoted', { piece, newType });
    }

    endTurn() {
        // Unfreeze this team's pieces at start of their turn
        const currentPieces = this.board.getTeamPieces(this.turnManager.currentTeam);
        for (const p of currentPieces) {
            if (p.isFrozen) p.isFrozen = false;
        }

        this.turnManager.nextTurn();
    }

    getAIMove() {
        if (!this.ai) return null;
        return this.ai.getBestMove(TEAMS.ENEMY);
    }

    endBattle(winnerTeam) {
        this.gameOver = true;
        this.winner = winnerTeam;
        this.eventBus.emit('combatEnd', {
            winner: winnerTeam,
            capturedByPlayer: this.capturedByPlayer,
            capturedByEnemy: this.capturedByEnemy,
            goldEarned: this.goldEarned,
            turns: this.turnManager.turnNumber,
        });
    }

    isKingInCheck(team) {
        return this.checkDetector ? this.checkDetector.isKingInCheck(team) : false;
    }

    hasRelic(relicId) {
        return this.relics.some(r => r.id === relicId);
    }
}
