let nextId = 1;

export class Piece {
    constructor(type, team, col = 0, row = 0) {
        this.id = nextId++;
        this.type = type;
        this.team = team;
        this.col = col;
        this.row = row;
        this.hasMoved = false;
        this.moveCount = 0;
        this.modifiers = [];
        this.isFrozen = false;
        this.promotedFrom = null;
        this.originalType = type;
    }

    addModifier(modifier) {
        this.modifiers.push(modifier);
    }

    removeModifier(modifierId) {
        const idx = this.modifiers.findIndex(m => m.id === modifierId);
        if (idx !== -1) this.modifiers.splice(idx, 1);
    }

    hasModifier(modifierId) {
        return this.modifiers.some(m => m.id === modifierId);
    }

    getModifiersByType(type) {
        return this.modifiers.filter(m => m.type === type);
    }

    promote(newType) {
        this.promotedFrom = this.type;
        this.type = newType;
        // Strip modifiers not valid for the new type (army ability modifiers lack validPieces and are preserved)
        this.modifiers = this.modifiers.filter(m =>
            !m.validPieces || m.validPieces.includes(newType)
        );
    }

    clone() {
        const copy = new Piece(this.type, this.team, this.col, this.row);
        copy.id = this.id;
        copy.hasMoved = this.hasMoved;
        copy.moveCount = this.moveCount;
        copy.modifiers = this.modifiers.map(m => ({ ...m }));
        copy.isFrozen = this.isFrozen;
        copy.promotedFrom = this.promotedFrom;
        copy.originalType = this.originalType;
        return copy;
    }

    serialize() {
        return {
            id: this.id,
            type: this.type,
            team: this.team,
            col: this.col,
            row: this.row,
            hasMoved: this.hasMoved,
            moveCount: this.moveCount,
            modifiers: this.modifiers.map(m => ({ ...m })),
            isFrozen: this.isFrozen,
            promotedFrom: this.promotedFrom,
            originalType: this.originalType,
        };
    }

    static deserialize(data) {
        const piece = new Piece(data.type, data.team, data.col, data.row);
        piece.id = data.id;
        piece.hasMoved = data.hasMoved;
        piece.moveCount = data.moveCount;
        piece.modifiers = data.modifiers || [];
        piece.isFrozen = data.isFrozen || false;
        piece.promotedFrom = data.promotedFrom || null;
        piece.originalType = data.originalType || data.type;
        if (data.id >= nextId) nextId = data.id + 1;
        return piece;
    }
}
