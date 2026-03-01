import { PIECE_TYPES, PIECE_COLORS, TEAMS } from '../data/Constants.js';

export class PieceRenderer {
    static draw(ctx, piece, x, y, size) {
        const isPlayer = piece.team === TEAMS.PLAYER;
        const fill = isPlayer ? PIECE_COLORS.player : PIECE_COLORS.enemy;
        const stroke = isPlayer ? PIECE_COLORS.playerOutline : PIECE_COLORS.enemyOutline;
        const center = size / 2;
        const scale = size / 80;

        ctx.save();
        ctx.translate(x, y);

        switch (piece.type) {
            case PIECE_TYPES.PAWN: this.drawPawn(ctx, center, scale, fill, stroke); break;
            case PIECE_TYPES.KNIGHT: this.drawKnight(ctx, center, scale, fill, stroke); break;
            case PIECE_TYPES.BISHOP: this.drawBishop(ctx, center, scale, fill, stroke); break;
            case PIECE_TYPES.ROOK: this.drawRook(ctx, center, scale, fill, stroke); break;
            case PIECE_TYPES.QUEEN: this.drawQueen(ctx, center, scale, fill, stroke); break;
            case PIECE_TYPES.KING: this.drawKing(ctx, center, scale, fill, stroke); break;
        }

        if (piece.modifiers.length > 0) {
            this.drawModifierIndicator(ctx, size, scale);
        }

        ctx.restore();
    }

