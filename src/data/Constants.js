export const TILE_COLORS = {
    light: '#f0d9b5',
    dark: '#b58863',
    lightSelected: '#f7ec5d',
    darkSelected: '#dac32b',
    lightMove: '#aad751',
    darkMove: '#7cb342',
    lightCapture: '#ef5350',
    darkCapture: '#c62828',
    lightCheck: '#ff8a65',
    darkCheck: '#e64a19',
    lightLastMove: '#cdd26a',
    darkLastMove: '#aaa23a',
};

export const PIECE_COLORS = {
    player: '#f0e6d0',
    playerOutline: '#6a5d4a',
    enemy: '#2a2238',
    enemyOutline: '#8a6070',
};

export const UI_COLORS = {
    bg: '#09090d',
    bgLight: '#13131d',
    panel: '#161622',
    panelBorder: '#2a2540',
    text: '#e0d8c8',
    textDim: '#6a6272',
    accent: '#c9a84e',
    accentGlow: '#e0c060',
    accentAlt: '#c04050',
    gold: '#c9a84e',
    success: '#5a9e6a',
    warning: '#d0a040',
    danger: '#c04050',
    info: '#5880b8',
};

export const PIECE_TYPES = {
    PAWN: 'pawn',
    KNIGHT: 'knight',
    BISHOP: 'bishop',
    ROOK: 'rook',
    QUEEN: 'queen',
    KING: 'king',
};

export const TEAMS = {
    PLAYER: 'player',
    ENEMY: 'enemy',
};

export const TERRAIN_TYPES = {
    NONE: 'none',
    FORTRESS: 'fortress',
    ICE: 'ice',
    BRAMBLE: 'bramble',
    VOID: 'void',
    ALTAR: 'altar',
};

export const GAME_STATES = {
    MAIN_MENU: 'mainMenu',
    ARMY_SELECT: 'armySelect',
    MAP: 'map',
    COMBAT: 'combat',
    SHOP: 'shop',
    EVENT: 'event',
    BOSS_INTRO: 'bossIntro',
    GAME_OVER: 'gameOver',
    VICTORY: 'victory',
    PAUSE: 'pause',
    SETTINGS: 'settings',
};

export const BOARD_DEFAULTS = {
    cols: 8,
    rows: 8,
    minSize: 4,
    maxSize: 14,
};

export const ANIMATION = {
    moveDuration: 200,
    captureDuration: 300,
    fadeDuration: 400,
    particleLifetime: 800,
};

export const ROSTER_LIMIT = 16;
export const TOTAL_FLOORS = 10;
export const BOSS_FLOORS = [5, 10];
export const STARTING_GOLD = 0;

export const DRAFT_POINTS = { easy: 20, normal: 14, hard: 8 };
export const DRAFT_COSTS = { pawn: 1, knight: 2, bishop: 2, rook: 3, queen: 5 };
