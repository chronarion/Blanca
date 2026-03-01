import { Tile } from './Tile.js';
import { isInBounds, gridToKey } from '../util/GridUtil.js';
import { TERRAIN_TYPES } from '../data/Constants.js';

export class Board {
    constructor(cols = 8, rows = 8) {
        this.cols = cols;
        this.rows = rows;
        this.tiles = [];
        this.pieces = [];
        this.init();
    }

    init() {
        this.tiles = [];
        for (let r = 0; r < this.rows; r++) {
            const row = [];
            for (let c = 0; c < this.cols; c++) {
                row.push(new Tile(c, r));
            }
            this.tiles.push(row);
        }
        this.pieces = [];
    }

    getTile(col, row) {
        if (!isInBounds(col, row, this.cols, this.rows)) return null;
        return this.tiles[row][col];
    }

    getPieceAt(col, row) {
        const tile = this.getTile(col, row);
        return tile ? tile.piece : null;
    }

    placePiece(piece, col, row) {
        const tile = this.getTile(col, row);
        if (!tile) return false;
        tile.setPiece(piece);
        if (!this.pieces.includes(piece)) {
            this.pieces.push(piece);
        }
        return true;
    }

    removePiece(piece) {
        const tile = this.getTile(piece.col, piece.row);
        if (tile) tile.removePiece();
        const idx = this.pieces.indexOf(piece);
        if (idx !== -1) this.pieces.splice(idx, 1);
    }

    movePiece(piece, toCol, toRow) {
        const fromTile = this.getTile(piece.col, piece.row);
        const toTile = this.getTile(toCol, toRow);
        if (!fromTile || !toTile) return null;

        let captured = null;
        if (toTile.piece && toTile.piece.team !== piece.team) {
            captured = toTile.piece;
            this.removePiece(captured);
        }

        fromTile.removePiece();
        toTile.setPiece(piece);
        piece.hasMoved = true;
        piece.moveCount++;

        return captured;
    }

    getTeamPieces(team) {
        return this.pieces.filter(p => p.team === team);
    }

    findKing(team) {
        return this.pieces.find(p => p.team === team && p.type === 'king');
    }

    isSquareAttackedBy(col, row, attackingTeam, getMovesForPiece) {
        const attackers = this.getTeamPieces(attackingTeam);
        for (const piece of attackers) {
            const moves = getMovesForPiece(piece, true);
            if (moves.some(m => m.col === col && m.row === row)) {
                return true;
            }
        }
        return false;
    }

    clone() {
        const copy = new Board(this.cols, this.rows);
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                copy.tiles[r][c].terrain = this.tiles[r][c].terrain;
            }
        }
        for (const piece of this.pieces) {
            const cloned = piece.clone();
            copy.placePiece(cloned, cloned.col, cloned.row);
        }
        return copy;
    }

    setTerrain(col, row, terrain) {
        const tile = this.getTile(col, row);
        if (tile) tile.terrain = terrain;
    }

    getEmptyTiles() {
        const empty = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (tile.isEmpty() && tile.isPassable()) {
                    empty.push(tile);
                }
            }
        }
        return empty;
    }
}
