import { PIECE_TYPES, TEAMS, TERRAIN_TYPES } from '../data/Constants.js';
import { MODIFIERS } from '../data/ModifierData.js';
import { isInBounds } from '../util/GridUtil.js';

export class ModifierSystem {
    constructor(board, relics = []) {
        this.board = board;
        this.relics = relics;
    }

    applyModifier(piece, moves, mod) {
        switch (mod.id) {
            case 'knightKingMove':
                return this.addKingMoves(piece, moves);
            case 'pawnDiagonalMove':
                return this.addPawnDiagonalMoves(piece, moves);
            case 'bishopLeap':
                return this.addBishopLeapMoves(piece, moves);
            case 'pawnForwardCapture':
                return this.addPawnForwardCapture(piece, moves);
            case 'rookExtraRange':
                return this.addRookJumpMoves(piece, moves);
            case 'kingInspire':
                return this.addInspiredMoves(piece, moves);
            default:
                return moves;
        }
    }

    applyRelicEffects(piece, moves) {
        if (piece.type === PIECE_TYPES.PAWN && this.hasRelic('pawnForwardCapture')
            && !piece.hasModifier('pawnForwardCapture')) {
            moves = this.addPawnForwardCapture(piece, moves);
        }
        return moves;
    }

    addKingMoves(piece, moves) {
        const offsets = [
            [-1, -1], [0, -1], [1, -1],
            [-1, 0],           [1, 0],
            [-1, 1],  [0, 1],  [1, 1],
        ];

        for (const [dc, dr] of offsets) {
            const nc = piece.col + dc;
            const nr = piece.row + dr;
            if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) continue;
            const tile = this.board.getTile(nc, nr);
            if (!tile.isPassable()) continue;
            if (moves.some(m => m.col === nc && m.row === nr)) continue;

            if (tile.hasPiece()) {
                if (tile.piece.team !== piece.team) {
                    moves.push({ col: nc, row: nr, type: 'capture' });
                }
            } else {
                moves.push({ col: nc, row: nr, type: 'move' });
            }
        }

