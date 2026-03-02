import { UI_COLORS, PIECE_TYPES, TEAMS } from '../data/Constants.js';
import { RARITY_COLORS } from '../data/ModifierData.js';
import { Piece } from '../pieces/Piece.js';
import { PieceRenderer } from '../render/PieceRenderer.js';
import { UITheme } from '../ui/UITheme.js';

export class ShopState {
    constructor() {
        this.stateMachine = null;
        this.eventBus = null;
        this.renderer = null;
        this.runManager = null;

        this.items = [];
        this.hoverIndex = -1;
        this.message = '';
        this.messageTimer = 0;

        this.clickHandler = null;
        this.moveHandler = null;
        this.keyHandler = null;

        this.pendingModifier = null;
        this.validPieces = [];
    }

    enter(params = {}) {
        this.items = params.items || this.runManager.generateShop();
        this.hoverIndex = -1;
        this.message = '';
        this.messageTimer = 0;
        this.pendingModifier = null;
        this.validPieces = [];
        this.bindInput();
    }

    exit() {
        if (this.clickHandler) this.eventBus.off('click', this.clickHandler);
        if (this.moveHandler) this.eventBus.off('mousemove', this.moveHandler);
        if (this.keyHandler) this.eventBus.off('keydown', this.keyHandler);
    }

    bindInput() {
        this.clickHandler = (data) => this.handleClick(data);
        this.moveHandler = (data) => this.handleMove(data);
        this.keyHandler = (data) => this.handleKey(data);
        this.eventBus.on('click', this.clickHandler);
        this.eventBus.on('mousemove', this.moveHandler);
        this.eventBus.on('keydown', this.keyHandler);
    }

    getItemBounds() {
        const cardW = 155;
        const cardH = 190;
        const gap = 14;
        const totalW = this.items.length * (cardW + gap) - gap;
        const startX = (this.renderer.width - totalW) / 2;
        const y = this.renderer.height / 2 - cardH / 2 + 10;

        return this.items.map((item, i) => ({
            item, x: startX + i * (cardW + gap), y, w: cardW, h: cardH,
        }));
    }

    getLeaveButton() {
        const bw = 140;
        const bh = 40;
        return { x: (this.renderer.width - bw) / 2, y: this.renderer.height - 75, w: bw, h: bh };
    }

    handleClick(data) {
        // Piece selection mode for modifier assignment
        if (this.pendingModifier) {
            const pieceBounds = this.getPieceSelectionBounds();
            for (const b of pieceBounds) {
                if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                    b.piece.addModifier({ ...this.pendingModifier });
                    this.showMessage(`Applied ${this.pendingModifier.name} to ${b.piece.type}!`);
                    this.pendingModifier = null;
                    this.validPieces = [];
                    return;
                }
            }
            return;
        }

        const lb = this.getLeaveButton();
        if (data.x >= lb.x && data.x <= lb.x + lb.w && data.y >= lb.y && data.y <= lb.y + lb.h) {
            this.stateMachine.change('map');
            return;
        }

