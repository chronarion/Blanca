import { PIECE_TYPES, TEAMS } from '../data/Constants.js';
import { PieceSetLoader } from './PieceSetLoader.js';

const PIECE_THEME = {
    player: {
        bodyTop: '#f5ece0',
        bodyBot: '#c8b898',
        outline: '#6a5d4a',
        highlight: 'rgba(255, 255, 255, 0.6)',
        shadow: 'rgba(80, 60, 40, 0.25)',
        accent: '#c9a84e',
        eye: '#4a4035',
    },
    enemy: {
        bodyTop: '#3a3248',
        bodyBot: '#1a1525',
        outline: '#8a6070',
        highlight: 'rgba(180, 140, 160, 0.25)',
        shadow: 'rgba(0, 0, 0, 0.35)',
        accent: '#c04050',
        eye: '#d08888',
    },
};

export class PieceRenderer {
    static draw(ctx, piece, x, y, size) {
        const t = piece.team === TEAMS.PLAYER ? PIECE_THEME.player : PIECE_THEME.enemy;
        const center = size / 2;
        const scale = size / 80;

        // Try image-based rendering first
        const img = PieceSetLoader.getImage(piece.team, piece.type);
        if (img) {
            ctx.save();
            ctx.translate(x, y);
            // Drop shadow
            ctx.fillStyle = t.shadow;
            ctx.beginPath();
            ctx.ellipse(center, center + 24 * scale, 16 * scale, 5 * scale, 0, 0, Math.PI * 2);
            ctx.fill();
            // Draw SVG image
            const pad = size * 0.05;
            ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
            if (piece.modifiers.length > 0) {
                this.drawModifierIndicator(ctx, size, scale, t);
            }
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.translate(x, y);

        // Drop shadow
        ctx.fillStyle = t.shadow;
        ctx.beginPath();
        ctx.ellipse(center, center + 24 * scale, 16 * scale, 5 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        switch (piece.type) {
            case PIECE_TYPES.PAWN: this.drawPawn(ctx, center, scale, t); break;
            case PIECE_TYPES.KNIGHT: this.drawKnight(ctx, center, scale, t); break;
            case PIECE_TYPES.BISHOP: this.drawBishop(ctx, center, scale, t); break;
            case PIECE_TYPES.ROOK: this.drawRook(ctx, center, scale, t); break;
            case PIECE_TYPES.QUEEN: this.drawQueen(ctx, center, scale, t); break;
            case PIECE_TYPES.KING: this.drawKing(ctx, center, scale, t); break;
        }

        if (piece.modifiers.length > 0) {
            this.drawModifierIndicator(ctx, size, scale, t);
        }

        ctx.restore();
    }

    static _bodyGrad(ctx, c, s, t, top, bot) {
        const grad = ctx.createLinearGradient(c, c + top * s, c, c + bot * s);
        grad.addColorStop(0, t.bodyTop);
        grad.addColorStop(1, t.bodyBot);
        return grad;
    }

    static _drawBase(ctx, c, s, t) {
        const grad = ctx.createLinearGradient(c, c + 20 * s, c, c + 28 * s);
        grad.addColorStop(0, t.bodyBot);
        grad.addColorStop(1, t.bodyTop);
        ctx.fillStyle = grad;
        ctx.strokeStyle = t.outline;
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(c - 18 * s, c + 26 * s);
        ctx.lineTo(c + 18 * s, c + 26 * s);
        ctx.lineTo(c + 16 * s, c + 21 * s);
        ctx.lineTo(c - 16 * s, c + 21 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    static _drawHighlight(ctx, c, s, yTop, width) {
        ctx.beginPath();
        ctx.moveTo(c - width * s, yTop);
        ctx.quadraticCurveTo(c, yTop - 3 * s, c + width * s, yTop);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1.5 * s;
        ctx.stroke();
    }

    static drawPawn(ctx, c, s, t) {
        ctx.fillStyle = this._bodyGrad(ctx, c, s, t, -22, 22);
        ctx.strokeStyle = t.outline;
        ctx.lineWidth = 1.5 * s;

        // Head
        ctx.beginPath();
        ctx.arc(c, c - 10 * s, 10 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Neck/body taper
        ctx.beginPath();
        ctx.moveTo(c - 14 * s, c + 21 * s);
        ctx.quadraticCurveTo(c - 10 * s, c + 4 * s, c - 7 * s, c - 1 * s);
        ctx.lineTo(c + 7 * s, c - 1 * s);
        ctx.quadraticCurveTo(c + 10 * s, c + 4 * s, c + 14 * s, c + 21 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Head highlight
        ctx.beginPath();
        ctx.arc(c - 3 * s, c - 14 * s, 4 * s, 0, Math.PI * 2);
        ctx.fillStyle = t.highlight;
        ctx.fill();

        this._drawBase(ctx, c, s, t);
    }

    static drawKnight(ctx, c, s, t) {
        ctx.fillStyle = this._bodyGrad(ctx, c, s, t, -26, 22);
        ctx.strokeStyle = t.outline;
        ctx.lineWidth = 1.5 * s;

        // Horse head and neck
        ctx.beginPath();
        ctx.moveTo(c - 4 * s, c - 24 * s);
        // Forehead curve
        ctx.quadraticCurveTo(c - 14 * s, c - 22 * s, c - 16 * s, c - 12 * s);
        // Muzzle
        ctx.quadraticCurveTo(c - 18 * s, c - 4 * s, c - 14 * s, c + 2 * s);
        // Chin
        ctx.quadraticCurveTo(c - 16 * s, c + 10 * s, c - 12 * s, c + 14 * s);
        // Chest to base
        ctx.lineTo(c - 16 * s, c + 21 * s);
        ctx.lineTo(c + 16 * s, c + 21 * s);
        // Back
        ctx.lineTo(c + 10 * s, c + 6 * s);
        ctx.quadraticCurveTo(c + 14 * s, c - 4 * s, c + 10 * s, c - 14 * s);
        // Crown
        ctx.quadraticCurveTo(c + 6 * s, c - 24 * s, c - 4 * s, c - 24 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Ear
        ctx.beginPath();
        ctx.moveTo(c - 2 * s, c - 24 * s);
        ctx.lineTo(c - 6 * s, c - 30 * s);
        ctx.lineTo(c + 2 * s, c - 26 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Eye
        ctx.fillStyle = t.eye;
        ctx.beginPath();
        ctx.ellipse(c - 6 * s, c - 14 * s, 2.5 * s, 2 * s, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(c - 5 * s, c - 15 * s, 0.8 * s, 0, Math.PI * 2);
        ctx.fill();

        // Nostril
        ctx.fillStyle = t.eye;
        ctx.beginPath();
        ctx.arc(c - 14 * s, c - 2 * s, 1.5 * s, 0, Math.PI * 2);
        ctx.fill();

        // Body highlight
        ctx.beginPath();
        ctx.moveTo(c + 4 * s, c - 18 * s);
        ctx.quadraticCurveTo(c + 10 * s, c - 10 * s, c + 8 * s, c);
        ctx.strokeStyle = t.highlight;
        ctx.lineWidth = 2 * s;
        ctx.stroke();

        this._drawBase(ctx, c, s, t);
    }

    static drawBishop(ctx, c, s, t) {
        ctx.fillStyle = this._bodyGrad(ctx, c, s, t, -28, 22);
        ctx.strokeStyle = t.outline;
        ctx.lineWidth = 1.5 * s;

        // Finial (top ball)
        ctx.beginPath();
        ctx.arc(c, c - 26 * s, 3 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Mitre body
        ctx.beginPath();
        ctx.moveTo(c, c - 22 * s);
        ctx.quadraticCurveTo(c - 15 * s, c - 8 * s, c - 12 * s, c + 8 * s);
        ctx.lineTo(c - 16 * s, c + 21 * s);
        ctx.lineTo(c + 16 * s, c + 21 * s);
        ctx.lineTo(c + 12 * s, c + 8 * s);
        ctx.quadraticCurveTo(c + 15 * s, c - 8 * s, c, c - 22 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Diagonal slit
        ctx.strokeStyle = t.outline;
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(c - 4 * s, c - 12 * s);
        ctx.lineTo(c + 5 * s, c - 2 * s);
        ctx.stroke();

        // Collar ring
        ctx.beginPath();
        ctx.ellipse(c, c + 10 * s, 12 * s, 3 * s, 0, 0, Math.PI * 2);
        ctx.strokeStyle = t.outline;
        ctx.lineWidth = 1 * s;
        ctx.stroke();

        // Top highlight
        ctx.fillStyle = t.highlight;
        ctx.beginPath();
        ctx.arc(c - 1 * s, c - 27 * s, 1.2 * s, 0, Math.PI * 2);
        ctx.fill();

        this._drawBase(ctx, c, s, t);
    }

    static drawRook(ctx, c, s, t) {
        ctx.fillStyle = this._bodyGrad(ctx, c, s, t, -24, 22);
        ctx.strokeStyle = t.outline;
        ctx.lineWidth = 1.5 * s;

        // Battlement (crenellations)
        ctx.beginPath();
        ctx.moveTo(c - 16 * s, c - 14 * s);
        ctx.lineTo(c - 16 * s, c - 22 * s);
        ctx.lineTo(c - 9 * s, c - 22 * s);
        ctx.lineTo(c - 9 * s, c - 16 * s);
        ctx.lineTo(c - 3 * s, c - 16 * s);
        ctx.lineTo(c - 3 * s, c - 22 * s);
        ctx.lineTo(c + 3 * s, c - 22 * s);
        ctx.lineTo(c + 3 * s, c - 16 * s);
        ctx.lineTo(c + 9 * s, c - 16 * s);
        ctx.lineTo(c + 9 * s, c - 22 * s);
        ctx.lineTo(c + 16 * s, c - 22 * s);
        ctx.lineTo(c + 16 * s, c - 14 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Tower body (slightly tapered)
        ctx.beginPath();
        ctx.moveTo(c - 14 * s, c - 14 * s);
        ctx.lineTo(c - 12 * s, c + 12 * s);
        ctx.lineTo(c - 16 * s, c + 21 * s);
        ctx.lineTo(c + 16 * s, c + 21 * s);
        ctx.lineTo(c + 12 * s, c + 12 * s);
        ctx.lineTo(c + 14 * s, c - 14 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Window slit
        ctx.fillStyle = t.outline;
        ctx.fillRect(c - 2 * s, c - 6 * s, 4 * s, 10 * s);

        // Battlement highlights
        ctx.fillStyle = t.highlight;
        ctx.fillRect(c - 15 * s, c - 21 * s, 5 * s, 2 * s);
        ctx.fillRect(c - 2 * s, c - 21 * s, 5 * s, 2 * s);
        ctx.fillRect(c + 10 * s, c - 21 * s, 5 * s, 2 * s);

        this._drawBase(ctx, c, s, t);
    }

    static drawQueen(ctx, c, s, t) {
        ctx.fillStyle = this._bodyGrad(ctx, c, s, t, -28, 22);
        ctx.strokeStyle = t.outline;
        ctx.lineWidth = 1.5 * s;

        // Crown points with gems
        const crownTips = [
            { x: -18, y: -24 },
            { x: -9, y: -28 },
            { x: 0, y: -30 },
            { x: 9, y: -28 },
            { x: 18, y: -24 },
        ];

        // Crown shape
        ctx.beginPath();
        ctx.moveTo(c - 16 * s, c - 12 * s);
        ctx.lineTo(c + crownTips[0].x * s, c + crownTips[0].y * s);
        ctx.lineTo(c - 12 * s, c - 14 * s);
        ctx.lineTo(c + crownTips[1].x * s, c + crownTips[1].y * s);
        ctx.lineTo(c - 3 * s, c - 16 * s);
        ctx.lineTo(c + crownTips[2].x * s, c + crownTips[2].y * s);
        ctx.lineTo(c + 3 * s, c - 16 * s);
        ctx.lineTo(c + crownTips[3].x * s, c + crownTips[3].y * s);
        ctx.lineTo(c + 12 * s, c - 14 * s);
        ctx.lineTo(c + crownTips[4].x * s, c + crownTips[4].y * s);
        ctx.lineTo(c + 16 * s, c - 12 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crown tip gems
        ctx.fillStyle = t.accent;
        for (const tip of crownTips) {
            ctx.beginPath();
            ctx.arc(c + tip.x * s, c + tip.y * s, 2 * s, 0, Math.PI * 2);
            ctx.fill();
        }

        // Body
        ctx.fillStyle = this._bodyGrad(ctx, c, s, t, -14, 22);
        ctx.beginPath();
        ctx.moveTo(c - 16 * s, c - 12 * s);
        ctx.quadraticCurveTo(c - 15 * s, c + 6 * s, c - 16 * s, c + 21 * s);
        ctx.lineTo(c + 16 * s, c + 21 * s);
        ctx.quadraticCurveTo(c + 15 * s, c + 6 * s, c + 16 * s, c - 12 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Waist band
        ctx.strokeStyle = t.accent;
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(c - 15 * s, c + 2 * s);
        ctx.lineTo(c + 15 * s, c + 2 * s);
        ctx.stroke();

        // Body highlight
        this._drawHighlight(ctx, c, s, c - 8 * s, 10);

        this._drawBase(ctx, c, s, t);
    }

    static drawKing(ctx, c, s, t) {
        ctx.fillStyle = this._bodyGrad(ctx, c, s, t, -30, 22);
        ctx.strokeStyle = t.outline;
        ctx.lineWidth = 1.5 * s;

        // Cross
        ctx.beginPath();
        ctx.moveTo(c - 2.5 * s, c - 30 * s);
        ctx.lineTo(c + 2.5 * s, c - 30 * s);
        ctx.lineTo(c + 2.5 * s, c - 26 * s);
        ctx.lineTo(c + 7 * s, c - 26 * s);
        ctx.lineTo(c + 7 * s, c - 22 * s);
        ctx.lineTo(c + 2.5 * s, c - 22 * s);
        ctx.lineTo(c + 2.5 * s, c - 17 * s);
        ctx.lineTo(c - 2.5 * s, c - 17 * s);
        ctx.lineTo(c - 2.5 * s, c - 22 * s);
        ctx.lineTo(c - 7 * s, c - 22 * s);
        ctx.lineTo(c - 7 * s, c - 26 * s);
        ctx.lineTo(c - 2.5 * s, c - 26 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crown arch
        ctx.beginPath();
        ctx.moveTo(c - 16 * s, c - 10 * s);
        ctx.quadraticCurveTo(c, c - 22 * s, c + 16 * s, c - 10 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.moveTo(c - 16 * s, c - 10 * s);
        ctx.quadraticCurveTo(c - 15 * s, c + 8 * s, c - 16 * s, c + 21 * s);
        ctx.lineTo(c + 16 * s, c + 21 * s);
        ctx.quadraticCurveTo(c + 15 * s, c + 8 * s, c + 16 * s, c - 10 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crown jewel
        ctx.fillStyle = t.accent;
        ctx.beginPath();
        ctx.arc(c, c - 13 * s, 3.5 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = t.outline;
        ctx.lineWidth = 1 * s;
        ctx.stroke();

        // Jewel shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(c - 1 * s, c - 14 * s, 1.2 * s, 0, Math.PI * 2);
        ctx.fill();

        // Belt band
        ctx.strokeStyle = t.accent;
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(c - 15 * s, c + 4 * s);
        ctx.lineTo(c + 15 * s, c + 4 * s);
        ctx.stroke();

        // Belt buckle
        ctx.fillStyle = t.accent;
        ctx.fillRect(c - 3 * s, c + 1.5 * s, 6 * s, 5 * s);
        ctx.strokeStyle = t.outline;
        ctx.lineWidth = 1 * s;
        ctx.strokeRect(c - 3 * s, c + 1.5 * s, 6 * s, 5 * s);

        // Body highlight
        this._drawHighlight(ctx, c, s, c - 6 * s, 10);

        this._drawBase(ctx, c, s, t);
    }

    static drawModifierIndicator(ctx, size, s, t) {
        const x = size - 4 * s;
        const y = 4 * s;
        const r = 3.5 * s;

        // Glow
        ctx.save();
        ctx.shadowColor = t.accent;
        ctx.shadowBlur = 6 * s;
        ctx.fillStyle = t.accent;
        ctx.beginPath();
        // Diamond shape
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * 0.7, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r * 0.7, y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Outline
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * 0.7, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r * 0.7, y);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 0.5 * s;
        ctx.stroke();
    }
}
