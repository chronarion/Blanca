import { MovementPattern } from '../pieces/MovementPattern.js';
import { PIECE_TYPES } from '../data/Constants.js';

export class CheckDetector {
    constructor(board) {
        this.board = board;
    }

    isKingInCheck(team) {
        const king = this.board.findKing(team);
        if (!king) return false;

        const enemyTeam = team === 'player' ? 'enemy' : 'player';
        return this.isSquareAttacked(king.col, king.row, enemyTeam);
    }

    isSquareAttacked(col, row, byTeam) {
        const pieces = this.board.getTeamPieces(byTeam);
        for (const piece of pieces) {
            const moves = MovementPattern.getMoves(piece, this.board, true);
            if (moves.some(m => m.col === col && m.row === row)) {
                return true;
            }
        }
        return false;
    }

    getAttackersOfSquare(col, row, byTeam) {
        const attackers = [];
        const pieces = this.board.getTeamPieces(byTeam);
        for (const piece of pieces) {
            const moves = MovementPattern.getMoves(piece, this.board, true);
            if (moves.some(m => m.col === col && m.row === row)) {
                attackers.push(piece);
            }
        }
        return attackers;
    }

    wouldMoveCauseCheck(piece, toCol, toRow, team) {
        const boardCopy = this.board.clone();
        const pieceCopy = boardCopy.getPieceAt(piece.col, piece.row);
        if (!pieceCopy) return false;
        boardCopy.movePiece(pieceCopy, toCol, toRow);

        const king = boardCopy.findKing(team);
        if (!king) return false;

        const enemyTeam = team === 'player' ? 'enemy' : 'player';
        const enemies = boardCopy.getTeamPieces(enemyTeam);
        for (const enemy of enemies) {
            const moves = MovementPattern.getMoves(enemy, boardCopy, true);
            if (moves.some(m => m.col === king.col && m.row === king.row)) {
                return true;
            }
        }
        return false;
    }

    hasLegalMoves(team) {
        const pieces = this.board.getTeamPieces(team);
        for (const piece of pieces) {
            if (piece.isFrozen) continue;
            const moves = MovementPattern.getMoves(piece, this.board, false);
            for (const move of moves) {
                if (move.type === 'threat') continue;
                if (!this.wouldMoveCauseCheck(piece, move.col, move.row, team)) {
                    return true;
                }
            }
        }
        return false;
    }
}
