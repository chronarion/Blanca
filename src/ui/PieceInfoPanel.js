import { UI_COLORS } from '../data/Constants.js';
import { RARITY_COLORS } from '../data/ModifierData.js';
import { PieceRenderer } from '../render/PieceRenderer.js';
import { PIECE_NAMES } from '../data/PieceData.js';
import { Panel } from './Panel.js';

export class PieceInfoPanel {
    constructor() {
        this.piece = null;
        this.visible = false;
        this.panel = new Panel(0, 0, 210, 160, { title: 'Piece Info' });
    }

    show(piece, x, y) {
        this.piece = piece;
        this.visible = true;
        this.panel.x = x;
        this.panel.y = y;

        // Dynamic height based on modifiers
        const baseH = 90;
        const modH = piece.modifiers.length > 0 ? 20 + piece.modifiers.length * 28 : 0;
        const promoH = piece.promotedFrom ? 16 : 0;
        this.panel.h = baseH + modH + promoH;
    }

    hide() {
        this.visible = false;
        this.piece = null;
    }

    render(ctx) {
        if (!this.visible || !this.piece) return;

        this.panel.render(ctx);

        const p = this.piece;
        const x = this.panel.x + 10;
        let y = this.panel.y + 38;

        // Piece icon and name
        PieceRenderer.draw(ctx, p, x, y, 32);
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(PIECE_NAMES[p.type] || p.type, x + 38, y + 4);

        ctx.font = '11px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.fillText(`Moves: ${p.moveCount}`, x + 38, y + 22);

        y += 44;

        // Modifiers with rarity colors and descriptions
        if (p.modifiers.length > 0) {
            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = UI_COLORS.gold;
            ctx.fillText('Modifiers:', x, y);
            y += 16;

            for (const mod of p.modifiers) {
                const rarityColor = RARITY_COLORS[mod.rarity] || UI_COLORS.text;

                // Modifier name in rarity color
                ctx.font = 'bold 10px monospace';
                ctx.fillStyle = rarityColor;
                ctx.fillText(`\u25C6 ${mod.name || mod.id}`, x + 4, y);
                y += 13;

                // Short description
                if (mod.shortDescription) {
                    ctx.font = '9px monospace';
                    ctx.fillStyle = UI_COLORS.textDim;
                    ctx.fillText(`  ${mod.shortDescription}`, x + 4, y);
                }
                y += 15;
            }
        }

        if (p.promotedFrom) {
            ctx.font = '10px monospace';
            ctx.fillStyle = UI_COLORS.info;
            ctx.fillText(`Promoted from ${p.promotedFrom}`, x, y);
        }
    }
}
