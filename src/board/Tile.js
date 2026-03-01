import { TERRAIN_TYPES } from '../data/Constants.js';

export class Tile {
    constructor(col, row) {
        this.col = col;
        this.row = row;
        this.piece = null;
        this.terrain = TERRAIN_TYPES.NONE;
        this.isLight = (col + row) % 2 === 0;
    }

    isEmpty() {
        return this.piece === null;
    }

    hasPiece() {
        return this.piece !== null;
    }

    isPassable() {
        return this.terrain !== TERRAIN_TYPES.VOID;
    }

    setPiece(piece) {
        this.piece = piece;
        if (piece) {
            piece.col = this.col;
            piece.row = this.row;
        }
    }

    removePiece() {
        const piece = this.piece;
        this.piece = null;
        return piece;
    }
}
