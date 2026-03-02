import { PieceRenderer } from '../render/PieceRenderer.js';
import { Piece } from '../pieces/Piece.js';
import { TEAMS, UI_COLORS, PIECE_TYPES, DRAFT_POINTS, DRAFT_COSTS } from '../data/Constants.js';
import { UITheme } from '../ui/UITheme.js';

const DIFFICULTIES = [
    { id: 'easy', name: 'Easy', points: DRAFT_POINTS.easy, color: '#5a9e6a', desc: 'A generous budget to build your army' },
    { id: 'normal', name: 'Normal', points: DRAFT_POINTS.normal, color: '#c9a84e', desc: 'A balanced challenge' },
    { id: 'hard', name: 'Hard', points: DRAFT_POINTS.hard, color: '#c04050', desc: 'A lean, punishing roster' },
];

const DRAFT_PIECES = [
    { type: PIECE_TYPES.PAWN, cost: DRAFT_COSTS.pawn },
    { type: PIECE_TYPES.KNIGHT, cost: DRAFT_COSTS.knight },
    { type: PIECE_TYPES.BISHOP, cost: DRAFT_COSTS.bishop },
    { type: PIECE_TYPES.ROOK, cost: DRAFT_COSTS.rook },
    { type: PIECE_TYPES.QUEEN, cost: DRAFT_COSTS.queen },
];

const PRESETS = [
    {
        name: 'Classic',
        desc: 'Balanced officers + pawns',
        build(budget) {
            const c = {};
            let rem = budget;
            // Queen if budget allows after basics
            if (rem >= 14) { c.queen = 1; rem -= 5; }
            if (rem >= 3) { c.rook = 1; rem -= 3; }
            const knightCount = Math.min(2, Math.floor(rem / 2));
            if (knightCount > 0) { c.knight = knightCount; rem -= knightCount * 2; }
            if (rem >= 2) { c.bishop = 1; rem -= 2; }
            if (rem > 0) { c.pawn = rem; }
            return c;
        },
    },
    {
        name: 'Cavalry',
        desc: 'Knights with pawn support',
        build(budget) {
            const c = {};
            let rem = budget;
            const knightCount = Math.min(4, Math.floor(rem / 2));
            // Save at least 2 pts for pawns
            const knights = Math.min(knightCount, Math.floor((rem - 2) / 2));
            c.knight = Math.max(1, knights);
            rem -= c.knight * 2;
            if (rem > 0) c.pawn = rem;
            return c;
        },
    },
    {
        name: 'Artillery',
        desc: 'Queen + rook firepower',
        build(budget) {
            const c = {};
            let rem = budget;
            if (rem >= 5) { c.queen = 1; rem -= 5; }
            const rookCount = Math.min(2, Math.floor(rem / 3));
            if (rookCount > 0) { c.rook = rookCount; rem -= rookCount * 3; }
            if (rem >= 2 && !c.queen) { c.bishop = 1; rem -= 2; }
            if (rem > 0) c.pawn = rem;
            return c;
        },
    },
    {
        name: 'Horde',
        desc: 'Maximum pieces',
        build(budget) {
            return { pawn: budget };
        },
    },
];

export class ArmySelectState {
    constructor() {
        this.stateMachine = null;
        this.eventBus = null;
        this.renderer = null;
        this.runManager = null;

        this.phase = 'difficulty'; // 'difficulty' | 'draft'
        this.selectedDifficulty = null;
        this.hoverIndex = -1;

        // Draft state
        this.pointBudget = 0;
        this.pointsSpent = 0;
        this.draftCounts = {};  // type -> count
        this.hoverButton = null; // { type, action } or 'start' or 'back'
        this.hoverPreset = -1;

        this.clickHandler = null;
        this.moveHandler = null;
        this.keyHandler = null;
    }

