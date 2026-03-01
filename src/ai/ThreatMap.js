import { MovementPattern } from '../pieces/MovementPattern.js';

export class ThreatMap {
    constructor(board) {
        this.board = board;
        this.threats = new Map(); // key -> [pieces that threaten this square]
        this.defenses = new Map(); // key -> [pieces that defend this square]
    }

    build(team) {
        this.threats.clear();
        this.defenses.clear();

        const pieces = this.board.getTeamPieces(team);
        for (const piece of pieces) {
            const moves = MovementPattern.getMoves(piece, this.board, true);
            for (const move of moves) {
                const key = `${move.col},${move.row}`;
                const target = this.board.getPieceAt(move.col, move.row);

                if (target && target.team === team) {
                    if (!this.defenses.has(key)) this.defenses.set(key, []);
                    this.defenses.get(key).push(piece);
                } else {
                    if (!this.threats.has(key)) this.threats.set(key, []);
                    this.threats.get(key).push(piece);
                }
            }
        }
    }

    isSquareThreatened(col, row) {
        return this.threats.has(`${col},${row}`);
    }

    getThreatsAt(col, row) {
        return this.threats.get(`${col},${row}`) || [];
    }

    isSquareDefended(col, row) {
        return this.defenses.has(`${col},${row}`);
    }

    getDefendersAt(col, row) {
        return this.defenses.get(`${col},${row}`) || [];
    }

    isPieceHanging(piece) {
        const key = `${piece.col},${piece.row}`;
        const threats = this.threats.get(key) || [];
        const defenders = this.defenses.get(key) || [];
        return threats.length > 0 && defenders.length === 0;
    }
}