        const bounds = this.getItemBounds();
        for (const b of bounds) {
            if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                this.purchaseItem(b.item);
                return;
            }
        }
    }

    handleMove(data) {
        const bounds = this.getItemBounds();
        this.hoverIndex = -1;
        for (let i = 0; i < bounds.length; i++) {
            const b = bounds[i];
            if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                this.hoverIndex = i;
                break;
            }
        }
    }

    handleKey(data) {
        if (data.code === 'Escape') {
            if (this.pendingModifier) {
                this.pendingModifier = null;
                this.validPieces = [];
            } else {
                this.stateMachine.change('map');
            }
        }
    }

    purchaseItem(item) {
        if (this.runManager.gold < item.price) {
            this.showMessage('Not enough gold!');
            return;
        }

        if (item.category === 'modifier') {
            // Any piece can receive any modifier, but not duplicates
            const valid = this.runManager.roster.filter(p => !p.hasModifier(item.id));
            if (valid.length === 0) {
                this.showMessage('All pieces already have this modifier!');
                return;
            }
            const success = this.runManager.purchaseShopItem(item);
            if (success) {
                this.pendingModifier = item.modifier || item;
                this.validPieces = valid;
                this.showMessage('Select a piece to apply modifier');
            }
            return;
        }

        const success = this.runManager.purchaseShopItem(item);
        if (success) {
            this.showMessage(`Purchased ${item.name}!`);
        }
    }

    getPieceSelectionBounds() {
        const btnW = 60;
        const btnH = 60;
        const gap = 10;
        const totalW = this.validPieces.length * (btnW + gap) - gap;
        const startX = (this.renderer.width - totalW) / 2;
        const y = this.renderer.height / 2 - btnH / 2;
        return this.validPieces.map((piece, i) => ({
            piece, x: startX + i * (btnW + gap), y, w: btnW, h: btnH,
        }));
    }

    showMessage(msg) {
        this.message = msg;
        this.messageTimer = 2;
    }

    update(dt) {
        if (this.messageTimer > 0) this.messageTimer -= dt;
    }

    render(ctx) {
        const w = this.renderer.width;
        const h = this.renderer.height;

        UITheme.drawBackground(ctx, w, h);
        UITheme.drawVignette(ctx, w, h, 0.4);

        // Title
        UITheme.drawTitle(ctx, 'Shop', w / 2, 46, 30);

        // Gold display
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = UI_COLORS.gold;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${this.runManager.gold}g`, w / 2, 80);

        UITheme.drawDivider(ctx, w / 2 - 100, 98, 200);

        // Items
        const bounds = this.getItemBounds();
        for (let i = 0; i < bounds.length; i++) {
            const b = bounds[i];
            const item = b.item;
            const isHover = this.hoverIndex === i;
            const canAfford = this.runManager.gold >= item.price;

            UITheme.drawPanel(ctx, b.x, b.y, b.w, b.h, {
                highlight: isHover && canAfford,
                glow: isHover && canAfford,
                fill: isHover ? '#1a1a28' : UI_COLORS.panel,
            });

            // Category color bar — use rarity color for modifiers
            const catColor = item.category === 'relic' ? UI_COLORS.gold :
                             item.category === 'modifier' ? (RARITY_COLORS[item.rarity] || UI_COLORS.info) :
                             UI_COLORS.textDim;
            ctx.beginPath();
            UITheme.roundRect(ctx, b.x + 1, b.y + 1, b.w - 2, 2, 1);
            ctx.fillStyle = catColor;
            ctx.globalAlpha = 0.5;
            ctx.fill();
            ctx.globalAlpha = 1;

            // Icon
            if (item.category === 'piece') {
                const tempPiece = new Piece(item.type, TEAMS.PLAYER);
                PieceRenderer.draw(ctx, tempPiece, b.x + (b.w - 36) / 2, b.y + 14, 36);
            } else {
                ctx.font = '24px serif';
                ctx.fillStyle = catColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.category === 'relic' ? '\u2605' : '\u25C6', b.x + b.w / 2, b.y + 36);
            }

            // Name — rarity-colored for modifiers
            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = item.category === 'modifier' ? (RARITY_COLORS[item.rarity] || UI_COLORS.text) : UI_COLORS.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.name, b.x + b.w / 2, b.y + 68);

            // Description
            ctx.font = '10px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            UITheme.wrapText(ctx, item.description, b.x + b.w / 2, b.y + 86, b.w - 18, 13);

            // Price
            ctx.font = 'bold 13px monospace';
            ctx.fillStyle = canAfford ? UI_COLORS.gold : UI_COLORS.danger;
            ctx.textBaseline = 'middle';
            ctx.fillText(`${item.price}g`, b.x + b.w / 2, b.y + b.h - 18);
        }

        // Leave button
        const lb = this.getLeaveButton();
        UITheme.drawButton(ctx, lb.x, lb.y, lb.w, lb.h, 'Leave Shop', false);

        // Piece selection overlay for modifier assignment
        if (this.pendingModifier) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(0, 0, w, h);

            UITheme.drawTitle(ctx, `Apply ${this.pendingModifier.name}`, w / 2, h / 2 - 65, 20);

            ctx.font = '13px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Select a piece:', w / 2, h / 2 - 40);

            const pieceBounds = this.getPieceSelectionBounds();
            for (const b of pieceBounds) {
                UITheme.drawPanel(ctx, b.x, b.y, b.w, b.h, { radius: 6, shadow: false });
                PieceRenderer.draw(ctx, b.piece, b.x + 4, b.y + 4, b.w - 8);
            }
        }

        // Message
        if (this.messageTimer > 0 && this.message) {
            ctx.globalAlpha = Math.min(1, this.messageTimer);
            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = UI_COLORS.accent;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.message, w / 2, h - 110);
            ctx.globalAlpha = 1;
        }
    }
}
