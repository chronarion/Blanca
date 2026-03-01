import { UI_COLORS, PIECE_TYPES } from '../data/Constants.js';
import { getRandomEvent } from '../data/EventData.js';
import { getRandomModifier } from '../data/ModifierData.js';

export class EventState {
    constructor() {
        this.stateMachine = null;
        this.eventBus = null;
        this.renderer = null;
        this.runManager = null;

        this.event = null;
        this.hoverChoice = -1;
        this.result = null;
        this.resultTimer = 0;

        this.clickHandler = null;
        this.moveHandler = null;
        this.keyHandler = null;
    }

    enter(params = {}) {
        this.event = getRandomEvent(this.runManager ? this.runManager.rng : Math);
        this.hoverChoice = -1;
        this.result = null;
        this.resultTimer = 0;
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

    getChoiceBounds() {
        if (!this.event) return [];
        const btnW = 400;
        const btnH = 44;
        const gap = 10;
        const totalH = this.event.choices.length * (btnH + gap) - gap;
        const startY = this.renderer.height / 2 + 20;
        const x = (this.renderer.width - btnW) / 2;

        return this.event.choices.map((choice, i) => ({
            choice, x, y: startY + i * (btnH + gap), w: btnW, h: btnH,
        }));
    }

    handleClick(data) {
        if (this.result) {
            this.stateMachine.change('map');
            return;
        }

        const bounds = this.getChoiceBounds();
        for (const b of bounds) {
            if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                this.resolveChoice(b.choice);
                return;
            }
        }
    }

