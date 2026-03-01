import { Piece } from './Piece.js';
import { PIECE_TYPES, TEAMS } from '../data/Constants.js';

export class PieceFactory {
    static create(type, team, col = 0, row = 0) {
        return new Piece(type, team, col, row);
    }

    static createFromData(data) {
        return Piece.deserialize(data);
    }

    static createArmy(pieces, team) {
        return pieces.map(p => {
            const piece = new Piece(p.type, team, p.col, p.row);
            if (p.modifiers) {
                for (const mod of p.modifiers) {
                    piece.addModifier(mod);
                }
            }
            return piece;
        });
    }

    static createStandardRow(team, row, cols) {
        const pieces = [];
        const mid = Math.floor(cols / 2);

        const layout = [
            { type: PIECE_TYPES.ROOK, offset: -4 },
            { type: PIECE_TYPES.KNIGHT, offset: -3 },
            { type: PIECE_TYPES.BISHOP, offset: -2 },
            { type: PIECE_TYPES.QUEEN, offset: -1 },
            { type: PIECE_TYPES.KING, offset: 0 },
            { type: PIECE_TYPES.BISHOP, offset: 1 },
            { type: PIECE_TYPES.KNIGHT, offset: 2 },
            { type: PIECE_TYPES.ROOK, offset: 3 },
        ];

        for (const p of layout) {
            const col = mid + p.offset;
            if (col >= 0 && col < cols) {
                pieces.push(PieceFactory.create(p.type, team, col, row));
            }
        }

        return pieces;
    }

    static createPawnRow(team, row, cols) {
        const pieces = [];
        for (let c = 0; c < cols; c++) {
            pieces.push(PieceFactory.create(PIECE_TYPES.PAWN, team, c, row));
        }
        return pieces;
    }
}