    enter() {
        this.phase = 'difficulty';
        this.selectedDifficulty = null;
        this.hoverIndex = -1;
        this.hoverButton = null;
        this.hoverPreset = -1;
        this.draftCounts = {};
        this.pointsSpent = 0;
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

    // === DIFFICULTY PHASE ===

    getDifficultyCardBounds() {
        const cardW = 170;
        const cardH = 200;
        const gap = 20;
        const totalW = DIFFICULTIES.length * (cardW + gap) - gap;
        const startX = (this.renderer.width - totalW) / 2;
        const y = this.renderer.height / 2 - cardH / 2 + 20;

        return DIFFICULTIES.map((_, i) => ({
            x: startX + i * (cardW + gap), y, w: cardW, h: cardH,
        }));
    }

    // === DRAFT PHASE ===

    getPointsRemaining() {
        return this.pointBudget - this.pointsSpent;
    }

    getTotalPieces() {
        let count = 1; // King
        for (const type of Object.keys(this.draftCounts)) {
            count += this.draftCounts[type];
        }
        return count;
    }

    getDraftRowBounds() {
        const rowH = 50;
        const rowW = 320;
        const gap = 6;
        const startX = (this.renderer.width - rowW) / 2;
        const startY = 180;

        return DRAFT_PIECES.map((p, i) => ({
            x: startX, y: startY + i * (rowH + gap), w: rowW, h: rowH,
            type: p.type, cost: p.cost,
            minusBtn: { x: startX + rowW - 80, y: startY + i * (rowH + gap) + 10, w: 30, h: 30 },
            plusBtn: { x: startX + rowW - 40, y: startY + i * (rowH + gap) + 10, w: 30, h: 30 },
        }));
    }

    getPresetBounds() {
        const btnW = 72;
        const btnH = 26;
        const gap = 8;
        const totalW = PRESETS.length * (btnW + gap) - gap;
        const startX = (this.renderer.width - totalW) / 2;
        const y = 120;
        return PRESETS.map((p, i) => ({
            x: startX + i * (btnW + gap), y, w: btnW, h: btnH, preset: p,
        }));
    }

    applyPreset(preset) {
        const counts = preset.build(this.pointBudget);
        this.draftCounts = {};
        this.pointsSpent = 0;
        for (const [type, count] of Object.entries(counts)) {
            if (count > 0) {
                this.draftCounts[type] = count;
                this.pointsSpent += count * DRAFT_COSTS[type];
            }
        }
    }

    getStartButton() {
        const bw = 160;
        const bh = 44;
        return { x: (this.renderer.width - bw) / 2, y: this.renderer.height - 80, w: bw, h: bh };
    }

    getBackButton() {
        return { x: 20, y: 20, w: 70, h: 30 };
    }

    canStart() {
        return this.getTotalPieces() >= 2; // King + at least 1 other
    }

    // === INPUT ===

    handleClick(data) {
        if (this.phase === 'difficulty') {
            const bounds = this.getDifficultyCardBounds();
            for (let i = 0; i < bounds.length; i++) {
                const b = bounds[i];
                if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                    this.selectDifficulty(i);
                    return;
                }
            }
        } else if (this.phase === 'draft') {
            // Back button
            const back = this.getBackButton();
            if (data.x >= back.x && data.x <= back.x + back.w && data.y >= back.y && data.y <= back.y + back.h) {
                this.phase = 'difficulty';
                this.hoverButton = null;
                return;
            }

            // Start button
            const start = this.getStartButton();
            if (data.x >= start.x && data.x <= start.x + start.w && data.y >= start.y && data.y <= start.y + start.h) {
                if (this.canStart()) {
                    this.startDraftRun();
                }
                return;
            }

            // Preset buttons
            const presets = this.getPresetBounds();
            for (let i = 0; i < presets.length; i++) {
                const b = presets[i];
                if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                    this.applyPreset(b.preset);
                    return;
                }
            }

            // +/- buttons
            const rows = this.getDraftRowBounds();
            for (const row of rows) {
                const minus = row.minusBtn;
                if (data.x >= minus.x && data.x <= minus.x + minus.w && data.y >= minus.y && data.y <= minus.y + minus.h) {
                    this.removePiece(row.type);
                    return;
                }
                const plus = row.plusBtn;
                if (data.x >= plus.x && data.x <= plus.x + plus.w && data.y >= plus.y && data.y <= plus.y + plus.h) {
                    this.addPiece(row.type, row.cost);
                    return;
                }
            }
        }
    }

    handleMove(data) {
        this.hoverButton = null;
        this.hoverIndex = -1;
        this.hoverPreset = -1;

        if (this.phase === 'difficulty') {
            const bounds = this.getDifficultyCardBounds();
            for (let i = 0; i < bounds.length; i++) {
                const b = bounds[i];
                if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                    this.hoverIndex = i;
                    break;
                }
            }
        } else if (this.phase === 'draft') {
            const back = this.getBackButton();
            if (data.x >= back.x && data.x <= back.x + back.w && data.y >= back.y && data.y <= back.y + back.h) {
                this.hoverButton = 'back';
                return;
            }

            const start = this.getStartButton();
            if (data.x >= start.x && data.x <= start.x + start.w && data.y >= start.y && data.y <= start.y + start.h) {
                this.hoverButton = 'start';
                return;
            }

            const presets = this.getPresetBounds();
            for (let i = 0; i < presets.length; i++) {
                const b = presets[i];
                if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                    this.hoverPreset = i;
                    return;
                }
            }

            const rows = this.getDraftRowBounds();
            for (const row of rows) {
                const minus = row.minusBtn;
                if (data.x >= minus.x && data.x <= minus.x + minus.w && data.y >= minus.y && data.y <= minus.y + minus.h) {
                    this.hoverButton = { type: row.type, action: 'minus' };
                    return;
                }
                const plus = row.plusBtn;
                if (data.x >= plus.x && data.x <= plus.x + plus.w && data.y >= plus.y && data.y <= plus.y + plus.h) {
                    this.hoverButton = { type: row.type, action: 'plus' };
                    return;
                }
            }
        }
    }

    handleKey(data) {
        if (data.code === 'Escape') {
            if (this.phase === 'draft') {
                this.phase = 'difficulty';
                this.hoverButton = null;
            } else {
                this.stateMachine.change('mainMenu');
            }
        }
    }

    selectDifficulty(index) {
        this.selectedDifficulty = DIFFICULTIES[index];
        this.pointBudget = this.selectedDifficulty.points;
        this.pointsSpent = 0;
        this.draftCounts = {};
        this.phase = 'draft';
        this.hoverButton = null;
    }

    addPiece(type, cost) {
        if (this.getPointsRemaining() < cost) return;
        if (!this.draftCounts[type]) this.draftCounts[type] = 0;
        this.draftCounts[type]++;
        this.pointsSpent += cost;
    }

    removePiece(type) {
        if (!this.draftCounts[type] || this.draftCounts[type] <= 0) return;
        const cost = DRAFT_COSTS[type];
        this.draftCounts[type]--;
        this.pointsSpent -= cost;
    }

    startDraftRun() {
        if (!this.canStart()) return;

        // Build piece types array
        const pieceTypes = [];
        for (const [type, count] of Object.entries(this.draftCounts)) {
            for (let i = 0; i < count; i++) {
                pieceTypes.push(type);
            }
        }

        if (this.runManager) {
            this.runManager.startRunFromDraft(this.selectedDifficulty.id, pieceTypes);
            this.stateMachine.change('upgrade', {
                nextState: 'map',
                nextParams: {},
                source: 'draft',
            });
        }
    }

    update(dt) {}

    render(ctx) {
        const w = this.renderer.width;
        const h = this.renderer.height;

        UITheme.drawBackground(ctx, w, h);
        UITheme.drawVignette(ctx, w, h, 0.4);

        if (this.phase === 'difficulty') {
            this.renderDifficultyPhase(ctx, w, h);
        } else {
            this.renderDraftPhase(ctx, w, h);
        }
    }

    renderDifficultyPhase(ctx, w, h) {
        UITheme.drawTitle(ctx, 'Choose Difficulty', w / 2, 55, 30);

        ctx.font = '13px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Difficulty determines your draft budget', w / 2, 90);

        UITheme.drawDivider(ctx, w / 2 - 140, 110, 280);

        const bounds = this.getDifficultyCardBounds();

        for (let i = 0; i < DIFFICULTIES.length; i++) {
            const diff = DIFFICULTIES[i];
            const b = bounds[i];
            const isHover = this.hoverIndex === i;

            UITheme.drawPanel(ctx, b.x, b.y, b.w, b.h, {
                highlight: isHover,
                glow: isHover,
                fill: isHover ? '#1a1a28' : UI_COLORS.panel,
            });

            // Color accent bar
            ctx.beginPath();
            UITheme.roundRect(ctx, b.x + 1, b.y + 1, b.w - 2, 3, 2);
            ctx.fillStyle = diff.color;
            ctx.globalAlpha = isHover ? 0.8 : 0.4;
            ctx.fill();
            ctx.globalAlpha = 1;

            // Name
            ctx.font = 'bold 18px monospace';
            ctx.fillStyle = isHover ? diff.color : UI_COLORS.text;
            ctx.textAlign = 'center';
            ctx.fillText(diff.name, b.x + b.w / 2, b.y + 40);

            // Points
            ctx.font = 'bold 36px monospace';
            ctx.fillStyle = diff.color;
            ctx.fillText(`${diff.points}`, b.x + b.w / 2, b.y + 90);

            ctx.font = '11px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            ctx.fillText('points', b.x + b.w / 2, b.y + 115);

            // Description
            ctx.font = '10px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            UITheme.wrapText(ctx, diff.desc, b.x + b.w / 2, b.y + 145, b.w - 24, 14);
        }

        // Instructions
        ctx.font = '12px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.6;
        ctx.fillText('Click to select  |  Esc to go back', w / 2, h - 40);
        ctx.globalAlpha = 1;
    }

    renderDraftPhase(ctx, w, h) {
        // Back button
        const back = this.getBackButton();
        UITheme.drawButton(ctx, back.x, back.y, back.w, back.h, '< Back', this.hoverButton === 'back', { fontSize: 11 });

        // Title
        UITheme.drawTitle(ctx, 'Draft Your Army', w / 2, 40, 26);

        // Points remaining
        const remaining = this.getPointsRemaining();
        const diffColor = this.selectedDifficulty.color;
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = remaining > 0 ? diffColor : UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${remaining} / ${this.pointBudget} points`, w / 2, 75);

        // Difficulty label
        ctx.font = '11px monospace';
        ctx.fillStyle = diffColor;
        ctx.globalAlpha = 0.6;
        ctx.fillText(this.selectedDifficulty.name, w / 2, 96);
        ctx.globalAlpha = 1;

        UITheme.drawDivider(ctx, w / 2 - 120, 112, 240);

        // Preset buttons
        const presetBounds = this.getPresetBounds();
        for (let i = 0; i < presetBounds.length; i++) {
            const b = presetBounds[i];
            const isHover = this.hoverPreset === i;
            UITheme.drawButton(ctx, b.x, b.y, b.w, b.h, b.preset.name, isHover, {
                fontSize: 10,
                textColor: isHover ? UI_COLORS.accent : UI_COLORS.textDim,
                border: isHover ? UI_COLORS.accent + '60' : UI_COLORS.panelBorder + '80',
            });
        }

        // King row (always included, free)
        const rows = this.getDraftRowBounds();
        const kingY = rows[0].y - 56;
        const kingX = rows[0].x;

        UITheme.drawPanel(ctx, kingX, kingY, rows[0].w, 44, {
            fill: '#1a1a1e',
            border: UI_COLORS.gold + '40',
        });

        const kingPiece = new Piece(PIECE_TYPES.KING, TEAMS.PLAYER);
        PieceRenderer.draw(ctx, kingPiece, kingX + 8, kingY + 6, 32);
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = UI_COLORS.gold;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('King', kingX + 48, kingY + 16);
        ctx.font = '10px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.fillText('Always included  (free)', kingX + 48, kingY + 32);

        // Piece rows
        for (const row of rows) {
            const count = this.draftCounts[row.type] || 0;
            const canAdd = remaining >= row.cost;

            UITheme.drawPanel(ctx, row.x, row.y, row.w, row.h, {
                fill: count > 0 ? '#181825' : UI_COLORS.panel,
            });

            // Piece icon
            const tempPiece = new Piece(row.type, TEAMS.PLAYER);
            PieceRenderer.draw(ctx, tempPiece, row.x + 8, row.y + 9, 32);

            // Name and cost
            ctx.font = 'bold 13px monospace';
            ctx.fillStyle = UI_COLORS.text;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const label = row.type.charAt(0).toUpperCase() + row.type.slice(1);
            ctx.fillText(label, row.x + 48, row.y + 18);

            ctx.font = '10px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            ctx.fillText(`${row.cost} pts each`, row.x + 48, row.y + 34);

            // Count
            ctx.font = 'bold 16px monospace';
            ctx.fillStyle = count > 0 ? UI_COLORS.accent : UI_COLORS.textDim;
            ctx.textAlign = 'center';
            ctx.fillText(`${count}`, row.x + row.w - 60, row.y + row.h / 2);

            // Minus button
            const isMinusHover = this.hoverButton && this.hoverButton.type === row.type && this.hoverButton.action === 'minus';
            this._drawSmallButton(ctx, row.minusBtn, '-', count > 0, isMinusHover);

            // Plus button
            const isPlusHover = this.hoverButton && this.hoverButton.type === row.type && this.hoverButton.action === 'plus';
            this._drawSmallButton(ctx, row.plusBtn, '+', canAdd, isPlusHover);
        }

        // Roster preview (right side)
        this._drawRosterPreview(ctx, w, h, rows);

        // Start button
        const start = this.getStartButton();
        const canStartRun = this.canStart();
        UITheme.drawButton(ctx, start.x, start.y, start.w, start.h, 'Start Run', this.hoverButton === 'start' && canStartRun, {
            textColor: canStartRun ? UI_COLORS.text : UI_COLORS.textDim,
            border: canStartRun ? UI_COLORS.panelBorder : '#1a1a1e',
        });

        if (!canStartRun) {
            ctx.font = '10px monospace';
            ctx.fillStyle = UI_COLORS.danger;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Need at least 1 piece besides King', w / 2, start.y + start.h + 16);
        }
    }

    _drawSmallButton(ctx, btn, text, enabled, isHover) {
        ctx.beginPath();
        UITheme.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 4);
        if (!enabled) {
            ctx.fillStyle = '#0e0e14';
        } else if (isHover) {
            ctx.fillStyle = 'rgba(200, 168, 78, 0.2)';
        } else {
            ctx.fillStyle = UI_COLORS.panel;
        }
        ctx.fill();

        ctx.beginPath();
        UITheme.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 4);
        ctx.strokeStyle = enabled ? (isHover ? UI_COLORS.accent : UI_COLORS.panelBorder) : '#1a1a1e';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = enabled ? (isHover ? UI_COLORS.accent : UI_COLORS.text) : UI_COLORS.textDim + '40';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }

    _drawRosterPreview(ctx, w, h, rows) {
        // Draw drafted pieces as mini icons on the right side
        const previewX = rows[0].x + rows[0].w + 30;
        const previewY = rows[0].y - 56;

        if (previewX + 100 > w) return; // Not enough space

        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('Roster', previewX, previewY);

        let y = previewY + 20;
        const size = 24;
        const gap = 4;
        const perRow = 4;
        let col = 0;

        // King first
        const kingPiece = new Piece(PIECE_TYPES.KING, TEAMS.PLAYER);
        PieceRenderer.draw(ctx, kingPiece, previewX + col * (size + gap), y, size);
        col++;

        // Then drafted pieces
        for (const [type, count] of Object.entries(this.draftCounts)) {
            for (let i = 0; i < count; i++) {
                if (col >= perRow) {
                    col = 0;
                    y += size + gap;
                }
                const p = new Piece(type, TEAMS.PLAYER);
                PieceRenderer.draw(ctx, p, previewX + col * (size + gap), y, size);
                col++;
            }
        }

        // Total count
        ctx.font = '10px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        y += size + gap + 8;
        ctx.fillText(`${this.getTotalPieces()} pieces`, previewX, y);
    }
}