    static drawPawn(ctx, c, s, fill, stroke) {
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2 * s;

        ctx.beginPath();
        ctx.arc(c, c - 10 * s, 10 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(c - 14 * s, c + 22 * s);
        ctx.lineTo(c - 8 * s, c);
        ctx.lineTo(c + 8 * s, c);
        ctx.lineTo(c + 14 * s, c + 22 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(c - 18 * s, c + 26 * s);
        ctx.lineTo(c + 18 * s, c + 26 * s);
        ctx.lineTo(c + 16 * s, c + 22 * s);
        ctx.lineTo(c - 16 * s, c + 22 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    static drawKnight(ctx, c, s, fill, stroke) {
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2 * s;

        ctx.beginPath();
        ctx.moveTo(c - 6 * s, c - 22 * s);
        ctx.quadraticCurveTo(c - 18 * s, c - 16 * s, c - 16 * s, c - 2 * s);
        ctx.quadraticCurveTo(c - 18 * s, c + 8 * s, c - 10 * s, c + 14 * s);
        ctx.lineTo(c - 16 * s, c + 22 * s);
        ctx.lineTo(c + 16 * s, c + 22 * s);
        ctx.lineTo(c + 10 * s, c + 6 * s);
        ctx.quadraticCurveTo(c + 16 * s, c - 6 * s, c + 10 * s, c - 16 * s);
        ctx.quadraticCurveTo(c + 4 * s, c - 26 * s, c - 6 * s, c - 22 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Eye
        const eyeColor = fill === '#ffffff' ? '#333' : '#aaa';
        ctx.fillStyle = eyeColor;
        ctx.beginPath();
        ctx.arc(c - 4 * s, c - 12 * s, 2 * s, 0, Math.PI * 2);
        ctx.fill();

        // Base
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(c - 18 * s, c + 26 * s);
        ctx.lineTo(c + 18 * s, c + 26 * s);
        ctx.lineTo(c + 16 * s, c + 22 * s);
        ctx.lineTo(c - 16 * s, c + 22 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    static drawBishop(ctx, c, s, fill, stroke) {
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2 * s;

        // Top point
        ctx.beginPath();
        ctx.arc(c, c - 24 * s, 3 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.moveTo(c, c - 20 * s);
        ctx.quadraticCurveTo(c - 14 * s, c - 8 * s, c - 12 * s, c + 8 * s);
        ctx.lineTo(c - 16 * s, c + 22 * s);
        ctx.lineTo(c + 16 * s, c + 22 * s);
        ctx.lineTo(c + 12 * s, c + 8 * s);
        ctx.quadraticCurveTo(c + 14 * s, c - 8 * s, c, c - 20 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Slit
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(c - 4 * s, c - 10 * s);
        ctx.lineTo(c + 4 * s, c - 2 * s);
        ctx.stroke();

        // Base
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(c - 18 * s, c + 26 * s);
        ctx.lineTo(c + 18 * s, c + 26 * s);
        ctx.lineTo(c + 16 * s, c + 22 * s);
        ctx.lineTo(c - 16 * s, c + 22 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    static drawRook(ctx, c, s, fill, stroke) {
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2 * s;

        // Battlement
        ctx.beginPath();
        ctx.moveTo(c - 16 * s, c - 14 * s);
        ctx.lineTo(c - 16 * s, c - 22 * s);
        ctx.lineTo(c - 8 * s, c - 22 * s);
        ctx.lineTo(c - 8 * s, c - 16 * s);
        ctx.lineTo(c - 3 * s, c - 16 * s);
        ctx.lineTo(c - 3 * s, c - 22 * s);
        ctx.lineTo(c + 3 * s, c - 22 * s);
        ctx.lineTo(c + 3 * s, c - 16 * s);
        ctx.lineTo(c + 8 * s, c - 16 * s);
        ctx.lineTo(c + 8 * s, c - 22 * s);
        ctx.lineTo(c + 16 * s, c - 22 * s);
        ctx.lineTo(c + 16 * s, c - 14 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.moveTo(c - 14 * s, c - 14 * s);
        ctx.lineTo(c - 12 * s, c + 14 * s);
        ctx.lineTo(c - 16 * s, c + 22 * s);
        ctx.lineTo(c + 16 * s, c + 22 * s);
        ctx.lineTo(c + 12 * s, c + 14 * s);
        ctx.lineTo(c + 14 * s, c - 14 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Base
        ctx.beginPath();
        ctx.moveTo(c - 18 * s, c + 26 * s);
        ctx.lineTo(c + 18 * s, c + 26 * s);
        ctx.lineTo(c + 16 * s, c + 22 * s);
        ctx.lineTo(c - 16 * s, c + 22 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    static drawQueen(ctx, c, s, fill, stroke) {
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2 * s;

        // Crown points
        const points = 5;
        for (let i = 0; i < points; i++) {
            const angle = (i / points) * Math.PI - Math.PI / 2;
            const px = c + Math.cos(angle) * 14 * s;
            const py = c - 20 * s + Math.sin(angle) * 4 * s;
            ctx.beginPath();
            ctx.arc(px, py - 4 * s, 2.5 * s, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Body
        ctx.beginPath();
        ctx.moveTo(c - 16 * s, c - 14 * s);
        ctx.lineTo(c - 20 * s, c - 24 * s);
        ctx.lineTo(c - 8 * s, c - 10 * s);
        ctx.lineTo(c, c - 26 * s);
        ctx.lineTo(c + 8 * s, c - 10 * s);
        ctx.lineTo(c + 20 * s, c - 24 * s);
        ctx.lineTo(c + 16 * s, c - 14 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(c - 16 * s, c - 14 * s);
        ctx.quadraticCurveTo(c - 14 * s, c + 6 * s, c - 16 * s, c + 22 * s);
        ctx.lineTo(c + 16 * s, c + 22 * s);
        ctx.quadraticCurveTo(c + 14 * s, c + 6 * s, c + 16 * s, c - 14 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Base
        ctx.beginPath();
        ctx.moveTo(c - 18 * s, c + 26 * s);
        ctx.lineTo(c + 18 * s, c + 26 * s);
        ctx.lineTo(c + 16 * s, c + 22 * s);
        ctx.lineTo(c - 16 * s, c + 22 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    static drawKing(ctx, c, s, fill, stroke) {
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2 * s;

        // Cross
        ctx.fillRect(c - 2 * s, c - 30 * s, 4 * s, 14 * s);
        ctx.strokeRect(c - 2 * s, c - 30 * s, 4 * s, 14 * s);
        ctx.fillRect(c - 6 * s, c - 26 * s, 12 * s, 4 * s);
        ctx.strokeRect(c - 6 * s, c - 26 * s, 12 * s, 4 * s);

        // Body
        ctx.beginPath();
        ctx.moveTo(c - 16 * s, c - 10 * s);
        ctx.quadraticCurveTo(c, c - 20 * s, c + 16 * s, c - 10 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(c - 16 * s, c - 10 * s);
        ctx.quadraticCurveTo(c - 14 * s, c + 8 * s, c - 16 * s, c + 22 * s);
        ctx.lineTo(c + 16 * s, c + 22 * s);
        ctx.quadraticCurveTo(c + 14 * s, c + 8 * s, c + 16 * s, c - 10 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Belt
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(c - 14 * s, c + 4 * s);
        ctx.lineTo(c + 14 * s, c + 4 * s);
        ctx.stroke();

        // Base
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.beginPath();
        ctx.moveTo(c - 18 * s, c + 26 * s);
        ctx.lineTo(c + 18 * s, c + 26 * s);
        ctx.lineTo(c + 16 * s, c + 22 * s);
        ctx.lineTo(c - 16 * s, c + 22 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    static drawModifierIndicator(ctx, size, s) {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(size - 6 * s, 6 * s, 4 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 1 * s;
        ctx.stroke();
    }
}
