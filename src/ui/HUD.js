import { UI_COLORS, PIECE_TYPES } from '../data/Constants.js';
import { PieceRenderer } from '../render/PieceRenderer.js';
import { PIECE_NAMES } from '../data/PieceData.js';

export class HUD {
    constructor(runManager) {
        this.runManager = runManager;
    }

    render(ctx, width, height) {
        if (!this.runManager || !this.runManager.isActive) return;

        this.drawTopBar(ctx, width);
        this.drawRosterPreview(ctx, width, height);
        this.drawRelicBar(ctx, width, height);
    }

    drawTopBar(ctx, width) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, width, 36);

        ctx.font = '13px monospace';
        ctx.textBaseline = 'middle';

        // Floor
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = 'left';
        ctx.fillText(`Floor ${this.runManager.currentFloor}`, 12, 18);

        // Gold
        ctx.fillStyle = UI_COLORS.gold;
        ctx.textAlign = 'center';
        ctx.fillText(`Gold: ${this.runManager.gold}`, width / 2, 18);

        // Army size
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = 'right';
        ctx.fillText(`Army: ${this.runManager.roster.length}`, width - 12, 18);
    }

    drawRosterPreview(ctx, width, height) {
        const size = 20;
        const spacing = 22;
        const roster = this.runManager.roster;
        const x = 8;
        const y = height - 28;

        for (let i = 0; i < Math.min(roster.length, 16); i++) {
            PieceRenderer.draw(ctx, roster[i], x + i * spacing, y, size);
        }
        if (roster.length > 16) {
            ctx.font = '10px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            ctx.textAlign = 'left';
            ctx.fillText(`+${roster.length - 16}`, x + 16 * spacing, y + size / 2);
        }
    }

    drawRelicBar(ctx, width, height) {
        const relics = this.runManager.relicSystem.ownedRelics;
        if (relics.length === 0) return;

        ctx.font = '11px monospace';
        ctx.fillStyle = UI_COLORS.gold;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';

        const y = height - 50;
        for (let i = 0; i < relics.length; i++) {
            ctx.fillText(`★ ${relics[i].name}`, width - 10, y - i * 16);
        }
    }
}
