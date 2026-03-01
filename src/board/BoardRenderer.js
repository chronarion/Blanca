import { TILE_COLORS, TERRAIN_TYPES, UI_COLORS } from '../data/Constants.js';
import { PieceRenderer } from '../render/PieceRenderer.js';

const TERRAIN_COLORS = {
    [TERRAIN_TYPES.FORTRESS]: { light: '#a0c4ff', dark: '#7ba7e0' },
    [TERRAIN_TYPES.ICE]: { light: '#cce5ff', dark: '#99ccee' },
    [TERRAIN_TYPES.BRAMBLE]: { light: '#8bc34a', dark: '#689f38' },
    [TERRAIN_TYPES.VOID]: { light: '#2a2a2a', dark: '#1a1a1a' },
    [TERRAIN_TYPES.ALTAR]: { light: '#ffd54f', dark: '#ffb300' },
};

const TERRAIN_SYMBOLS = {
    [TERRAIN_TYPES.FORTRESS]: '🛡',
    [TERRAIN_TYPES.ICE]: '❄',
    [TERRAIN_TYPES.BRAMBLE]: '♣',
    [TERRAIN_TYPES.VOID]: '▪',
    [TERRAIN_TYPES.ALTAR]: '☆',
};

export class BoardRenderer {
    constructor(board, renderer) {
        this.board = board;
        this.renderer = renderer;
        this.tileSize = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.selectedPiece = null;
        this.legalMoves = [];
        this.lastMove = null;
        this.checkSquare = null;
        this.hoverTile = null;
        this.calculateLayout();
    }

    calculateLayout() {
        const padding = 60;
        const maxW = this.renderer.width - padding * 2;
        const maxH = this.renderer.height - padding * 2;
        this.tileSize = Math.floor(Math.min(maxW / this.board.cols, maxH / this.board.rows));
        const boardW = this.tileSize * this.board.cols;
        const boardH = this.tileSize * this.board.rows;
        this.offsetX = Math.floor((this.renderer.width - boardW) / 2);
        this.offsetY = Math.floor((this.renderer.height - boardH) / 2);
    }

    screenToBoard(x, y) {
        const col = Math.floor((x - this.offsetX) / this.tileSize);
        const row = Math.floor((y - this.offsetY) / this.tileSize);
        if (col < 0 || col >= this.board.cols || row < 0 || row >= this.board.rows) {
            return null;
        }
        return { col, row };
    }

    boardToScreen(col, row) {
        return {
            x: this.offsetX + col * this.tileSize,
            y: this.offsetY + row * this.tileSize,
        };
    }

    render(ctx, animatingPieces = new Set()) {
        this.calculateLayout();

        for (let r = 0; r < this.board.rows; r++) {
            for (let c = 0; c < this.board.cols; c++) {
                this.drawTile(ctx, c, r);
            }
        }

        this.drawBoardBorder(ctx);

        for (let r = 0; r < this.board.rows; r++) {
            for (let c = 0; c < this.board.cols; c++) {
                const tile = this.board.getTile(c, r);
                if (tile.piece && !animatingPieces.has(tile.piece.id)) {
                    const pos = this.boardToScreen(c, r);
                    PieceRenderer.draw(ctx, tile.piece, pos.x, pos.y, this.tileSize);
                }
            }
        }
    }

    drawTile(ctx, col, row) {
        const tile = this.board.getTile(col, row);
        const pos = this.boardToScreen(col, row);
        const isLight = tile.isLight;

        let color;

        if (tile.terrain !== TERRAIN_TYPES.NONE && TERRAIN_COLORS[tile.terrain]) {
            color = isLight ? TERRAIN_COLORS[tile.terrain].light : TERRAIN_COLORS[tile.terrain].dark;
        } else if (this.selectedPiece && this.selectedPiece.col === col && this.selectedPiece.row === row) {
            color = isLight ? TILE_COLORS.lightSelected : TILE_COLORS.darkSelected;
        } else if (this.lastMove && ((this.lastMove.from.col === col && this.lastMove.from.row === row) || (this.lastMove.to.col === col && this.lastMove.to.row === row))) {
            color = isLight ? TILE_COLORS.lightLastMove : TILE_COLORS.darkLastMove;
        } else if (this.checkSquare && this.checkSquare.col === col && this.checkSquare.row === row) {
            color = isLight ? TILE_COLORS.lightCheck : TILE_COLORS.darkCheck;
        } else {
            color = isLight ? TILE_COLORS.light : TILE_COLORS.dark;
        }

        ctx.fillStyle = color;
        ctx.fillRect(pos.x, pos.y, this.tileSize, this.tileSize);

        if (tile.terrain !== TERRAIN_TYPES.NONE && tile.terrain !== TERRAIN_TYPES.VOID && TERRAIN_SYMBOLS[tile.terrain]) {
            ctx.font = `${this.tileSize * 0.3}px serif`;
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(TERRAIN_SYMBOLS[tile.terrain], pos.x + this.tileSize - 2, pos.y + this.tileSize - 2);
        }

        // Legal move indicators
        const move = this.legalMoves.find(m => m.col === col && m.row === row);
        if (move) {
            if (move.type === 'capture') {
                ctx.fillStyle = isLight ? TILE_COLORS.lightCapture : TILE_COLORS.darkCapture;
                ctx.fillRect(pos.x, pos.y, this.tileSize, this.tileSize);
                ctx.fillStyle = color;
                const inset = this.tileSize * 0.1;
                ctx.fillRect(pos.x + inset, pos.y + inset, this.tileSize - inset * 2, this.tileSize - inset * 2);
            } else {
                ctx.fillStyle = isLight ? 'rgba(170,215,81,0.6)' : 'rgba(124,179,66,0.6)';
                ctx.beginPath();
                ctx.arc(pos.x + this.tileSize / 2, pos.y + this.tileSize / 2, this.tileSize * 0.15, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Hover
        if (this.hoverTile && this.hoverTile.col === col && this.hoverTile.row === row) {
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(pos.x, pos.y, this.tileSize, this.tileSize);
        }
    }

    drawBoardBorder(ctx) {
        const bw = this.board.cols * this.tileSize;
        const bh = this.board.rows * this.tileSize;
        ctx.strokeStyle = UI_COLORS.panelBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.offsetX - 1, this.offsetY - 1, bw + 2, bh + 2);

        // Coordinates
        ctx.font = `${Math.max(10, this.tileSize * 0.18)}px monospace`;
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let c = 0; c < this.board.cols; c++) {
            const x = this.offsetX + c * this.tileSize + this.tileSize / 2;
            ctx.fillText(String.fromCharCode(97 + c), x, this.offsetY + bh + 14);
        }
        ctx.textAlign = 'right';
        for (let r = 0; r < this.board.rows; r++) {
            const y = this.offsetY + r * this.tileSize + this.tileSize / 2;
            ctx.fillText(String(this.board.rows - r), this.offsetX - 8, y);
        }
    }
}
