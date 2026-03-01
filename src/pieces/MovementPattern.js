import { PIECE_TYPES, TEAMS, TERRAIN_TYPES } from '../data/Constants.js';
import { isInBounds } from '../util/GridUtil.js';

export class MovementPattern {
    static getMoves(piece, board, capturesOnly = false) {
        switch (piece.type) {
            case PIECE_TYPES.PAWN: return this.getPawnMoves(piece, board, capturesOnly);
            case PIECE_TYPES.KNIGHT: return this.getKnightMoves(piece, board, capturesOnly);
            case PIECE_TYPES.BISHOP: return this.getBishopMoves(piece, board, capturesOnly);
            case PIECE_TYPES.ROOK: return this.getRookMoves(piece, board, capturesOnly);
            case PIECE_TYPES.QUEEN: return this.getQueenMoves(piece, board, capturesOnly);
            case PIECE_TYPES.KING: return this.getKingMoves(piece, board, capturesOnly);
            default: return [];
        }
    }

    static getPawnMoves(piece, board, capturesOnly) {
        const moves = [];
        const direction = piece.team === TEAMS.PLAYER ? -1 : 1;
        const { col, row } = piece;

        if (!capturesOnly) {
            const fwd = row + direction;
            if (isInBounds(col, fwd, board.cols, board.rows)) {
                const tile = board.getTile(col, fwd);
                if (tile.isEmpty() && tile.isPassable()) {
                    moves.push({ col, row: fwd, type: 'move' });

                    if (!piece.hasMoved) {
                        const fwd2 = row + direction * 2;
                        if (isInBounds(col, fwd2, board.cols, board.rows)) {
                            const tile2 = board.getTile(col, fwd2);
                            if (tile2.isEmpty() && tile2.isPassable()) {
                                moves.push({ col, row: fwd2, type: 'move' });
                            }
                        }
                    }
                }
            }
        }

        for (const dc of [-1, 1]) {
            const nc = col + dc;
            const nr = row + direction;
            if (isInBounds(nc, nr, board.cols, board.rows)) {
                const tile = board.getTile(nc, nr);
                if (tile.isPassable()) {
                    if (tile.hasPiece() && tile.piece.team !== piece.team) {
                        moves.push({ col: nc, row: nr, type: 'capture' });
                    } else if (capturesOnly) {
                        moves.push({ col: nc, row: nr, type: 'threat' });
                    }
                }
            }
        }

        return moves;
    }

    static getKnightMoves(piece, board, capturesOnly) {
        const moves = [];
        const offsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1],
        ];

        for (const [dc, dr] of offsets) {
            const nc = piece.col + dc;
            const nr = piece.row + dr;
            if (!isInBounds(nc, nr, board.cols, board.rows)) continue;
            const tile = board.getTile(nc, nr);
            if (!tile.isPassable()) continue;
            if (tile.hasPiece()) {
                if (tile.piece.team !== piece.team) {
                    moves.push({ col: nc, row: nr, type: 'capture' });
                }
            } else if (!capturesOnly) {
                moves.push({ col: nc, row: nr, type: 'move' });
            } else {
                moves.push({ col: nc, row: nr, type: 'threat' });
            }
        }

        return moves;
    }

    static getSlidingMoves(piece, board, directions, capturesOnly) {
        const moves = [];

        for (const [dc, dr] of directions) {
            let nc = piece.col + dc;
            let nr = piece.row + dr;

            while (isInBounds(nc, nr, board.cols, board.rows)) {
                const tile = board.getTile(nc, nr);
                if (!tile.isPassable()) break;

                if (tile.hasPiece()) {
                    if (tile.piece.team !== piece.team) {
                        moves.push({ col: nc, row: nr, type: 'capture' });
                    }
                    break;
                }

                if (!capturesOnly) {
                    moves.push({ col: nc, row: nr, type: 'move' });
                } else {
                    moves.push({ col: nc, row: nr, type: 'threat' });
                }
                nc += dc;
                nr += dr;
            }
        }

        return moves;
    }

    static getBishopMoves(piece, board, capturesOnly) {
        return this.getSlidingMoves(piece, board, [[-1,-1],[1,-1],[-1,1],[1,1]], capturesOnly);
    }

    static getRookMoves(piece, board, capturesOnly) {
        return this.getSlidingMoves(piece, board, [[0,-1],[0,1],[-1,0],[1,0]], capturesOnly);
    }

    static getQueenMoves(piece, board, capturesOnly) {
        return this.getSlidingMoves(piece, board, [
            [-1,-1],[1,-1],[-1,1],[1,1],
            [0,-1],[0,1],[-1,0],[1,0],
        ], capturesOnly);
    }

    static getKingMoves(piece, board, capturesOnly) {
        const moves = [];
        const offsets = [
            [-1, -1], [0, -1], [1, -1],
            [-1, 0],           [1, 0],
            [-1, 1],  [0, 1],  [1, 1],
        ];

        for (const [dc, dr] of offsets) {
            const nc = piece.col + dc;
            const nr = piece.row + dr;
            if (!isInBounds(nc, nr, board.cols, board.rows)) continue;
            const tile = board.getTile(nc, nr);
            if (!tile.isPassable()) continue;

            if (tile.hasPiece()) {
                if (tile.piece.team !== piece.team) {
                    moves.push({ col: nc, row: nr, type: 'capture' });
                }
            } else if (!capturesOnly) {
                moves.push({ col: nc, row: nr, type: 'move' });
            } else {
                moves.push({ col: nc, row: nr, type: 'threat' });
            }
        }

        return moves;
    }
}
