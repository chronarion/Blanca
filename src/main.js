import { Game } from './core/Game.js';
import { PieceSetLoader } from './render/PieceSetLoader.js';

PieceSetLoader.init();

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);
window.game = game;
game.start();
