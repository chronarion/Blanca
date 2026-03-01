import { UI_COLORS } from '../data/Constants.js';

export class MoveHighlighter {
    constructor(boardRenderer) {
        this.boardRenderer = boardRenderer;
        this.highlights = [];
        this.pulseTime = 0;
    }

    setHighlights(moves) {
        this.highlights = moves;
        this.boardRenderer.legalMoves = moves;
    }

    clear() {
        this.highlights = [];
        this.boardRenderer.legalMoves = [];
    }

    update(dt) {
        this.pulseTime += dt;
    }

    drawMoveCount(ctx, piece, count) {
        if (count <= 0) return;
        const pos = this.boardRenderer.boardToScreen(piece.col, piece.row);
        const size = this.boardRenderer.tileSize;
        ctx.font = `bold ${Math.max(10, size * 0.2)}px monospace`;
        ctx.fillStyle = UI_COLORS.info;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(count, pos.x + size - 2, pos.y + 2);
    }
}
