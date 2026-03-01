import { Piece } from '../pieces/Piece.js';
import { PIECE_TYPES, TEAMS, ROSTER_LIMIT } from '../data/Constants.js';

export class RecruitmentSystem {
    constructor(eventBus) {
        this.eventBus = eventBus;
    }

    canRecruit(roster) {
        return roster.length < ROSTER_LIMIT;
    }

    recruitPiece(roster, type) {
        if (!this.canRecruit(roster)) return null;
        const piece = new Piece(type, TEAMS.PLAYER);
        roster.push(piece);
        this.eventBus.emit('pieceRecruited', { piece });
        return piece;
    }

    removePiece(roster, pieceId) {
        const idx = roster.findIndex(p => p.id === pieceId);
        if (idx === -1) return null;
        const removed = roster.splice(idx, 1)[0];
        this.eventBus.emit('pieceRemoved', { piece: removed });
        return removed;
    }

    getDeployablePieces(roster, maxDeploy) {
        // King always deploys
        const king = roster.find(p => p.type === PIECE_TYPES.KING);
        const others = roster.filter(p => p.type !== PIECE_TYPES.KING);

        // Auto-deploy: take the strongest pieces up to maxDeploy
        const sorted = others.sort((a, b) => this.pieceValue(b) - this.pieceValue(a));
        const deployed = king ? [king] : [];
        for (const p of sorted) {
            if (deployed.length >= maxDeploy) break;
            deployed.push(p);
        }
        return deployed;
    }

    pieceValue(piece) {
        const values = {
            [PIECE_TYPES.QUEEN]: 9,
            [PIECE_TYPES.ROOK]: 5,
            [PIECE_TYPES.BISHOP]: 3,
            [PIECE_TYPES.KNIGHT]: 3,
            [PIECE_TYPES.PAWN]: 1,
            [PIECE_TYPES.KING]: 100,
        };
        let val = values[piece.type] || 0;
        val += piece.modifiers.length * 2;
        return val;
    }
}
