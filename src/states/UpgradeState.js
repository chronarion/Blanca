import { UI_COLORS, TEAMS } from '../data/Constants.js';
import { RARITY_COLORS, getUpgradePackChoices } from '../data/ModifierData.js';
import { PieceRenderer } from '../render/PieceRenderer.js';
import { UITheme } from '../ui/UITheme.js';

const CATEGORY_LABELS = {
    movement: 'Movement',
    capture: 'Capture',
    defense: 'Defense',
    aura: 'Aura',
    risk: 'Risk',
};

// Animation timing
const CARD_FLIP_DURATION = 0.35;
const CARD_STAGGER = 0.25;
const PARTICLE_LIFETIME = 0.8;

// Rarity → particle count & screen flash intensity
const RARITY_FX = {
    common:    { particles: 0,  flash: 0 },
    uncommon:  { particles: 8,  flash: 0.04 },
    rare:      { particles: 16, flash: 0.08 },
    legendary: { particles: 30, flash: 0.15 },
};

export class UpgradeState {
    constructor() {
        this.stateMachine = null;
        this.eventBus = null;
        this.renderer = null;
        this.runManager = null;
        this.audioManager = null;

        this.phase = 'pick'; // 'pick' | 'assign'
        this.choices = [];
        this.selectedMod = null;
        this.hoverIndex = -1;
        this.hoverPieceIndex = -1;
        this.hoverSkip = false;

        this.nextState = 'map';
        this.nextParams = {};
        this.source = '';

        // Animation state
        this.revealTime = 0;
        this.cardRevealed = [false, false, false];
        this.particles = [];
        this.screenFlash = 0;
        this.bestRarity = 'common';

        this.clickHandler = null;
        this.moveHandler = null;
        this.keyHandler = null;
    }

