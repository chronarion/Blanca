const CDN_BASE = 'https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece';

export const PIECE_SETS = [
    'original',
    'alpha', 'anarcandy', 'caliente', 'california', 'cardinal',
    'cburnett', 'celtic', 'chess7', 'chessnut', 'companion',
    'cooke', 'disguised', 'dubrovny', 'fantasy', 'fresca',
    'gioco', 'governor', 'horsey', 'icpieces', 'kosal',
    'leipzig', 'letter', 'maestro', 'merida', 'monarchy',
    'mono', 'mpchess', 'pirouetti', 'pixel', 'reillycraig',
    'riohacha', 'shapes', 'spatial', 'staunty', 'tatiana',
];

const PIECE_FILE_MAP = {
    pawn: 'P', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K',
};

const TEAM_PREFIX = {
    player: 'w',
    enemy: 'b',
};

const STORAGE_KEY = 'blanca_pieceSet';

export class PieceSetLoader {
    static _cache = {};       // { setName: { 'player_pawn': Image, ... } }
    static _loading = {};     // { setName: Promise }
    static _currentSet = null;

    static init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        this._currentSet = (saved && PIECE_SETS.includes(saved)) ? saved : 'original';
        if (this._currentSet !== 'original') {
            this.loadSet(this._currentSet);
        }
    }

    static getCurrentSet() {
        return this._currentSet;
    }

    static setCurrentSet(name) {
        this._currentSet = name;
        localStorage.setItem(STORAGE_KEY, name);
        if (name !== 'original') {
            this.loadSet(name);
        }
    }

    static getImage(team, pieceType) {
        if (this._currentSet === 'original') return null;
        const set = this._cache[this._currentSet];
        if (!set) return null;
        const key = `${team}_${pieceType}`;
        return set[key] || null;
    }

    static isLoaded(setName) {
        if (setName === 'original') return true;
        return !!this._cache[setName];
    }

    static loadSet(setName) {
        if (setName === 'original') return Promise.resolve();
        if (this._cache[setName]) return Promise.resolve();
        if (this._loading[setName]) return this._loading[setName];

        const images = {};
        const promises = [];

        for (const [team, prefix] of Object.entries(TEAM_PREFIX)) {
            for (const [pieceType, fileLetter] of Object.entries(PIECE_FILE_MAP)) {
                const url = `${CDN_BASE}/${setName}/${prefix}${fileLetter}.svg`;
                const key = `${team}_${pieceType}`;
                const p = new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => { images[key] = img; resolve(); };
                    img.onerror = () => { resolve(); }; // skip failed loads
                    img.src = url;
                });
                promises.push(p);
            }
        }

        this._loading[setName] = Promise.all(promises).then(() => {
            this._cache[setName] = images;
            delete this._loading[setName];
        });

        return this._loading[setName];
    }
}