    handleMove(data) {
        if (this.result) return;
        const bounds = this.getChoiceBounds();
        this.hoverChoice = -1;
        for (let i = 0; i < bounds.length; i++) {
            const b = bounds[i];
            if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                this.hoverChoice = i;
                break;
            }
        }
    }

    handleKey(data) {
        if (data.code === 'Escape' || (this.result && data.code === 'Enter')) {
            this.stateMachine.change('map');
        }
    }

    meetsRequirement(choice) {
        if (!choice.requirement) return true;
        const rm = this.runManager;
        if (choice.requirement.minGold && rm.gold < choice.requirement.minGold) return false;
        if (choice.requirement.minPawns) {
            const pawnCount = rm.roster.filter(p => p.type === PIECE_TYPES.PAWN).length;
            if (pawnCount < choice.requirement.minPawns) return false;
        }
        return true;
    }

    resolveChoice(choice) {
        if (!this.meetsRequirement(choice)) {
            this.result = "You don't meet the requirements.";
            this.resultTimer = 3;
            return;
        }

        const rm = this.runManager;
        const rng = rm.rng;

        switch (choice.effect) {
            case 'none':
                this.result = 'You move on.';
                break;
            case 'sacrificePawnForRelic': {
                const pawns = rm.roster.filter(p => p.type === PIECE_TYPES.PAWN);
                if (pawns.length > 0) {
                    rm.roster.splice(rm.roster.indexOf(pawns[0]), 1);
                    const relic = rm.relicSystem.getRandomReward(rng);
                    if (relic) {
                        rm.addRelic(relic);
                        this.result = `Sacrificed a pawn. Gained relic: ${relic.name}!`;
                    } else {
                        this.result = 'Sacrificed a pawn, but no relics available.';
                    }
                }
                break;
            }
            case 'buyKnight':
                rm.gold -= 15;
                rm.recruitPiece(PIECE_TYPES.KNIGHT);
                this.result = 'A knight joins your army!';
                break;
            case 'knightChallenge':
                if (rng.random() < 0.6) {
                    rm.recruitPiece(PIECE_TYPES.KNIGHT);
                    this.result = 'You won the challenge! A knight joins for free!';
                } else {
                    const pawns = rm.roster.filter(p => p.type === PIECE_TYPES.PAWN);
                    if (pawns.length > 0) {
                        rm.roster.splice(rm.roster.indexOf(pawns[0]), 1);
                        this.result = 'You lost the challenge and a pawn was defeated.';
                    } else {
                        this.result = 'You lost, but had no pawns to lose.';
                    }
                }
                break;
            case 'randomModifier': {
                const mod = getRandomModifier(rng);
                if (mod) {
                    const validPieces = rm.roster.filter(p => mod.validPieces.includes(p.type));
                    if (validPieces.length > 0) {
                        const target = rng.randomChoice(validPieces);
                        target.addModifier({ ...mod });
                        this.result = `Found ${mod.name} for your ${target.type}!`;
                    } else {
                        this.result = `Found ${mod.name}, but no valid pieces to apply it to.`;
                    }
                }
                break;
            }
            case 'findGold': {
                const gold = rng.randomInt(10, 20);
                rm.gold += gold;
                this.result = `Found ${gold} gold!`;
                break;
            }
            case 'mirrorUpgrade': {
                const pawns = rm.roster.filter(p => p.type === PIECE_TYPES.PAWN);
                if (pawns.length > 0) {
                    rm.roster.splice(rm.roster.indexOf(pawns[0]), 1);
                    const types = [PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK];
                    const upgradeType = rng.randomChoice(types);
                    const mod = getRandomModifier(rng);
                    const upgradePiece = rm.recruitPiece(upgradeType);
                    if (upgradePiece && mod) upgradePiece.addModifier({ ...mod });
                    this.result = `Lost a pawn. Gained a ${upgradeType} with ${mod ? mod.name : 'no modifier'}!`;
                }
                break;
            }
            case 'smashMirrorGold':
                rm.gold += 12;
                this.result = 'Gained 12 gold from the mirror shards.';
                break;
            case 'recruitPawn':
                rm.recruitPiece(PIECE_TYPES.PAWN);
                this.result = 'A pawn has joined your army.';
                break;
            case 'trainModifier': {
                const mod = getRandomModifier(rng);
                if (mod) {
                    const valid = rm.roster.filter(p => mod.validPieces.includes(p.type));
                    if (valid.length > 0) {
                        rng.randomChoice(valid).addModifier({ ...mod });
                        this.result = `Training complete! Gained ${mod.name}.`;
                    } else {
                        this.result = 'No valid pieces to train.';
                    }
                }
                break;
            }
            case 'gamble':
                rm.gold -= 10;
                if (rng.random() < 0.5) {
                    rm.gold += 20;
                    this.result = 'Lucky! You doubled your bet! +20 gold.';
                } else {
                    this.result = 'Unlucky. You lost 10 gold.';
                }
                break;
            case 'robGamblers': {
                const relic = rm.relicSystem.getRandomReward(rng);
                if (relic) rm.addRelic(relic);
                this.result = relic ? `Stole ${relic.name}! But they might come for revenge...` : 'Nothing worth stealing.';
                break;
            }
            case 'promotePawn': {
                const pawns = rm.roster.filter(p => p.type === PIECE_TYPES.PAWN);
                if (pawns.length > 0) {
                    const types = [PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK];
                    const promoType = rng.randomChoice(types);
                    pawns[0].promote(promoType);
                    this.result = `A pawn was promoted to ${promoType}!`;
                }
                break;
            }
            case 'grantFreeTurn':
                rm.addRelic({ id: 'freeMove', name: 'Initiative Crown', description: 'Start each battle with a free move' });
                this.result = 'Gained Initiative Crown — free first move in battles!';
                break;
            default:
                this.result = 'Nothing happened.';
        }

        this.resultTimer = 5;
    }

    update(dt) {
        if (this.resultTimer > 0) this.resultTimer -= dt;
    }

    render(ctx) {
        const w = this.renderer.width;
        if (!this.event) return;

        // Title
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = UI_COLORS.accent;
        ctx.textAlign = 'center';
        ctx.fillText(this.event.title, w / 2, 60);

        // Description
        ctx.font = '14px monospace';
        ctx.fillStyle = UI_COLORS.text;
        this.wrapText(ctx, this.event.description, w / 2, 110, 500, 20);

        if (this.result) {
            // Show result
            ctx.font = 'bold 16px monospace';
            ctx.fillStyle = UI_COLORS.success;
            ctx.textAlign = 'center';
            this.wrapText(ctx, this.result, w / 2, this.renderer.height / 2, 400, 22);

            ctx.font = '12px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            ctx.fillText('Click to continue', w / 2, this.renderer.height - 50);
        } else {
            // Show choices
            const bounds = this.getChoiceBounds();
            for (let i = 0; i < bounds.length; i++) {
                const b = bounds[i];
                const choice = b.choice;
                const isHover = this.hoverChoice === i;
                const canChoose = this.meetsRequirement(choice);

                ctx.fillStyle = isHover ? UI_COLORS.panel : UI_COLORS.bgLight;
                ctx.fillRect(b.x, b.y, b.w, b.h);
                ctx.strokeStyle = canChoose ? (isHover ? UI_COLORS.accent : UI_COLORS.panelBorder) : '#555';
                ctx.lineWidth = isHover ? 2 : 1;
                ctx.strokeRect(b.x, b.y, b.w, b.h);

                ctx.font = '13px monospace';
                ctx.fillStyle = canChoose ? UI_COLORS.text : UI_COLORS.textDim;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(choice.text, b.x + b.w / 2, b.y + b.h / 2);
            }
        }
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let lineNum = 0;
        for (const word of words) {
            const test = line + (line ? ' ' : '') + word;
            if (ctx.measureText(test).width > maxWidth && line) {
                ctx.fillText(line, x, y + lineNum * lineHeight);
                line = word;
                lineNum++;
            } else {
                line = test;
            }
        }
        if (line) ctx.fillText(line, x, y + lineNum * lineHeight);
    }
}
