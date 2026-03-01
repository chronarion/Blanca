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
    player: '#ffffff',
    playerOutline: '#333333',
    enemy: '#1a1a2e',
    enemyOutline: '#666666',
};

export const UI_COLORS = {
    bg: '#0a0a0f',
    bgLight: '#1a1a2e',
    panel: '#16213e',
    panelBorder: '#0f3460',
    text: '#e0e0e0',
    textDim: '#888888',
    accent: '#e94560',
    accentGlow: '#ff6b81',
    gold: '#ffd700',
    success: '#4caf50',
    warning: '#ff9800',
    danger: '#f44336',
    info: '#2196f3',
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