        return moves;
    }

    addPawnDiagonalMoves(piece, moves) {
        const dir = piece.team === TEAMS.PLAYER ? -1 : 1;
        for (const dc of [-1, 1]) {
            const nc = piece.col + dc;
            const nr = piece.row + dir;
            if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) continue;
            if (moves.some(m => m.col === nc && m.row === nr)) continue;
            const tile = this.board.getTile(nc, nr);
            if (tile.isEmpty() && tile.isPassable()) {
                moves.push({ col: nc, row: nr, type: 'move' });
            }
        }
        return moves;
    }

    addBishopLeapMoves(piece, moves) {
        const directions = [[-1,-1],[1,-1],[-1,1],[1,1]];

        for (const [dc, dr] of directions) {
            let nc = piece.col + dc;
            let nr = piece.row + dr;
            let leaped = false;

            while (isInBounds(nc, nr, this.board.cols, this.board.rows)) {
                const tile = this.board.getTile(nc, nr);
                if (!tile.isPassable()) break;

                if (tile.hasPiece()) {
                    if (!leaped && tile.piece.team === piece.team) {
                        leaped = true;
                        nc += dc;
                        nr += dr;
                        continue;
                    }
                    if (tile.piece.team !== piece.team) {
                        if (!moves.some(m => m.col === nc && m.row === nr)) {
                            moves.push({ col: nc, row: nr, type: 'capture' });
                        }
                    }
                    break;
                }

                if (!moves.some(m => m.col === nc && m.row === nr)) {
                    moves.push({ col: nc, row: nr, type: 'move' });
                }
                nc += dc;
                nr += dr;
            }
        }

        return moves;
    }

    addPawnForwardCapture(piece, moves) {
        const dir = piece.team === TEAMS.PLAYER ? -1 : 1;
        const nc = piece.col;
        const nr = piece.row + dir;
        if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) return moves;
        const tile = this.board.getTile(nc, nr);
        if (tile.hasPiece() && tile.piece.team !== piece.team) {
            if (!moves.some(m => m.col === nc && m.row === nr)) {
                moves.push({ col: nc, row: nr, type: 'capture' });
            }
        }
        return moves;
    }

    addRookJumpMoves(piece, moves) {
        // Rook can jump over the first blocking piece within 2 squares
        const directions = [[0,-1],[0,1],[-1,0],[1,0]];

        for (const [dc, dr] of directions) {
            let blocked = false;
            let jumpCount = 0;

            for (let dist = 1; dist < Math.max(this.board.cols, this.board.rows); dist++) {
                const nc = piece.col + dc * dist;
                const nr = piece.row + dr * dist;
                if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) break;
                const tile = this.board.getTile(nc, nr);
                if (!tile.isPassable()) break;

                if (tile.hasPiece()) {
                    if (!blocked && dist <= 2) {
                        // Jump over this piece within 2 squares
                        blocked = true;
                        jumpCount++;
                        if (jumpCount > 1) break;
                        continue;
                    }
                    // Can capture after jumping
                    if (blocked && tile.piece.team !== piece.team) {
                        if (!moves.some(m => m.col === nc && m.row === nr)) {
                            moves.push({ col: nc, row: nr, type: 'capture' });
                        }
                    }
                    break;
                }

                if (!moves.some(m => m.col === nc && m.row === nr)) {
                    moves.push({ col: nc, row: nr, type: 'move' });
                }
            }
        }

        return moves;
    }

    addInspiredMoves(piece, moves) {
        // King with inspire: adjacent friendly pieces gain +1 range
        // When applied to the king itself, it's a passive buff — but we process this
        // by checking in getModifiedMoves if a piece is adjacent to an inspired king
        return moves;
    }

    getModifiedMoves(piece, baseMoves) {
        let moves = [...baseMoves];

        for (const mod of piece.modifiers) {
            moves = this.applyModifier(piece, moves, mod);
        }

        // Apply relic-based global effects
        moves = this.applyRelicEffects(piece, moves);

        // King Inspire: check if any adjacent king has the modifier
        if (piece.type !== PIECE_TYPES.KING) {
            const king = this.board.getTeamPieces(piece.team).find(
                p => p.type === PIECE_TYPES.KING && p.hasModifier('kingInspire')
            );
            if (king) {
                const dx = Math.abs(piece.col - king.col);
                const dy = Math.abs(piece.row - king.row);
                if (dx <= 1 && dy <= 1) {
                    moves = this.extendMoveRange(piece, moves);
                }
            }
        }

        return moves;
    }

    extendMoveRange(piece, moves) {
        // Add +1 square in each direction the piece can already move
        const extended = [];
        for (const m of moves) {
            const dc = m.col - piece.col;
            const dr = m.row - piece.row;
            // Normalize direction
            const len = Math.max(Math.abs(dc), Math.abs(dr));
            if (len === 0) continue;
            const ndx = Math.sign(dc);
            const ndy = Math.sign(dr);
            const nc = m.col + ndx;
            const nr = m.row + ndy;
            if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) continue;
            if (moves.some(em => em.col === nc && em.row === nr)) continue;
            if (extended.some(em => em.col === nc && em.row === nr)) continue;
            const tile = this.board.getTile(nc, nr);
            if (!tile || !tile.isPassable()) continue;
            if (tile.hasPiece()) {
                if (tile.piece.team !== piece.team) {
                    extended.push({ col: nc, row: nr, type: 'capture' });
                }
            } else {
                extended.push({ col: nc, row: nr, type: 'move' });
            }
        }
        return [...moves, ...extended];
    }

    hasRelic(id) {
        return this.relics.some(r => r.id === id);
    }

    handlePostCapture(piece, capturedPiece) {
        const results = { extraMove: false };

        if (piece.hasModifier('bishopDoubleCapture') || piece.hasModifier('knightDoubleCapture')) {
            results.extraMove = true;
        }

        return results;
    }
}