    enter(params = {}) {
        this.nextState = params.nextState || 'map';
        this.nextParams = params.nextParams || {};
        this.source = params.source || '';
        this.phase = 'pick';
        this.selectedMod = null;
        this.hoverIndex = -1;
        this.hoverPieceIndex = -1;
        this.hoverSkip = false;

        // Animation reset
        this.revealTime = 0;
        this.cardRevealed = [false, false, false];
        this.particles = [];
        this.screenFlash = 0;

        // Generate 3 modifier choices, filtering out roster-redundant mods
        const rng = this.runManager.rng;
        const rosterTypes = this.runManager.roster.map(p => p.type);
        this.choices = getUpgradePackChoices(rng, [], 3, rosterTypes);

        // Determine best rarity for overall ambiance
        const order = ['legendary', 'rare', 'uncommon', 'common'];
        this.bestRarity = 'common';
        for (const r of order) {
            if (this.choices.some(c => c.rarity === r)) { this.bestRarity = r; break; }
        }

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

    // === BOUNDS ===

    getCardBounds() {
        const cardW = 160;
        const cardH = 220;
        const gap = 18;
        const count = this.choices.length;
        const totalW = count * (cardW + gap) - gap;
        const startX = (this.renderer.width - totalW) / 2;
        const y = this.renderer.height / 2 - cardH / 2 + 10;

        return this.choices.map((_, i) => ({
            x: startX + i * (cardW + gap), y, w: cardW, h: cardH,
        }));
    }

    getSkipButton() {
        const bw = 100;
        const bh = 34;
        return { x: (this.renderer.width - bw) / 2, y: this.renderer.height - 65, w: bw, h: bh };
    }

    getPieceBounds() {
        const roster = this.runManager.roster;
        const btnW = 64;
        const btnH = 80;
        const gap = 10;
        const perRow = Math.min(roster.length, 8);
        const rows = Math.ceil(roster.length / perRow);
        const totalW = perRow * (btnW + gap) - gap;
        const startX = (this.renderer.width - totalW) / 2;
        const startY = this.renderer.height / 2 - (rows * (btnH + gap) - gap) / 2 + 20;

        return roster.map((piece, i) => {
            const row = Math.floor(i / perRow);
            const col = i % perRow;
            return {
                piece,
                x: startX + col * (btnW + gap),
                y: startY + row * (btnH + gap),
                w: btnW,
                h: btnH,
            };
        });
    }

    isCardRevealed(index) {
        const delay = index * CARD_STAGGER;
        return this.revealTime >= delay + CARD_FLIP_DURATION;
    }

    allCardsRevealed() {
        return this.choices.every((_, i) => this.isCardRevealed(i));
    }

    // === INPUT ===

    handleClick(data) {
        if (this.phase === 'pick') {
            if (!this.allCardsRevealed()) return; // Can't pick during reveal

            const bounds = this.getCardBounds();
            for (let i = 0; i < bounds.length; i++) {
                const b = bounds[i];
                if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                    this.selectedMod = this.choices[i];
                    this.phase = 'assign';
                    this.hoverPieceIndex = -1;
                    return;
                }
            }

            const skip = this.getSkipButton();
            if (data.x >= skip.x && data.x <= skip.x + skip.w && data.y >= skip.y && data.y <= skip.y + skip.h) {
                this.finish();
                return;
            }
        } else if (this.phase === 'assign') {
            const pieceBounds = this.getPieceBounds();
            for (let i = 0; i < pieceBounds.length; i++) {
                const b = pieceBounds[i];
                if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                    if (!b.piece.hasModifier(this.selectedMod.id)) {
                        b.piece.addModifier({ ...this.selectedMod });
                        this.finish();
                    }
                    return;
                }
            }
        }
    }

    handleMove(data) {
        this.hoverIndex = -1;
        this.hoverPieceIndex = -1;
        this.hoverSkip = false;

        if (this.phase === 'pick') {
            if (this.allCardsRevealed()) {
                const bounds = this.getCardBounds();
                for (let i = 0; i < bounds.length; i++) {
                    const b = bounds[i];
                    if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                        this.hoverIndex = i;
                        break;
                    }
                }

                const skip = this.getSkipButton();
                if (data.x >= skip.x && data.x <= skip.x + skip.w && data.y >= skip.y && data.y <= skip.y + skip.h) {
                    this.hoverSkip = true;
                }
            }
        } else if (this.phase === 'assign') {
            const pieceBounds = this.getPieceBounds();
            for (let i = 0; i < pieceBounds.length; i++) {
                const b = pieceBounds[i];
                if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                    this.hoverPieceIndex = i;
                    break;
                }
            }
        }
    }

    handleKey(data) {
        if (data.code === 'Escape') {
            if (this.phase === 'assign') {
                this.phase = 'pick';
                this.selectedMod = null;
            } else {
                this.finish();
            }
        }
    }

    finish() {
        this.stateMachine.change(this.nextState, this.nextParams);
    }

    // === PARTICLES ===

    _spawnParticles(cx, cy, count, color) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.8;
            const speed = 40 + Math.random() * 80;
            this.particles.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 30,
                life: PARTICLE_LIFETIME + Math.random() * 0.3,
                maxLife: PARTICLE_LIFETIME + Math.random() * 0.3,
                color,
                size: 2 + Math.random() * 3,
            });
        }
    }

    _updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 60 * dt; // gravity
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    _renderParticles(ctx) {
        for (const p of this.particles) {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            // Diamond-shaped particles
            const s = p.size * alpha;
            ctx.moveTo(p.x, p.y - s);
            ctx.lineTo(p.x + s * 0.7, p.y);
            ctx.lineTo(p.x, p.y + s);
            ctx.lineTo(p.x - s * 0.7, p.y);
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // === UPDATE ===

    update(dt) {
        if (this.phase === 'pick') {
            this.revealTime += dt;

            // Check for newly revealed cards and trigger FX
            for (let i = 0; i < this.choices.length; i++) {
                if (!this.cardRevealed[i] && this.isCardRevealed(i)) {
                    this.cardRevealed[i] = true;
                    this._onCardRevealed(i);
                }
            }
        }

        this._updateParticles(dt);
        if (this.screenFlash > 0) {
            this.screenFlash = Math.max(0, this.screenFlash - dt * 1.5);
        }
    }

    _onCardRevealed(index) {
        const mod = this.choices[index];
        const fx = RARITY_FX[mod.rarity] || RARITY_FX.common;
        const bounds = this.getCardBounds();
        const b = bounds[index];
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const color = RARITY_COLORS[mod.rarity] || '#888';

        if (fx.particles > 0) {
            this._spawnParticles(cx, cy, fx.particles, color);
        }
        if (fx.flash > 0) {
            this.screenFlash = Math.max(this.screenFlash, fx.flash);
        }

        // Play sound if available
        if (this.audioManager) {
            if (mod.rarity === 'legendary') {
                this.audioManager.playSFX('victory');
            } else if (mod.rarity === 'rare') {
                this.audioManager.playSFX('capture');
            }
        }
    }

    // === RENDER ===

    render(ctx) {
        const w = this.renderer.width;
        const h = this.renderer.height;

        UITheme.drawBackground(ctx, w, h);
        UITheme.drawVignette(ctx, w, h, 0.4);

        if (this.phase === 'pick') {
            this.renderPickPhase(ctx, w, h);
        } else {
            this.renderAssignPhase(ctx, w, h);
        }

        // Particles on top
        this._renderParticles(ctx);

        // Screen flash overlay
        if (this.screenFlash > 0) {
            const flashColor = RARITY_COLORS[this.bestRarity] || '#fff';
            ctx.fillStyle = flashColor;
            ctx.globalAlpha = this.screenFlash;
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1;
        }
    }

    renderPickPhase(ctx, w, h) {
        // Title
        const title = this.source === 'draft' ? 'Starting Upgrade' : 'Choose an Upgrade';
        UITheme.drawTitle(ctx, title, w / 2, 50, 26);

        ctx.font = '12px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Pick a modifier to apply to one of your pieces', w / 2, 82);

        UITheme.drawDivider(ctx, w / 2 - 130, 100, 260);

        // Modifier cards
        const bounds = this.getCardBounds();
        for (let i = 0; i < this.choices.length; i++) {
            const mod = this.choices[i];
            const b = bounds[i];
            const delay = i * CARD_STAGGER;
            const elapsed = this.revealTime - delay;

            if (elapsed < 0) {
                // Card not started yet — draw placeholder
                this._drawCardPlaceholder(ctx, b);
                continue;
            }

            if (elapsed < CARD_FLIP_DURATION) {
                // Card is flipping
                this._drawCardFlipping(ctx, b, mod, elapsed / CARD_FLIP_DURATION);
                continue;
            }

            // Card fully revealed — draw normally with hover lift
            const isHover = this.hoverIndex === i;
            const liftY = isHover ? -6 : 0;
            this._drawRevealedCard(ctx, { ...b, y: b.y + liftY }, mod, isHover);
        }

        // Skip button (only after all cards revealed)
        if (this.allCardsRevealed()) {
            const skip = this.getSkipButton();
            UITheme.drawButton(ctx, skip.x, skip.y, skip.w, skip.h, 'Skip', this.hoverSkip, {
                fontSize: 12,
                textColor: UI_COLORS.textDim,
            });
        }
    }

    _drawCardPlaceholder(ctx, b) {
        UITheme.drawPanel(ctx, b.x, b.y, b.w, b.h, {
            fill: '#0e0e14',
            border: UI_COLORS.panelBorder + '40',
        });

        // Question mark
        ctx.font = 'bold 32px monospace';
        ctx.fillStyle = UI_COLORS.panelBorder;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', b.x + b.w / 2, b.y + b.h / 2);
    }

    _drawCardFlipping(ctx, b, mod, progress) {
        // scaleX: 1 → 0 at midpoint → 1
        const scaleX = Math.abs(Math.cos(progress * Math.PI));
        const showFront = progress >= 0.5;
        const cx = b.x + b.w / 2;

        ctx.save();
        ctx.translate(cx, 0);
        ctx.scale(scaleX, 1);
        ctx.translate(-cx, 0);

        if (showFront) {
            // Briefly show the card content — slightly dimmed as it finishes flipping
            const fadeIn = (progress - 0.5) * 2; // 0→1 over second half
            ctx.globalAlpha = 0.5 + fadeIn * 0.5;
            this._drawRevealedCard(ctx, b, mod, false);
            ctx.globalAlpha = 1;
        } else {
            // Card back
            UITheme.drawPanel(ctx, b.x, b.y, b.w, b.h, {
                fill: '#0e0e14',
                border: UI_COLORS.panelBorder,
            });

            // Decorative back pattern
            const rarityColor = RARITY_COLORS[mod.rarity] || UI_COLORS.panelBorder;
            ctx.strokeStyle = rarityColor;
            ctx.globalAlpha = 0.15;
            ctx.lineWidth = 1;

            // Diamond pattern on back
            const midX = b.x + b.w / 2;
            const midY = b.y + b.h / 2;
            for (let d = 20; d <= 70; d += 25) {
                ctx.beginPath();
                ctx.moveTo(midX, midY - d);
                ctx.lineTo(midX + d * 0.5, midY);
                ctx.lineTo(midX, midY + d);
                ctx.lineTo(midX - d * 0.5, midY);
                ctx.closePath();
                ctx.stroke();
            }
            ctx.globalAlpha = 1;

            // Center question mark
            ctx.font = 'bold 32px monospace';
            ctx.fillStyle = rarityColor;
            ctx.globalAlpha = 0.25;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', midX, midY);
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    _drawRevealedCard(ctx, b, mod, isHover) {
        const rarityColor = RARITY_COLORS[mod.rarity] || UI_COLORS.textDim;

        // Hover glow behind card
        if (isHover) {
            ctx.save();
            ctx.shadowColor = rarityColor;
            ctx.shadowBlur = 16;
            ctx.fillStyle = 'rgba(0,0,0,0.01)';
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.restore();
        }

        UITheme.drawPanel(ctx, b.x, b.y, b.w, b.h, {
            highlight: isHover,
            glow: isHover,
            fill: isHover ? '#1a1a28' : UI_COLORS.panel,
        });

        // Rarity color bar at top
        ctx.beginPath();
        UITheme.roundRect(ctx, b.x + 1, b.y + 1, b.w - 2, 3, 2);
        ctx.fillStyle = rarityColor;
        ctx.globalAlpha = isHover ? 0.9 : 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Modifier diamond icon
        const iconY = b.y + 35;
        ctx.save();
        if (isHover) {
            ctx.shadowColor = rarityColor;
            ctx.shadowBlur = 10;
        }
        ctx.fillStyle = rarityColor;
        ctx.beginPath();
        ctx.moveTo(b.x + b.w / 2, iconY - 12);
        ctx.lineTo(b.x + b.w / 2 + 8, iconY);
        ctx.lineTo(b.x + b.w / 2, iconY + 12);
        ctx.lineTo(b.x + b.w / 2 - 8, iconY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Name
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = rarityColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mod.name, b.x + b.w / 2, b.y + 68);

        // Category
        ctx.font = '9px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.fillText(CATEGORY_LABELS[mod.category] || mod.category, b.x + b.w / 2, b.y + 84);

        // Description
        ctx.font = '10px monospace';
        ctx.fillStyle = UI_COLORS.text;
        ctx.globalAlpha = 0.85;
        UITheme.wrapText(ctx, mod.description, b.x + b.w / 2, b.y + 106, b.w - 22, 14);
        ctx.globalAlpha = 1;

        // Rarity badge
        ctx.font = '9px monospace';
        ctx.fillStyle = rarityColor;
        ctx.globalAlpha = 0.7;
        ctx.fillText(mod.rarity.toUpperCase(), b.x + b.w / 2, b.y + b.h - 16);
        ctx.globalAlpha = 1;
    }

    renderAssignPhase(ctx, w, h) {
        // Dark overlay
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, w, h);

        // Title
        const rarityColor = RARITY_COLORS[this.selectedMod.rarity] || UI_COLORS.text;
        UITheme.drawTitle(ctx, `Apply: ${this.selectedMod.name}`, w / 2, 50, 22);

        ctx.font = '11px monospace';
        ctx.fillStyle = rarityColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.selectedMod.shortDescription, w / 2, 80);

        ctx.font = '12px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.fillText('Select a piece to receive this upgrade', w / 2, 105);

        // Piece selection grid
        const pieceBounds = this.getPieceBounds();
        for (let i = 0; i < pieceBounds.length; i++) {
            const b = pieceBounds[i];
            const piece = b.piece;
            const hasMod = piece.hasModifier(this.selectedMod.id);
            const isHover = this.hoverPieceIndex === i;

            UITheme.drawPanel(ctx, b.x, b.y, b.w, b.h, {
                radius: 6,
                shadow: false,
                highlight: isHover && !hasMod,
                glow: isHover && !hasMod,
                fill: hasMod ? '#0e0e12' : (isHover ? '#1a1a28' : UI_COLORS.panel),
            });

            // Piece icon
            if (hasMod) {
                ctx.globalAlpha = 0.3;
            }
            PieceRenderer.draw(ctx, piece, b.x + (b.w - 40) / 2, b.y + 4, 40);
            ctx.globalAlpha = 1;

            // Piece name
            ctx.font = '9px monospace';
            ctx.fillStyle = hasMod ? UI_COLORS.textDim + '60' : UI_COLORS.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(piece.type, b.x + b.w / 2, b.y + 52);

            // Modifier count
            if (piece.modifiers.length > 0) {
                ctx.font = '8px monospace';
                ctx.fillStyle = UI_COLORS.gold;
                ctx.fillText(`${piece.modifiers.length} mod${piece.modifiers.length > 1 ? 's' : ''}`, b.x + b.w / 2, b.y + 64);
            }

            // "Has it" label
            if (hasMod) {
                ctx.font = '8px monospace';
                ctx.fillStyle = UI_COLORS.textDim;
                ctx.fillText('(has it)', b.x + b.w / 2, b.y + b.h - 8);
            }
        }

        // Esc hint
        ctx.font = '10px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.5;
        ctx.fillText('Esc to go back', w / 2, h - 30);
        ctx.globalAlpha = 1;
    }
}
