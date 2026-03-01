(() => {
  // src/core/EventBus.js
  var EventBus = class {
    constructor() {
      this.listeners = /* @__PURE__ */ new Map();
    }
    on(event, callback, context = null) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push({ callback, context });
      return () => this.off(event, callback);
    }
    off(event, callback) {
      const list = this.listeners.get(event);
      if (!list) return;
      const idx = list.findIndex((l) => l.callback === callback);
      if (idx !== -1) list.splice(idx, 1);
    }
    emit(event, data) {
      const list = this.listeners.get(event);
      if (!list) return;
      for (const { callback, context } of [...list]) {
        callback.call(context, data);
      }
    }
    clear() {
      this.listeners.clear();
    }
  };

  // src/core/GameLoop.js
  var GameLoop = class {
    constructor(updateFn, renderFn) {
      this.updateFn = updateFn;
      this.renderFn = renderFn;
      this.running = false;
      this.lastTime = 0;
      this.accumulator = 0;
      this.fixedStep = 1e3 / 60;
      this.maxDelta = 100;
      this.rafId = null;
    }
    start() {
      if (this.running) return;
      this.running = true;
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame((t) => this.tick(t));
    }
    stop() {
      this.running = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
    tick(timestamp) {
      if (!this.running) return;
      let delta = timestamp - this.lastTime;
      this.lastTime = timestamp;
      if (delta > this.maxDelta) delta = this.maxDelta;
      this.accumulator += delta;
      while (this.accumulator >= this.fixedStep) {
        this.updateFn(this.fixedStep / 1e3);
        this.accumulator -= this.fixedStep;
      }
      this.renderFn();
      this.rafId = requestAnimationFrame((t) => this.tick(t));
    }
  };

  // src/core/StateMachine.js
  var StateMachine = class {
    constructor(eventBus) {
      this.states = /* @__PURE__ */ new Map();
      this.currentState = null;
      this.currentName = null;
      this.eventBus = eventBus;
      this.stateStack = [];
    }
    add(name, state) {
      this.states.set(name, state);
      state.stateMachine = this;
      state.eventBus = this.eventBus;
    }
    change(name, params = {}) {
      if (this.currentState && this.currentState.exit) {
        this.currentState.exit();
      }
      this.currentState = this.states.get(name);
      this.currentName = name;
      if (!this.currentState) {
        throw new Error(`State '${name}' not found`);
      }
      if (this.currentState.enter) {
        this.currentState.enter(params);
      }
      this.eventBus.emit("stateChanged", { name, params });
    }
    push(name, params = {}) {
      if (this.currentState) {
        if (this.currentState.pause) this.currentState.pause();
        this.stateStack.push({ state: this.currentState, name: this.currentName });
      }
      this.currentState = this.states.get(name);
      this.currentName = name;
      if (this.currentState.enter) {
        this.currentState.enter(params);
      }
    }
    pop() {
      if (this.currentState && this.currentState.exit) {
        this.currentState.exit();
      }
      const prev = this.stateStack.pop();
      if (prev) {
        this.currentState = prev.state;
        this.currentName = prev.name;
        if (this.currentState.resume) this.currentState.resume();
      }
    }
    update(dt) {
      if (this.currentState && this.currentState.update) {
        this.currentState.update(dt);
      }
    }
    render(ctx) {
      if (this.currentState && this.currentState.render) {
        this.currentState.render(ctx);
      }
    }
    handleInput(type, data) {
      if (this.currentState && this.currentState.handleInput) {
        this.currentState.handleInput(type, data);
      }
    }
  };

  // src/core/InputManager.js
  var InputManager = class {
    constructor(canvas2, eventBus) {
      this.canvas = canvas2;
      this.eventBus = eventBus;
      this.mouse = { x: 0, y: 0, down: false };
      this.keys = /* @__PURE__ */ new Set();
      this.setupListeners();
    }
    setupListeners() {
      this.canvas.addEventListener("mousemove", (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
        this.eventBus.emit("mousemove", { x: this.mouse.x, y: this.mouse.y });
      });
      this.canvas.addEventListener("mousedown", (e) => {
        this.mouse.down = true;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.eventBus.emit("click", { x, y, button: e.button });
      });
      this.canvas.addEventListener("mouseup", () => {
        this.mouse.down = false;
      });
      this.canvas.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.eventBus.emit("rightclick", { x, y });
      });
      window.addEventListener("keydown", (e) => {
        if (!this.keys.has(e.code)) {
          this.keys.add(e.code);
          this.eventBus.emit("keydown", { code: e.code, key: e.key });
        }
      });
      window.addEventListener("keyup", (e) => {
        this.keys.delete(e.code);
        this.eventBus.emit("keyup", { code: e.code, key: e.key });
      });
    }
    isKeyDown(code) {
      return this.keys.has(code);
    }
  };

  // src/render/Renderer.js
  var Renderer = class {
    constructor(canvas2) {
      this.canvas = canvas2;
      this.ctx = canvas2.getContext("2d");
      this.width = 0;
      this.height = 0;
      this.resize();
      window.addEventListener("resize", () => this.resize());
    }
    resize() {
      const dpr = window.devicePixelRatio || 1;
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    clear(color = "#0a0a0f") {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
    get context() {
      return this.ctx;
    }
  };

  // src/audio/SoundGenerator.js
  var SoundGenerator = class {
    constructor(audioCtx) {
      this.ctx = audioCtx;
    }
    createNoise(duration = 0.1) {
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    }
    playTone(freq, duration = 0.15, type = "square", volume = 0.1) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(1e-3, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    }
    playNoise(duration = 0.05, volume = 0.05) {
      const buffer = this.createNoise(duration);
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(1e-3, this.ctx.currentTime + duration);
      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start();
    }
    playClick() {
      this.playTone(800, 0.05, "square", 0.04);
    }
    playMove() {
      this.playTone(400, 0.08, "triangle", 0.06);
      setTimeout(() => this.playTone(500, 0.06, "triangle", 0.04), 40);
    }
    playCapture() {
      this.playNoise(0.08, 0.08);
      this.playTone(200, 0.15, "sawtooth", 0.08);
      setTimeout(() => this.playTone(150, 0.1, "sawtooth", 0.05), 50);
    }
    playPromotion() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.15, "triangle", 0.06), i * 80);
      });
    }
    playVictory() {
      const melody = [523, 659, 784, 1047, 784, 1047];
      melody.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.2, "triangle", 0.07), i * 120);
      });
    }
    playDefeat() {
      const melody = [400, 350, 300, 200];
      melody.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.3, "sawtooth", 0.06), i * 200);
      });
    }
    playShopBuy() {
      this.playTone(600, 0.1, "triangle", 0.05);
      setTimeout(() => this.playTone(800, 0.1, "triangle", 0.05), 60);
    }
    playCheck() {
      this.playTone(880, 0.1, "square", 0.06);
      setTimeout(() => this.playTone(660, 0.15, "square", 0.04), 80);
    }
    playBossPhase() {
      this.playNoise(0.3, 0.06);
      this.playTone(150, 0.4, "sawtooth", 0.1);
      setTimeout(() => this.playTone(100, 0.5, "sawtooth", 0.08), 200);
    }
  };

  // src/audio/SFXPlayer.js
  var SFXPlayer = class {
    constructor(audioCtx) {
      this.generator = new SoundGenerator(audioCtx);
      this.enabled = true;
    }
    play(sfxName) {
      if (!this.enabled) return;
      switch (sfxName) {
        case "click":
          this.generator.playClick();
          break;
        case "move":
          this.generator.playMove();
          break;
        case "capture":
          this.generator.playCapture();
          break;
        case "promotion":
          this.generator.playPromotion();
          break;
        case "victory":
          this.generator.playVictory();
          break;
        case "defeat":
          this.generator.playDefeat();
          break;
        case "shopBuy":
          this.generator.playShopBuy();
          break;
        case "check":
          this.generator.playCheck();
          break;
        case "bossPhase":
          this.generator.playBossPhase();
          break;
      }
    }
  };

  // src/audio/MusicPlayer.js
  var MusicPlayer = class {
    constructor(audioCtx) {
      this.ctx = audioCtx;
      this.enabled = true;
      this.volume = 0.03;
      this.currentLoop = null;
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.gainNode.connect(this.ctx.destination);
      this.playing = false;
    }
    playAmbient() {
      if (!this.enabled || this.playing) return;
      this.playing = true;
      this.scheduleLoop();
    }
    scheduleLoop() {
      if (!this.playing) return;
      const now = this.ctx.currentTime;
      const notes = [
        { freq: 130, time: 0 },
        { freq: 164, time: 1.5 },
        { freq: 196, time: 3 },
        { freq: 164, time: 4.5 },
        { freq: 130, time: 6 },
        { freq: 110, time: 7.5 }
      ];
      for (const note of notes) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(note.freq, now + note.time);
        gain.gain.setValueAtTime(0, now + note.time);
        gain.gain.linearRampToValueAtTime(this.volume, now + note.time + 0.3);
        gain.gain.linearRampToValueAtTime(0, now + note.time + 1.4);
        osc.connect(gain);
        gain.connect(this.gainNode);
        osc.start(now + note.time);
        osc.stop(now + note.time + 1.5);
      }
      this.currentLoop = setTimeout(() => this.scheduleLoop(), 9e3);
    }
    stop() {
      this.playing = false;
      if (this.currentLoop) {
        clearTimeout(this.currentLoop);
        this.currentLoop = null;
      }
    }
    setVolume(vol) {
      this.volume = vol;
      this.gainNode.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
  };

  // src/audio/AudioManager.js
  var AudioManager = class {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.ctx = null;
      this.sfx = null;
      this.music = null;
      this.initialized = false;
    }
    init() {
      if (this.initialized) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.sfx = new SFXPlayer(this.ctx);
        this.music = new MusicPlayer(this.ctx);
        this.initialized = true;
        this.setupListeners();
      } catch (e) {
        console.warn("Audio not available:", e);
      }
    }
    setupListeners() {
      this.eventBus.on("click", () => {
        if (!this.initialized) this.init();
        if (this.ctx && this.ctx.state === "suspended") {
          this.ctx.resume();
        }
      });
      this.eventBus.on("pieceCaptured", () => this.playSFX("capture"));
      this.eventBus.on("piecePromoted", () => this.playSFX("promotion"));
      this.eventBus.on("combatEnd", (data) => {
        if (data.winner === "player") this.playSFX("victory");
        else this.playSFX("defeat");
      });
      this.eventBus.on("shopPurchase", () => this.playSFX("shopBuy"));
      this.eventBus.on("bossPhaseChange", () => this.playSFX("bossPhase"));
    }
    playSFX(name) {
      if (!this.initialized) this.init();
      if (this.sfx) this.sfx.play(name);
    }
    startMusic() {
      if (!this.initialized) this.init();
      if (this.music) this.music.playAmbient();
    }
    stopMusic() {
      if (this.music) this.music.stop();
    }
  };

  // src/save/Serializer.js
  var Serializer = class {
    static serialize(data) {
      try {
        return JSON.stringify(data);
      } catch (e) {
        console.error("Serialization failed:", e);
        return null;
      }
    }
    static deserialize(json) {
      try {
        return JSON.parse(json);
      } catch (e) {
        console.error("Deserialization failed:", e);
        return null;
      }
    }
  };

  // src/save/SaveManager.js
  var SAVE_KEY = "blanca_save";
  var SETTINGS_KEY = "blanca_settings";
  var SaveManager = class {
    constructor() {
      this.autoSaveEnabled = true;
    }
    save(data) {
      const json = Serializer.serialize(data);
      if (json) {
        try {
          localStorage.setItem(SAVE_KEY, json);
          return true;
        } catch (e) {
          console.error("Save failed:", e);
          return false;
        }
      }
      return false;
    }
    load() {
      try {
        const json = localStorage.getItem(SAVE_KEY);
        if (!json) return null;
        return Serializer.deserialize(json);
      } catch (e) {
        console.error("Load failed:", e);
        return null;
      }
    }
    hasSave() {
      try {
        return localStorage.getItem(SAVE_KEY) !== null;
      } catch {
        return false;
      }
    }
    deleteSave() {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch (e) {
        console.error("Delete save failed:", e);
      }
    }
    saveSettings(settings) {
      const json = Serializer.serialize(settings);
      if (json) {
        try {
          localStorage.setItem(SETTINGS_KEY, json);
        } catch (e) {
          console.error("Save settings failed:", e);
        }
      }
    }
    loadSettings() {
      try {
        const json = localStorage.getItem(SETTINGS_KEY);
        if (!json) return {};
        return Serializer.deserialize(json) || {};
      } catch {
        return {};
      }
    }
  };

  // src/pieces/Piece.js
  var nextId = 1;
  var Piece = class _Piece {
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
      const idx = this.modifiers.findIndex((m) => m.id === modifierId);
      if (idx !== -1) this.modifiers.splice(idx, 1);
    }
    hasModifier(modifierId) {
      return this.modifiers.some((m) => m.id === modifierId);
    }
    getModifiersByType(type) {
      return this.modifiers.filter((m) => m.type === type);
    }
    promote(newType) {
      this.promotedFrom = this.type;
      this.type = newType;
      this.modifiers = this.modifiers.filter(
        (m) => !m.validPieces || m.validPieces.includes(newType)
      );
    }
    clone() {
      const copy = new _Piece(this.type, this.team, this.col, this.row);
      copy.id = this.id;
      copy.hasMoved = this.hasMoved;
      copy.moveCount = this.moveCount;
      copy.modifiers = this.modifiers.map((m) => ({ ...m }));
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
        modifiers: this.modifiers.map((m) => ({ ...m })),
        isFrozen: this.isFrozen,
        promotedFrom: this.promotedFrom,
        originalType: this.originalType
      };
    }
    static deserialize(data) {
      const piece = new _Piece(data.type, data.team, data.col, data.row);
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
  };

  // src/data/Constants.js
  var TILE_COLORS = {
    light: "#f0d9b5",
    dark: "#b58863",
    lightSelected: "#f7ec5d",
    darkSelected: "#dac32b",
    lightMove: "#aad751",
    darkMove: "#7cb342",
    lightCapture: "#ef5350",
    darkCapture: "#c62828",
    lightCheck: "#ff8a65",
    darkCheck: "#e64a19",
    lightLastMove: "#cdd26a",
    darkLastMove: "#aaa23a"
  };
  var PIECE_COLORS = {
    player: "#ffffff",
    playerOutline: "#333333",
    enemy: "#1a1a2e",
    enemyOutline: "#666666"
  };
  var UI_COLORS = {
    bg: "#0a0a0f",
    bgLight: "#1a1a2e",
    panel: "#16213e",
    panelBorder: "#0f3460",
    text: "#e0e0e0",
    textDim: "#888888",
    accent: "#e94560",
    accentGlow: "#ff6b81",
    gold: "#ffd700",
    success: "#4caf50",
    warning: "#ff9800",
    danger: "#f44336",
    info: "#2196f3"
  };
  var PIECE_TYPES = {
    PAWN: "pawn",
    KNIGHT: "knight",
    BISHOP: "bishop",
    ROOK: "rook",
    QUEEN: "queen",
    KING: "king"
  };
  var TEAMS = {
    PLAYER: "player",
    ENEMY: "enemy"
  };
  var TERRAIN_TYPES = {
    NONE: "none",
    FORTRESS: "fortress",
    ICE: "ice",
    BRAMBLE: "bramble",
    VOID: "void",
    ALTAR: "altar"
  };
  var ANIMATION = {
    moveDuration: 200,
    captureDuration: 300,
    fadeDuration: 400,
    particleLifetime: 800
  };
  var ROSTER_LIMIT = 16;
  var TOTAL_FLOORS = 10;
  var STARTING_GOLD = 0;

  // src/data/ArmyData.js
  var ARMIES = {
    pawnsGambit: {
      id: "pawnsGambit",
      name: "The Pawns' Gambit",
      description: "Pawns promote one rank earlier (rank 7 instead of 8)",
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN }
      ],
      ability: "earlyPromotion",
      color: "#e8d44d"
    },
    knightErrant: {
      id: "knightErrant",
      name: "Knight Errant",
      description: "Knights can move again after capturing (once per turn)",
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.PAWN }
      ],
      ability: "knightDoubleCapture",
      color: "#4dabf7"
    },
    bishopsDiocese: {
      id: "bishopsDiocese",
      name: "The Bishop's Diocese",
      description: "Bishops can move through one friendly piece",
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.BISHOP },
        { type: PIECE_TYPES.BISHOP },
        { type: PIECE_TYPES.PAWN }
      ],
      ability: "bishopPhase",
      color: "#9775fa"
    },
    rooksFortress: {
      id: "rooksFortress",
      name: "Rook's Fortress",
      description: "Your rooks can't be captured on the first turn of each battle",
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.ROOK },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN }
      ],
      ability: "rookShield",
      color: "#ff6b6b"
    },
    queensCourt: {
      id: "queensCourt",
      name: "The Queen's Court",
      description: "Queen splits into Bishop + Rook on death instead of dying",
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.QUEEN }
      ],
      ability: "queenSplit",
      color: "#ffd43b"
    }
  };
  function getArmyList() {
    return Object.values(ARMIES);
  }

  // src/util/SeededRNG.js
  var SeededRNG = class {
    constructor(seed) {
      this.seed = seed;
      this.state = seed;
    }
    next() {
      this.state = this.state * 1664525 + 1013904223 & 4294967295;
      return (this.state >>> 0) / 4294967295;
    }
    random() {
      return this.next();
    }
    randomInt(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    }
    randomChoice(arr) {
      return arr[Math.floor(this.next() * arr.length)];
    }
    shuffle(arr) {
      const result = [...arr];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    }
    weightedChoice(items, weights) {
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = this.next() * total;
      for (let i = 0; i < items.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return items[i];
      }
      return items[items.length - 1];
    }
    static generateSeed() {
      return Math.floor(Math.random() * 4294967295);
    }
  };

  // src/data/FloorData.js
  var FLOOR_CONFIG = [
    { floor: 1, difficulty: 1, nodeCount: 3, paths: 2, types: { battle: 0.6, event: 0.2, rest: 0.2 } },
    { floor: 2, difficulty: 1, nodeCount: 3, paths: 2, types: { battle: 0.5, event: 0.2, shop: 0.15, rest: 0.15 } },
    { floor: 3, difficulty: 2, nodeCount: 4, paths: 2, types: { battle: 0.55, elite: 0.1, event: 0.1, shop: 0.15, rest: 0.1 } },
    { floor: 4, difficulty: 2, nodeCount: 4, paths: 3, types: { battle: 0.5, elite: 0.15, event: 0.1, shop: 0.15, rest: 0.1 } },
    { floor: 5, difficulty: 3, nodeCount: 1, paths: 1, types: { boss: 1 } },
    { floor: 6, difficulty: 3, nodeCount: 3, paths: 2, types: { battle: 0.5, event: 0.2, shop: 0.15, rest: 0.15 } },
    { floor: 7, difficulty: 3, nodeCount: 4, paths: 2, types: { battle: 0.5, elite: 0.15, event: 0.1, shop: 0.15, rest: 0.1 } },
    { floor: 8, difficulty: 4, nodeCount: 4, paths: 3, types: { battle: 0.45, elite: 0.2, event: 0.1, shop: 0.15, rest: 0.1 } },
    { floor: 9, difficulty: 4, nodeCount: 3, paths: 2, types: { battle: 0.4, elite: 0.2, shop: 0.2, rest: 0.2 } },
    { floor: 10, difficulty: 5, nodeCount: 1, paths: 1, types: { boss: 1 } }
  ];
  function getFloorConfig(floor) {
    return FLOOR_CONFIG[floor - 1] || FLOOR_CONFIG[0];
  }

  // src/progression/FloorGenerator.js
  var FloorGenerator = class {
    constructor(rng) {
      this.rng = rng;
    }
    generateFloor(floorNum) {
      const config = getFloorConfig(floorNum);
      const nodes = [];
      if (config.types.boss) {
        nodes.push({
          id: 0,
          type: "boss",
          floor: floorNum,
          x: 0.5,
          y: 0.5,
          connections: [],
          visited: false
        });
        return { floor: floorNum, nodes, config };
      }
      const count = config.nodeCount;
      for (let i = 0; i < count; i++) {
        const type = this.rollNodeType(config.types);
        nodes.push({
          id: i,
          type,
          floor: floorNum,
          x: (i + 0.5) / count,
          y: 0.3 + this.rng.random() * 0.4,
          connections: [],
          visited: false
        });
      }
      for (let i = 0; i < count; i++) {
        const maxConn = Math.min(2, count - 1);
        const connections = /* @__PURE__ */ new Set();
        if (i < count - 1) connections.add(i + 1);
        if (i > 0 && this.rng.random() < 0.4) connections.add(i - 1);
        if (this.rng.random() < 0.3) {
          const target = this.rng.randomInt(0, count - 1);
          if (target !== i) connections.add(target);
        }
        nodes[i].connections = [...connections];
      }
      return { floor: floorNum, nodes, config };
    }
    rollNodeType(typeWeights) {
      const types = Object.keys(typeWeights);
      const weights = types.map((t) => typeWeights[t]);
      return this.rng.weightedChoice(types, weights);
    }
    generateMap(totalFloors = 10) {
      const floors = [];
      for (let i = 1; i <= totalFloors; i++) {
        floors.push(this.generateFloor(i));
      }
      return floors;
    }
  };

  // src/data/EnemyData.js
  var ENEMY_ENCOUNTERS = {
    // Floor 1-2 encounters
    scoutPatrol: {
      id: "scoutPatrol",
      name: "Scout Patrol",
      difficulty: 1,
      boardSize: { cols: 6, rows: 6 },
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN }
      ],
      goldReward: 8
    },
    pawnWall: {
      id: "pawnWall",
      name: "Pawn Wall",
      difficulty: 1,
      boardSize: { cols: 6, rows: 6 },
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN }
      ],
      goldReward: 10
    },
    // Floor 3-4
    knightRaiders: {
      id: "knightRaiders",
      name: "Knight Raiders",
      difficulty: 2,
      boardSize: { cols: 7, rows: 7 },
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN }
      ],
      goldReward: 14
    },
    bishopAmbush: {
      id: "bishopAmbush",
      name: "Bishop Ambush",
      difficulty: 2,
      boardSize: { cols: 7, rows: 7 },
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.BISHOP },
        { type: PIECE_TYPES.BISHOP },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN }
      ],
      goldReward: 14
    },
    // Floor 5-6
    rookGuard: {
      id: "rookGuard",
      name: "Rook Guard",
      difficulty: 3,
      boardSize: { cols: 8, rows: 8 },
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.ROOK },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.BISHOP },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN }
      ],
      goldReward: 18
    },
    mixedForce: {
      id: "mixedForce",
      name: "Mixed Force",
      difficulty: 3,
      boardSize: { cols: 8, rows: 8 },
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.ROOK },
        { type: PIECE_TYPES.BISHOP },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN }
      ],
      goldReward: 20
    },
    // Floor 7-8
    queenStrike: {
      id: "queenStrike",
      name: "Queen Strike",
      difficulty: 4,
      boardSize: { cols: 8, rows: 8 },
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.QUEEN },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN }
      ],
      goldReward: 24
    },
    fortress: {
      id: "fortress",
      name: "Fortified Position",
      difficulty: 4,
      boardSize: { cols: 8, rows: 8 },
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.ROOK },
        { type: PIECE_TYPES.ROOK },
        { type: PIECE_TYPES.BISHOP },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN }
      ],
      goldReward: 26
    },
    // Floor 9-10
    royalArmy: {
      id: "royalArmy",
      name: "Royal Army",
      difficulty: 5,
      boardSize: { cols: 10, rows: 8 },
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.QUEEN },
        { type: PIECE_TYPES.ROOK },
        { type: PIECE_TYPES.BISHOP },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN }
      ],
      goldReward: 30
    },
    // Elites
    eliteKnightCommander: {
      id: "eliteKnightCommander",
      name: "Knight Commander",
      difficulty: 3,
      isElite: true,
      boardSize: { cols: 7, rows: 7 },
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN }
      ],
      goldReward: 25
    },
    eliteBishopCouncil: {
      id: "eliteBishopCouncil",
      name: "Bishop Council",
      difficulty: 3,
      isElite: true,
      boardSize: { cols: 8, rows: 8 },
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.BISHOP },
        { type: PIECE_TYPES.BISHOP },
        { type: PIECE_TYPES.BISHOP },
        { type: PIECE_TYPES.BISHOP },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN }
      ],
      goldReward: 25
    },
    eliteQueenGuard: {
      id: "eliteQueenGuard",
      name: "Queen's Guard",
      difficulty: 4,
      isElite: true,
      boardSize: { cols: 8, rows: 8 },
      pieces: [
        { type: PIECE_TYPES.KING },
        { type: PIECE_TYPES.QUEEN },
        { type: PIECE_TYPES.ROOK },
        { type: PIECE_TYPES.ROOK },
        { type: PIECE_TYPES.KNIGHT },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN },
        { type: PIECE_TYPES.PAWN }
      ],
      goldReward: 35
    }
  };
  function getEncountersForDifficulty(difficulty) {
    return Object.values(ENEMY_ENCOUNTERS).filter((e) => e.difficulty === difficulty && !e.isElite);
  }
  function getEliteEncounters(difficulty) {
    return Object.values(ENEMY_ENCOUNTERS).filter((e) => e.isElite && e.difficulty <= difficulty);
  }

  // src/data/TerrainData.js
  var TERRAIN_INFO = {
    [TERRAIN_TYPES.FORTRESS]: {
      name: "Fortress",
      description: "Piece on this square can't be captured",
      color: { light: "#a0c4ff", dark: "#7ba7e0" },
      symbol: "\u{1F6E1}"
    },
    [TERRAIN_TYPES.ICE]: {
      name: "Ice",
      description: "Piece that moves here slides one extra square in the same direction",
      color: { light: "#cce5ff", dark: "#99ccee" },
      symbol: "\u2744"
    },
    [TERRAIN_TYPES.BRAMBLE]: {
      name: "Bramble",
      description: "Piece that moves here can't move next turn",
      color: { light: "#8bc34a", dark: "#689f38" },
      symbol: "\u2663"
    },
    [TERRAIN_TYPES.VOID]: {
      name: "Void",
      description: "Impassable \u2014 no piece can enter",
      color: { light: "#2a2a2a", dark: "#1a1a1a" },
      symbol: "\u25AA"
    },
    [TERRAIN_TYPES.ALTAR]: {
      name: "Altar",
      description: "Pawn stepping here promotes immediately",
      color: { light: "#ffd54f", dark: "#ffb300" },
      symbol: "\u2606"
    }
  };
  function getRandomTerrain(rng = Math) {
    const types = [TERRAIN_TYPES.FORTRESS, TERRAIN_TYPES.ICE, TERRAIN_TYPES.BRAMBLE, TERRAIN_TYPES.ALTAR];
    return types[Math.floor(rng.random() * types.length)];
  }

  // src/progression/EncounterGenerator.js
  var EncounterGenerator = class {
    constructor(rng) {
      this.rng = rng;
    }
    generateBattle(floor, difficulty) {
      const encounters = getEncountersForDifficulty(difficulty);
      if (encounters.length === 0) return this.generateFallback(floor, difficulty);
      const encounter = this.rng.randomChoice(encounters);
      return this.buildEncounter(encounter, floor);
    }
    generateElite(floor, difficulty) {
      const elites = getEliteEncounters(difficulty);
      if (elites.length === 0) return this.generateBattle(floor, difficulty);
      const encounter = this.rng.randomChoice(elites);
      return this.buildEncounter(encounter, floor);
    }
    buildEncounter(encounter, floor) {
      const { cols, rows } = encounter.boardSize;
      const midCol = Math.floor(cols / 2);
      const enemyPieces = [];
      const occupied = /* @__PURE__ */ new Set();
      const deepFormation = rows >= 7;
      const kingRow = deepFormation ? 1 : 0;
      const pawnRow = deepFormation ? 2 : 1;
      enemyPieces.push({ type: PIECE_TYPES.KING, col: midCol, row: kingRow });
      occupied.add(`${midCol},${kingRow}`);
      const remaining = encounter.pieces.filter((p) => p.type !== PIECE_TYPES.KING);
      const pawns = remaining.filter((p) => p.type === PIECE_TYPES.PAWN);
      const officers = remaining.filter((p) => p.type !== PIECE_TYPES.PAWN);
      let pawnOffset = 0;
      for (const p of pawns) {
        let col = Math.min(cols - 1, Math.max(0, midCol + pawnOffset));
        const row = pawnRow;
        while (occupied.has(`${col},${row}`) && col < cols) col++;
        if (col >= cols) col = 0;
        while (occupied.has(`${col},${row}`)) col++;
        occupied.add(`${col},${row}`);
        enemyPieces.push({ type: PIECE_TYPES.PAWN, col, row });
        if (pawnOffset === 0) pawnOffset = 1;
        else pawnOffset = pawnOffset > 0 ? -pawnOffset : -pawnOffset + 1;
      }
      let officerOffset = 1;
      for (const p of officers) {
        let col = Math.min(cols - 1, Math.max(0, midCol + officerOffset));
        let row = kingRow;
        if (occupied.has(`${col},${row}`)) {
          row = 0;
          col = Math.min(cols - 1, Math.max(0, midCol + officerOffset));
        }
        while (occupied.has(`${col},${row}`)) {
          col = (col + 1) % cols;
        }
        occupied.add(`${col},${row}`);
        enemyPieces.push({ type: p.type, col, row });
        officerOffset = officerOffset > 0 ? -officerOffset : -officerOffset + 1;
      }
      const terrain = [];
      if (floor >= 3 && this.rng.random() < 0.4 + floor * 0.05) {
        const count = this.rng.randomInt(1, Math.min(4, Math.floor(floor / 2)));
        for (let i = 0; i < count; i++) {
          const tc = this.rng.randomInt(0, cols - 1);
          const tr = this.rng.randomInt(2, rows - 3);
          if (!enemyPieces.some((p) => p.col === tc && p.row === tr)) {
            terrain.push({ col: tc, row: tr, terrain: getRandomTerrain(this.rng) });
          }
        }
      }
      return {
        name: encounter.name,
        cols,
        rows,
        enemyPieces,
        terrain,
        goldReward: encounter.goldReward,
        isElite: encounter.isElite || false,
        difficulty: encounter.difficulty
      };
    }
    generateFallback(floor, difficulty) {
      const cols = Math.min(10, 6 + Math.floor(floor / 3));
      const rows = cols;
      const midCol = Math.floor(cols / 2);
      const enemyPieces = [{ type: PIECE_TYPES.KING, col: midCol, row: 0 }];
      const pawnCount = Math.min(cols - 1, 2 + floor);
      for (let i = 0; i < pawnCount; i++) {
        const c = Math.min(cols - 1, Math.max(0, midCol - Math.floor(pawnCount / 2) + i));
        enemyPieces.push({ type: PIECE_TYPES.PAWN, col: c, row: 1 });
      }
      if (floor >= 3) enemyPieces.push({ type: PIECE_TYPES.KNIGHT, col: midCol - 1, row: 0 });
      if (floor >= 5) enemyPieces.push({ type: PIECE_TYPES.BISHOP, col: midCol + 1, row: 0 });
      if (floor >= 7) enemyPieces.push({ type: PIECE_TYPES.ROOK, col: midCol + 2, row: 0 });
      return {
        name: "Enemy Force",
        cols,
        rows,
        enemyPieces,
        terrain: [],
        goldReward: 5 + floor * 3,
        isElite: false,
        difficulty
      };
    }
    placePlayerPieces(roster, cols, rows, enemyCount = Infinity) {
      const placed = [];
      const maxDeploy = Math.min(Math.floor(cols * rows * 0.25), enemyCount + 2);
      const midCol = Math.floor(cols / 2);
      const lastRow = rows - 1;
      const minRow = Math.floor(rows * 0.6);
      const sorted = [...roster].sort((a, b) => {
        if (a.type === PIECE_TYPES.KING) return -1;
        if (b.type === PIECE_TYPES.KING) return 1;
        return 0;
      });
      const occupied = /* @__PURE__ */ new Set();
      let colOffset = 0;
      let count = 0;
      for (const piece of sorted) {
        if (count >= maxDeploy) break;
        const isPawn = piece.type === PIECE_TYPES.PAWN;
        const baseRow = Math.max(minRow, isPawn ? lastRow - 1 : lastRow);
        let col;
        if (piece.type === PIECE_TYPES.KING) {
          col = midCol;
        } else {
          col = Math.min(cols - 1, Math.max(0, midCol + colOffset));
          colOffset = colOffset <= 0 ? -colOffset + 1 : -colOffset;
        }
        let row = baseRow;
        let key = `${col},${row}`;
        while (occupied.has(key) && row >= minRow) {
          row--;
          key = `${col},${row}`;
        }
        if (occupied.has(key)) {
          for (let dc = 1; dc < cols; dc++) {
            for (const tryCol of [col + dc, col - dc]) {
              if (tryCol >= 0 && tryCol < cols) {
                key = `${tryCol},${baseRow}`;
                if (!occupied.has(key)) {
                  col = tryCol;
                  row = baseRow;
                  break;
                }
              }
            }
            if (!occupied.has(`${col},${row}`)) break;
          }
        }
        occupied.add(`${col},${row}`);
        placed.push({ piece, col, row });
        count++;
      }
      return placed;
    }
  };

  // src/progression/RecruitmentSystem.js
  var RecruitmentSystem = class {
    constructor(eventBus) {
      this.eventBus = eventBus;
    }
    canRecruit(roster) {
      return roster.length < ROSTER_LIMIT;
    }
    recruitPiece(roster, type) {
      if (!this.canRecruit(roster)) return null;
      const piece = new Piece(type, TEAMS.PLAYER);
      roster.push(piece);
      this.eventBus.emit("pieceRecruited", { piece });
      return piece;
    }
    removePiece(roster, pieceId) {
      const idx = roster.findIndex((p) => p.id === pieceId);
      if (idx === -1) return null;
      const removed = roster.splice(idx, 1)[0];
      this.eventBus.emit("pieceRemoved", { piece: removed });
      return removed;
    }
    getDeployablePieces(roster, maxDeploy) {
      const king = roster.find((p) => p.type === PIECE_TYPES.KING);
      const others = roster.filter((p) => p.type !== PIECE_TYPES.KING);
      const sorted = others.sort((a, b) => this.pieceValue(b) - this.pieceValue(a));
      const deployed = king ? [king] : [];
      for (const p of sorted) {
        if (deployed.length >= maxDeploy) break;
        deployed.push(p);
      }
      return deployed;
    }
    pieceValue(piece) {
      const values = {
        [PIECE_TYPES.QUEEN]: 9,
        [PIECE_TYPES.ROOK]: 5,
        [PIECE_TYPES.BISHOP]: 3,
        [PIECE_TYPES.KNIGHT]: 3,
        [PIECE_TYPES.PAWN]: 1,
        [PIECE_TYPES.KING]: 100
      };
      let val = values[piece.type] || 0;
      val += piece.modifiers.length * 2;
      return val;
    }
  };

  // src/data/RelicData.js
  var RELICS = {
    freeMove: {
      id: "freeMove",
      name: "Initiative Crown",
      description: "Start each battle with a free move",
      rarity: "uncommon",
      shopPrice: 20
    },
    captureStreak: {
      id: "captureStreak",
      name: "Bloodthirst Amulet",
      description: "Capturing 3 pieces in a row grants an extra turn",
      rarity: "rare",
      shopPrice: 30
    },
    earlyPromotion: {
      id: "earlyPromotion",
      name: "Fast Track Banner",
      description: "Pawns promote one rank earlier",
      rarity: "uncommon",
      shopPrice: 18
    },
    pawnForwardCapture: {
      id: "pawnForwardCapture",
      name: "Spearmaster's Manual",
      description: "All pawns can capture forward",
      rarity: "common",
      shopPrice: 12
    },
    extraPieceOnPromote: {
      id: "extraPieceOnPromote",
      name: "Recruitment Scroll",
      description: "Gain an extra pawn when you promote",
      rarity: "rare",
      shopPrice: 22
    },
    enemySlowed: {
      id: "enemySlowed",
      name: "Leaden Crown",
      description: "Enemy king can only move every other turn",
      rarity: "common",
      shopPrice: 8
    },
    goldBonus: {
      id: "goldBonus",
      name: "Merchant's Purse",
      description: "Earn 50% more gold from battles",
      rarity: "uncommon",
      shopPrice: 15
    },
    healingRest: {
      id: "healingRest",
      name: "Sanctuary Bell",
      description: "Rest nodes recruit a knight instead of a pawn",
      rarity: "rare",
      shopPrice: 25
    },
    shieldStart: {
      id: "shieldStart",
      name: "Vanguard Shield",
      description: "Your front-row pawns have first-turn protection at battle start",
      rarity: "uncommon",
      shopPrice: 14
    },
    terrainSight: {
      id: "terrainSight",
      name: "Cartographer's Lens",
      description: "See terrain before choosing battle path",
      rarity: "common",
      shopPrice: 10
    }
  };
  function getRandomRelic(ownedRelicIds = [], rng = Math) {
    const available = Object.values(RELICS).filter((r) => !ownedRelicIds.includes(r.id));
    if (available.length === 0) return null;
    return available[Math.floor(rng.random() * available.length)];
  }

  // src/progression/RelicSystem.js
  var RelicSystem = class {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.ownedRelics = [];
    }
    addRelic(relic) {
      if (this.hasRelic(relic.id)) return false;
      this.ownedRelics.push({ ...relic });
      this.eventBus.emit("relicGained", { relic });
      return true;
    }
    removeRelic(relicId) {
      const idx = this.ownedRelics.findIndex((r) => r.id === relicId);
      if (idx === -1) return false;
      const removed = this.ownedRelics.splice(idx, 1)[0];
      this.eventBus.emit("relicLost", { relic: removed });
      return true;
    }
    hasRelic(relicId) {
      return this.ownedRelics.some((r) => r.id === relicId);
    }
    getRelic(relicId) {
      return this.ownedRelics.find((r) => r.id === relicId);
    }
    getRandomReward(rng = Math) {
      const ownedIds = this.ownedRelics.map((r) => r.id);
      return getRandomRelic(ownedIds, rng);
    }
    getShopOfferings(count = 3, rng = Math) {
      const ownedIds = this.ownedRelics.map((r) => r.id);
      const available = Object.values(RELICS).filter((r) => !ownedIds.includes(r.id));
      const shuffled = [...available].sort(() => rng.random() - 0.5);
      return shuffled.slice(0, count);
    }
    serialize() {
      return this.ownedRelics.map((r) => ({ ...r }));
    }
    deserialize(data) {
      this.ownedRelics = data.map((r) => ({ ...r }));
    }
  };

  // src/data/ModifierData.js
  var MODIFIER_TYPES = {
    MOVEMENT: "movement",
    CAPTURE: "capture",
    PROTECTION: "protection",
    UNIQUE: "unique"
  };
  var MODIFIERS = {
    // Movement modifiers
    knightKingMove: {
      id: "knightKingMove",
      name: "Royal Step",
      description: "This knight can also move like a king (one square any direction)",
      type: MODIFIER_TYPES.MOVEMENT,
      rarity: "uncommon",
      validPieces: ["knight"],
      shopPrice: 12
    },
    rookExtraRange: {
      id: "rookExtraRange",
      name: "Extended Reach",
      description: "This rook moves up to 2 extra squares",
      type: MODIFIER_TYPES.MOVEMENT,
      rarity: "common",
      validPieces: ["rook"],
      shopPrice: 10
    },
    pawnDiagonalMove: {
      id: "pawnDiagonalMove",
      name: "Sidestep",
      description: "This pawn can move one square diagonally forward without capturing",
      type: MODIFIER_TYPES.MOVEMENT,
      rarity: "common",
      validPieces: ["pawn"],
      shopPrice: 6
    },
    bishopLeap: {
      id: "bishopLeap",
      name: "Holy Leap",
      description: "This bishop can jump over one piece in its path",
      type: MODIFIER_TYPES.MOVEMENT,
      rarity: "rare",
      validPieces: ["bishop"],
      shopPrice: 15
    },
    // Capture modifiers
    bishopDoubleCapture: {
      id: "bishopDoubleCapture",
      name: "Zealous Pursuit",
      description: "After capturing, this bishop can move again",
      type: MODIFIER_TYPES.CAPTURE,
      rarity: "rare",
      validPieces: ["bishop"],
      shopPrice: 18
    },
    knightRangedCapture: {
      id: "knightRangedCapture",
      name: "Lance Strike",
      description: "This knight can capture without moving to the target square",
      type: MODIFIER_TYPES.CAPTURE,
      rarity: "legendary",
      validPieces: ["knight"],
      shopPrice: 25
    },
    pawnForwardCapture: {
      id: "pawnForwardCapture",
      name: "Pike",
      description: "This pawn can capture forward",
      type: MODIFIER_TYPES.CAPTURE,
      rarity: "common",
      validPieces: ["pawn"],
      shopPrice: 8
    },
    // Protection modifiers
    sideProtection: {
      id: "sideProtection",
      name: "Flanking Shield",
      description: "This rook can't be captured from the side",
      type: MODIFIER_TYPES.PROTECTION,
      rarity: "uncommon",
      validPieces: ["rook"],
      shopPrice: 14
    },
    firstTurnProtection: {
      id: "firstTurnProtection",
      name: "Opening Guard",
      description: "This pawn can't be captured on its first turn",
      type: MODIFIER_TYPES.PROTECTION,
      rarity: "common",
      validPieces: ["pawn"],
      shopPrice: 5
    },
    // Unique modifiers
    queenTrail: {
      id: "queenTrail",
      name: "Scorched Path",
      description: "This queen leaves a blocked square behind when it moves",
      type: MODIFIER_TYPES.UNIQUE,
      rarity: "legendary",
      validPieces: ["queen"],
      shopPrice: 20
    },
    kingInspire: {
      id: "kingInspire",
      name: "Royal Inspiration",
      description: "Friendly pieces adjacent to this king gain +1 move range",
      type: MODIFIER_TYPES.UNIQUE,
      rarity: "rare",
      validPieces: ["king"],
      shopPrice: 16
    }
  };
  function getRandomModifier(rng = Math) {
    const all = Object.values(MODIFIERS);
    return all[Math.floor(rng.random() * all.length)];
  }

  // src/progression/RewardTable.js
  var RewardTable = class {
    constructor(rng) {
      this.rng = rng;
    }
    getBattleRewards(floor, isElite) {
      const rewards = { gold: 0, modifier: null, relic: null, recruitOptions: [] };
      rewards.gold = this.rollGold(floor, isElite);
      if (isElite) {
        if (this.rng.random() > 0.5) {
          rewards.modifier = getRandomModifier(this.rng);
        } else {
          rewards.relic = getRandomRelic([], this.rng);
        }
      } else {
        if (this.rng.random() < 0.3) {
          rewards.modifier = getRandomModifier(this.rng);
        }
      }
      rewards.recruitOptions = this.getRecruitOptions(floor);
      return rewards;
    }
    rollGold(floor, isElite) {
      const base = 5 + floor * 3;
      const range = 4 + floor;
      let gold = base + this.rng.randomInt(0, range);
      if (isElite) gold = Math.floor(gold * 1.5);
      return gold;
    }
    getRecruitOptions(floor) {
      const options = [{ type: PIECE_TYPES.PAWN, cost: 0 }];
      if (floor >= 3 && this.rng.random() < 0.5) {
        options.push({ type: this.rng.randomChoice([PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP]), cost: 0 });
      }
      return options;
    }
    getBossRewards(floor) {
      return {
        gold: 20 + floor * 5,
        relic: getRandomRelic([], this.rng),
        modifier: getRandomModifier(this.rng),
        recruitOptions: [
          { type: PIECE_TYPES.PAWN, cost: 0 },
          { type: this.rng.randomChoice([PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK]), cost: 0 }
        ]
      };
    }
  };

  // src/progression/DifficultyScaler.js
  var DifficultyScaler = class {
    constructor() {
      this.baseAIDifficulty = 1;
    }
    getAIDifficulty(floor) {
      if (floor <= 1) return 1;
      if (floor <= 2) return 2;
      if (floor <= 6) return 3;
      if (floor <= 8) return 4;
      return 5;
    }
    getGoldMultiplier(floor, relics) {
      let mult = 1 + (floor - 1) * 0.1;
      if (relics.some((r) => r.id === "goldBonus")) {
        mult *= 1.5;
      }
      return mult;
    }
    getEliteRewardBonus(floor) {
      return Math.floor(floor * 1.5);
    }
  };

  // src/data/PieceData.js
  var PIECE_VALUES = {
    [PIECE_TYPES.PAWN]: 1,
    [PIECE_TYPES.KNIGHT]: 3,
    [PIECE_TYPES.BISHOP]: 3,
    [PIECE_TYPES.ROOK]: 5,
    [PIECE_TYPES.QUEEN]: 9,
    [PIECE_TYPES.KING]: 100
  };
  var PIECE_NAMES = {
    [PIECE_TYPES.PAWN]: "Pawn",
    [PIECE_TYPES.KNIGHT]: "Knight",
    [PIECE_TYPES.BISHOP]: "Bishop",
    [PIECE_TYPES.ROOK]: "Rook",
    [PIECE_TYPES.QUEEN]: "Queen",
    [PIECE_TYPES.KING]: "King"
  };
  var PIECE_SYMBOLS = {
    [PIECE_TYPES.PAWN]: "P",
    [PIECE_TYPES.KNIGHT]: "N",
    [PIECE_TYPES.BISHOP]: "B",
    [PIECE_TYPES.ROOK]: "R",
    [PIECE_TYPES.QUEEN]: "Q",
    [PIECE_TYPES.KING]: "K"
  };
  var SHOP_PRICES = {
    [PIECE_TYPES.PAWN]: 5,
    [PIECE_TYPES.KNIGHT]: 15,
    [PIECE_TYPES.BISHOP]: 15,
    [PIECE_TYPES.ROOK]: 20,
    [PIECE_TYPES.QUEEN]: 35
  };

  // src/progression/Shop.js
  var Shop = class {
    constructor(rng, eventBus) {
      this.rng = rng;
      this.eventBus = eventBus;
      this.items = [];
    }
    generate(floor, ownedRelicIds = []) {
      this.items = [];
      const pieceTypes = [PIECE_TYPES.PAWN, PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK, PIECE_TYPES.QUEEN];
      const shuffled = this.rng.shuffle(pieceTypes);
      const pieceCount = this.rng.randomInt(2, 3);
      for (let i = 0; i < pieceCount; i++) {
        const type = shuffled[i];
        this.items.push({
          category: "piece",
          type,
          price: SHOP_PRICES[type] || 10,
          name: type.charAt(0).toUpperCase() + type.slice(1),
          description: `Recruit a ${type} to your army`
        });
      }
      const modCount = this.rng.randomInt(1, 2);
      for (let i = 0; i < modCount; i++) {
        const mod = getRandomModifier(this.rng);
        if (mod && !this.items.some((it) => it.id === mod.id)) {
          if (mod.id === "pawnForwardCapture" && ownedRelicIds.includes("pawnForwardCapture")) continue;
          this.items.push({
            category: "modifier",
            id: mod.id,
            price: mod.shopPrice,
            name: mod.name,
            description: mod.description,
            validPieces: mod.validPieces,
            modifier: mod
          });
        }
      }
      const relic = getRandomRelic(ownedRelicIds, this.rng);
      if (relic) {
        this.items.push({
          category: "relic",
          id: relic.id,
          price: relic.shopPrice,
          name: relic.name,
          description: relic.description,
          relic
        });
      }
      return this.items;
    }
    canAfford(item, gold) {
      return gold >= item.price;
    }
    purchase(item, runManager) {
      if (!this.canAfford(item, runManager.gold)) return false;
      runManager.gold -= item.price;
      switch (item.category) {
        case "piece":
          runManager.recruitPiece(item.type);
          break;
        case "modifier":
          this.eventBus.emit("modifierPurchased", { modifier: item.modifier });
          break;
        case "relic":
          runManager.addRelic(item.relic);
          break;
      }
      const idx = this.items.indexOf(item);
      if (idx !== -1) this.items.splice(idx, 1);
      this.eventBus.emit("shopPurchase", { item });
      return true;
    }
  };

  // src/progression/RunManager.js
  var RunManager = class {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.rng = null;
      this.seed = 0;
      this.roster = [];
      this.gold = STARTING_GOLD;
      this.currentFloor = 1;
      this.currentNode = null;
      this.armyId = null;
      this.armyAbility = null;
      this.relicSystem = new RelicSystem(eventBus);
      this.recruitment = new RecruitmentSystem(eventBus);
      this.difficultyScaler = new DifficultyScaler();
      this.floorGenerator = null;
      this.encounterGenerator = null;
      this.rewardTable = null;
      this.shop = null;
      this.map = [];
      this.stats = { battlesWon: 0, piecesLost: 0, piecesRecruited: 0, goldSpent: 0, floorsCleared: 0 };
      this.isActive = false;
    }
    startRun(armyId, seed = null) {
      this.seed = seed || SeededRNG.generateSeed();
      this.rng = new SeededRNG(this.seed);
      this.floorGenerator = new FloorGenerator(this.rng);
      this.encounterGenerator = new EncounterGenerator(this.rng);
      this.rewardTable = new RewardTable(this.rng);
      this.shop = new Shop(this.rng, this.eventBus);
      this.armyId = armyId;
      const army = ARMIES[armyId];
      this.armyAbility = army.ability;
      this.roster = army.pieces.map((p) => new Piece(p.type, TEAMS.PLAYER));
      this.gold = STARTING_GOLD;
      this.currentFloor = 1;
      this.currentNode = null;
      this.relicSystem = new RelicSystem(this.eventBus);
      this.stats = { battlesWon: 0, piecesLost: 0, piecesRecruited: 0, goldSpent: 0, floorsCleared: 0 };
      this.applyArmyAbility(army);
      this.map = this.floorGenerator.generateMap(TOTAL_FLOORS);
      this.isActive = true;
      this.eventBus.emit("runStarted", { army, seed: this.seed });
    }
    applyArmyAbility(army) {
      switch (army.ability) {
        case "earlyPromotion":
          break;
        case "knightDoubleCapture":
          for (const p of this.roster) {
            if (p.type === PIECE_TYPES.KNIGHT) {
              p.addModifier({ id: "knightDoubleCapture", type: "capture", name: "Double Move on Capture" });
            }
          }
          break;
        case "bishopPhase":
          for (const p of this.roster) {
            if (p.type === PIECE_TYPES.BISHOP) {
              p.addModifier({ id: "bishopLeap", type: "movement", name: "Phase Through" });
            }
          }
          break;
        case "rookShield":
          for (const p of this.roster) {
            if (p.type === PIECE_TYPES.ROOK) {
              p.addModifier({ id: "firstTurnProtection", type: "protection", name: "Opening Guard" });
            }
          }
          break;
        case "queenSplit":
          for (const p of this.roster) {
            if (p.type === PIECE_TYPES.QUEEN) {
              p.addModifier({ id: "queenSplit", type: "unique", name: "Queen Split" });
            }
          }
          break;
      }
    }
    getCurrentFloorData() {
      return this.map[this.currentFloor - 1] || null;
    }
    getEncounter(nodeType) {
      const difficulty = this.difficultyScaler.getAIDifficulty(this.currentFloor);
      switch (nodeType) {
        case "battle":
          return this.encounterGenerator.generateBattle(this.currentFloor, difficulty);
        case "elite":
          return this.encounterGenerator.generateElite(this.currentFloor, difficulty);
        case "boss":
          return { name: `Boss (Floor ${this.currentFloor})`, isBoss: true, difficulty };
        default:
          return null;
      }
    }
    prepareCombat(encounter) {
      const enemyCount = encounter.enemyPieces ? encounter.enemyPieces.length : Infinity;
      const playerPlacement = this.encounterGenerator.placePlayerPieces(
        this.roster,
        encounter.cols,
        encounter.rows,
        enemyCount
      );
      return {
        cols: encounter.cols,
        rows: encounter.rows,
        playerPieces: playerPlacement,
        enemyPieces: encounter.enemyPieces,
        terrain: encounter.terrain,
        difficulty: encounter.difficulty,
        relics: this.relicSystem.ownedRelics,
        armyAbility: this.armyAbility,
        encounterName: encounter.name
      };
    }
    onBattleWon(result) {
      this.stats.battlesWon++;
      const mult = this.difficultyScaler.getGoldMultiplier(this.currentFloor, this.relicSystem.ownedRelics);
      const gold = Math.floor((result.goldEarned || 10) * mult);
      this.gold += gold;
      if (result.capturedByEnemy) {
        for (const captured of result.capturedByEnemy) {
          const idx = this.roster.findIndex((p) => p.id === captured.id);
          if (idx !== -1) {
            this.roster.splice(idx, 1);
            this.stats.piecesLost++;
          }
        }
      }
      const boardPieces = result.survivingPlayerPieces || [];
      for (const bp of boardPieces) {
        const rosterPiece = this.roster.find((p) => p.id === bp.id);
        if (rosterPiece && bp.promotedFrom) {
          rosterPiece.type = bp.type;
          rosterPiece.promotedFrom = bp.promotedFrom;
        }
      }
      return this.rewardTable.getBattleRewards(this.currentFloor, result.isElite);
    }
    onBattleLost() {
      this.isActive = false;
      this.eventBus.emit("runEnded", { victory: false, stats: this.stats });
    }
    advanceFloor() {
      this.currentFloor++;
      this.stats.floorsCleared++;
      if (this.currentFloor > TOTAL_FLOORS) {
        this.isActive = false;
        this.eventBus.emit("runEnded", { victory: true, stats: this.stats });
        return false;
      }
      return true;
    }
    recruitPiece(type) {
      if (this.roster.length >= ROSTER_LIMIT) return null;
      const piece = new Piece(type, TEAMS.PLAYER);
      if (this.armyAbility === "knightDoubleCapture" && type === PIECE_TYPES.KNIGHT) {
        piece.addModifier({ id: "knightDoubleCapture", type: "capture", name: "Double Move on Capture" });
      }
      if (this.armyAbility === "rookShield" && type === PIECE_TYPES.ROOK) {
        piece.addModifier({ id: "firstTurnProtection", type: "protection", name: "Opening Guard" });
      }
      if (this.armyAbility === "bishopPhase" && type === PIECE_TYPES.BISHOP) {
        piece.addModifier({ id: "bishopLeap", type: "movement", name: "Phase Through" });
      }
      if (this.armyAbility === "queenSplit" && type === PIECE_TYPES.QUEEN) {
        piece.addModifier({ id: "queenSplit", type: "unique", name: "Queen Split" });
      }
      this.roster.push(piece);
      this.stats.piecesRecruited++;
      this.eventBus.emit("pieceRecruited", { piece });
      return piece;
    }
    addRelic(relic) {
      this.relicSystem.addRelic(relic);
    }
    generateShop() {
      const ownedIds = this.relicSystem.ownedRelics.map((r) => r.id);
      return this.shop.generate(this.currentFloor, ownedIds);
    }
    purchaseShopItem(item) {
      if (this.gold < item.price) return false;
      this.gold -= item.price;
      this.stats.goldSpent += item.price;
      if (item.category === "piece") {
        this.recruitPiece(item.type);
      } else if (item.category === "relic") {
        this.addRelic(item.relic);
      }
      const idx = this.shop.items.indexOf(item);
      if (idx !== -1) this.shop.items.splice(idx, 1);
      return true;
    }
    serialize() {
      return {
        seed: this.seed,
        armyId: this.armyId,
        roster: this.roster.map((p) => p.serialize()),
        gold: this.gold,
        currentFloor: this.currentFloor,
        relics: this.relicSystem.serialize(),
        stats: { ...this.stats },
        isActive: this.isActive
      };
    }
    deserialize(data) {
      this.seed = data.seed;
      this.rng = new SeededRNG(data.seed);
      this.floorGenerator = new FloorGenerator(this.rng);
      this.encounterGenerator = new EncounterGenerator(this.rng);
      this.rewardTable = new RewardTable(this.rng);
      this.shop = new Shop(this.rng, this.eventBus);
      this.armyId = data.armyId;
      this.armyAbility = ARMIES[data.armyId]?.ability;
      this.roster = data.roster.map((p) => Piece.deserialize(p));
      this.gold = data.gold;
      this.currentFloor = data.currentFloor;
      this.relicSystem.deserialize(data.relics);
      this.stats = data.stats;
      this.isActive = data.isActive;
      this.map = this.floorGenerator.generateMap(TOTAL_FLOORS);
    }
  };

  // src/util/ObjectPool.js
  var ObjectPool = class {
    constructor(factory, reset, initialSize = 20) {
      this.factory = factory;
      this.reset = reset;
      this.pool = [];
      for (let i = 0; i < initialSize; i++) {
        this.pool.push(this.factory());
      }
    }
    get() {
      if (this.pool.length > 0) {
        return this.pool.pop();
      }
      return this.factory();
    }
    release(obj) {
      this.reset(obj);
      this.pool.push(obj);
    }
    get size() {
      return this.pool.length;
    }
  };

  // src/render/ParticleSystem.js
  var ParticleSystem = class {
    constructor() {
      this.particles = [];
      this.pool = new ObjectPool(
        () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, color: "", alpha: 1, gravity: 0 }),
        (p) => {
          p.life = 0;
          p.alpha = 1;
        },
        100
      );
    }
    emit(x, y, count, options = {}) {
      const {
        color = "#ffffff",
        speed = 100,
        spread = Math.PI * 2,
        angle = 0,
        life = 600,
        size = 4,
        gravity = 50,
        sizeDecay = true
      } = options;
      for (let i = 0; i < count; i++) {
        const p = this.pool.get();
        const a = angle + (Math.random() - 0.5) * spread;
        const s = speed * (0.5 + Math.random() * 0.5);
        p.x = x;
        p.y = y;
        p.vx = Math.cos(a) * s;
        p.vy = Math.sin(a) * s;
        p.life = 0;
        p.maxLife = life * (0.7 + Math.random() * 0.6);
        p.size = size * (0.5 + Math.random() * 0.5);
        p.startSize = p.size;
        p.color = color;
        p.alpha = 1;
        p.gravity = gravity;
        p.sizeDecay = sizeDecay;
        this.particles.push(p);
      }
    }
    burst(x, y, count = 20, color = "#ffffff") {
      this.emit(x, y, count, {
        color,
        speed: 150,
        spread: Math.PI * 2,
        life: 500,
        size: 5,
        gravity: 80
      });
    }
    sparkle(x, y, count = 8, color = "#ffd700") {
      this.emit(x, y, count, {
        color,
        speed: 60,
        spread: Math.PI * 2,
        life: 800,
        size: 3,
        gravity: -20
      });
    }
    update(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life += dt * 1e3;
        if (p.life >= p.maxLife) {
          this.pool.release(p);
          this.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        const progress = p.life / p.maxLife;
        p.alpha = 1 - progress;
        if (p.sizeDecay) {
          p.size = p.startSize * (1 - progress);
        }
      }
    }
    render(ctx) {
      for (const p of this.particles) {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }
    clear() {
      for (const p of this.particles) {
        this.pool.release(p);
      }
      this.particles = [];
    }
  };

  // src/render/EffectsRenderer.js
  var EffectsRenderer = class {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.particles = new ParticleSystem();
      this.screenFlashes = [];
      this.boardRenderer = null;
      this.setupListeners();
    }
    setupListeners() {
      this.eventBus.on("pieceCaptured", (data) => this.onCapture(data));
      this.eventBus.on("piecePromoted", (data) => this.onPromotion(data));
      this.eventBus.on("relicGained", (data) => this.onRelicGained(data));
    }
    setBoardRenderer(br) {
      this.boardRenderer = br;
    }
    onCapture(data) {
      if (!this.boardRenderer) return;
      const pos = this.boardRenderer.boardToScreen(data.col || data.captured.col, data.row || data.captured.row);
      const ts = this.boardRenderer.tileSize;
      this.particles.burst(pos.x + ts / 2, pos.y + ts / 2, 15, UI_COLORS.accent);
      this.addScreenFlash(UI_COLORS.accent, 150);
    }
    onPromotion(data) {
      if (!this.boardRenderer) return;
      const pos = this.boardRenderer.boardToScreen(data.piece.col, data.piece.row);
      const ts = this.boardRenderer.tileSize;
      this.particles.sparkle(pos.x + ts / 2, pos.y + ts / 2, 20, UI_COLORS.gold);
      this.addScreenFlash(UI_COLORS.gold, 200);
    }
    onRelicGained() {
      this.addScreenFlash(UI_COLORS.gold, 300);
    }
    addScreenFlash(color, duration) {
      this.screenFlashes.push({ color, duration, elapsed: 0 });
    }
    update(dt) {
      this.particles.update(dt);
      for (let i = this.screenFlashes.length - 1; i >= 0; i--) {
        this.screenFlashes[i].elapsed += dt * 1e3;
        if (this.screenFlashes[i].elapsed >= this.screenFlashes[i].duration) {
          this.screenFlashes.splice(i, 1);
        }
      }
    }
    render(ctx) {
      this.particles.render(ctx);
      for (const flash of this.screenFlashes) {
        const progress = flash.elapsed / flash.duration;
        const alpha = 0.3 * (1 - progress);
        ctx.fillStyle = flash.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.globalAlpha = 1;
      }
    }
  };

  // src/ui/Button.js
  var Button = class {
    constructor(x, y, w, h, text, options = {}) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.text = text;
      this.color = options.color || UI_COLORS.panel;
      this.hoverColor = options.hoverColor || UI_COLORS.accent;
      this.textColor = options.textColor || UI_COLORS.text;
      this.borderColor = options.borderColor || UI_COLORS.panelBorder;
      this.fontSize = options.fontSize || 14;
      this.isHovered = false;
      this.onClick = options.onClick || null;
    }
    contains(x, y) {
      return x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h;
    }
    handleClick(x, y) {
      if (this.contains(x, y) && this.onClick) {
        this.onClick();
        return true;
      }
      return false;
    }
    handleMove(x, y) {
      this.isHovered = this.contains(x, y);
    }
    render(ctx) {
      ctx.fillStyle = this.isHovered ? this.hoverColor : this.color;
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.strokeStyle = this.isHovered ? this.hoverColor : this.borderColor;
      ctx.lineWidth = this.isHovered ? 2 : 1;
      ctx.strokeRect(this.x, this.y, this.w, this.h);
      ctx.font = `bold ${this.fontSize}px monospace`;
      ctx.fillStyle = this.textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.text, this.x + this.w / 2, this.y + this.h / 2);
    }
  };

  // src/states/MainMenuState.js
  var MainMenuState = class {
    constructor() {
      this.stateMachine = null;
      this.eventBus = null;
      this.renderer = null;
      this.runManager = null;
      this.saveManager = null;
      this.buttons = [];
      this.titlePulse = 0;
      this.clickHandler = null;
      this.moveHandler = null;
      this.keyHandler = null;
    }
    enter() {
      this.titlePulse = 0;
      this.createButtons();
      this.bindInput();
    }
    exit() {
      if (this.clickHandler) this.eventBus.off("click", this.clickHandler);
      if (this.moveHandler) this.eventBus.off("mousemove", this.moveHandler);
      if (this.keyHandler) this.eventBus.off("keydown", this.keyHandler);
    }
    createButtons() {
      const w = this.renderer.width;
      const h = this.renderer.height;
      const btnW = 200;
      const btnH = 44;
      const x = (w - btnW) / 2;
      const startY = h / 2 + 20;
      const gap = 12;
      this.buttons = [];
      this.buttons.push(new Button(x, startY, btnW, btnH, "New Game", {
        color: UI_COLORS.panel,
        hoverColor: UI_COLORS.accent,
        onClick: () => this.stateMachine.change("armySelect")
      }));
      const hasSave = this.saveManager && this.saveManager.hasSave();
      if (hasSave) {
        this.buttons.push(new Button(x, startY + btnH + gap, btnW, btnH, "Continue", {
          color: UI_COLORS.panel,
          hoverColor: UI_COLORS.success,
          onClick: () => this.loadGame()
        }));
      }
      this.buttons.push(new Button(x, startY + (hasSave ? 2 : 1) * (btnH + gap), btnW, btnH, "Settings", {
        color: UI_COLORS.panel,
        hoverColor: UI_COLORS.info,
        onClick: () => {
          if (this.stateMachine.states.has("settings")) {
            this.stateMachine.change("settings");
          }
        }
      }));
    }
    bindInput() {
      this.clickHandler = (data) => {
        for (const btn of this.buttons) btn.handleClick(data.x, data.y);
      };
      this.moveHandler = (data) => {
        for (const btn of this.buttons) btn.handleMove(data.x, data.y);
      };
      this.keyHandler = (data) => {
        if (data.code === "Enter") {
          this.stateMachine.change("armySelect");
        }
      };
      this.eventBus.on("click", this.clickHandler);
      this.eventBus.on("mousemove", this.moveHandler);
      this.eventBus.on("keydown", this.keyHandler);
    }
    loadGame() {
      if (this.saveManager && this.runManager) {
        const data = this.saveManager.load();
        if (data) {
          this.runManager.deserialize(data);
          this.stateMachine.change("map");
        }
      }
    }
    update(dt) {
      this.titlePulse += dt;
    }
    render(ctx) {
      const w = this.renderer.width;
      const h = this.renderer.height;
      const pulse = Math.sin(this.titlePulse * 2) * 0.1 + 0.9;
      ctx.font = `bold ${Math.floor(64 * pulse)}px monospace`;
      ctx.fillStyle = UI_COLORS.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("BLANCA", w / 2, h / 2 - 80);
      ctx.font = "16px monospace";
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.fillText("A Chess Roguelike", w / 2, h / 2 - 30);
      for (const btn of this.buttons) {
        btn.render(ctx);
      }
      ctx.font = "11px monospace";
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.textAlign = "center";
      ctx.fillText("v0.1 \u2014 Chess IS the game", w / 2, h - 24);
    }
  };

  // src/render/PieceRenderer.js
  var PieceRenderer = class {
    static draw(ctx, piece, x, y, size) {
      const isPlayer = piece.team === TEAMS.PLAYER;
      const fill = isPlayer ? PIECE_COLORS.player : PIECE_COLORS.enemy;
      const stroke = isPlayer ? PIECE_COLORS.playerOutline : PIECE_COLORS.enemyOutline;
      const center = size / 2;
      const scale = size / 80;
      ctx.save();
      ctx.translate(x, y);
      switch (piece.type) {
        case PIECE_TYPES.PAWN:
          this.drawPawn(ctx, center, scale, fill, stroke);
          break;
        case PIECE_TYPES.KNIGHT:
          this.drawKnight(ctx, center, scale, fill, stroke);
          break;
        case PIECE_TYPES.BISHOP:
          this.drawBishop(ctx, center, scale, fill, stroke);
          break;
        case PIECE_TYPES.ROOK:
          this.drawRook(ctx, center, scale, fill, stroke);
          break;
        case PIECE_TYPES.QUEEN:
          this.drawQueen(ctx, center, scale, fill, stroke);
          break;
        case PIECE_TYPES.KING:
          this.drawKing(ctx, center, scale, fill, stroke);
          break;
      }
      if (piece.modifiers.length > 0) {
        this.drawModifierIndicator(ctx, size, scale);
      }
      ctx.restore();
    }
    static drawPawn(ctx, c, s, fill, stroke) {
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(c, c - 10 * s, 10 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c - 14 * s, c + 22 * s);
      ctx.lineTo(c - 8 * s, c);
      ctx.lineTo(c + 8 * s, c);
      ctx.lineTo(c + 14 * s, c + 22 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c - 18 * s, c + 26 * s);
      ctx.lineTo(c + 18 * s, c + 26 * s);
      ctx.lineTo(c + 16 * s, c + 22 * s);
      ctx.lineTo(c - 16 * s, c + 22 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    static drawKnight(ctx, c, s, fill, stroke) {
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(c - 6 * s, c - 22 * s);
      ctx.quadraticCurveTo(c - 18 * s, c - 16 * s, c - 16 * s, c - 2 * s);
      ctx.quadraticCurveTo(c - 18 * s, c + 8 * s, c - 10 * s, c + 14 * s);
      ctx.lineTo(c - 16 * s, c + 22 * s);
      ctx.lineTo(c + 16 * s, c + 22 * s);
      ctx.lineTo(c + 10 * s, c + 6 * s);
      ctx.quadraticCurveTo(c + 16 * s, c - 6 * s, c + 10 * s, c - 16 * s);
      ctx.quadraticCurveTo(c + 4 * s, c - 26 * s, c - 6 * s, c - 22 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const eyeColor = fill === "#ffffff" ? "#333" : "#aaa";
      ctx.fillStyle = eyeColor;
      ctx.beginPath();
      ctx.arc(c - 4 * s, c - 12 * s, 2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(c - 18 * s, c + 26 * s);
      ctx.lineTo(c + 18 * s, c + 26 * s);
      ctx.lineTo(c + 16 * s, c + 22 * s);
      ctx.lineTo(c - 16 * s, c + 22 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    static drawBishop(ctx, c, s, fill, stroke) {
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(c, c - 24 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c, c - 20 * s);
      ctx.quadraticCurveTo(c - 14 * s, c - 8 * s, c - 12 * s, c + 8 * s);
      ctx.lineTo(c - 16 * s, c + 22 * s);
      ctx.lineTo(c + 16 * s, c + 22 * s);
      ctx.lineTo(c + 12 * s, c + 8 * s);
      ctx.quadraticCurveTo(c + 14 * s, c - 8 * s, c, c - 20 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(c - 4 * s, c - 10 * s);
      ctx.lineTo(c + 4 * s, c - 2 * s);
      ctx.stroke();
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(c - 18 * s, c + 26 * s);
      ctx.lineTo(c + 18 * s, c + 26 * s);
      ctx.lineTo(c + 16 * s, c + 22 * s);
      ctx.lineTo(c - 16 * s, c + 22 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    static drawRook(ctx, c, s, fill, stroke) {
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(c - 16 * s, c - 14 * s);
      ctx.lineTo(c - 16 * s, c - 22 * s);
      ctx.lineTo(c - 8 * s, c - 22 * s);
      ctx.lineTo(c - 8 * s, c - 16 * s);
      ctx.lineTo(c - 3 * s, c - 16 * s);
      ctx.lineTo(c - 3 * s, c - 22 * s);
      ctx.lineTo(c + 3 * s, c - 22 * s);
      ctx.lineTo(c + 3 * s, c - 16 * s);
      ctx.lineTo(c + 8 * s, c - 16 * s);
      ctx.lineTo(c + 8 * s, c - 22 * s);
      ctx.lineTo(c + 16 * s, c - 22 * s);
      ctx.lineTo(c + 16 * s, c - 14 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c - 14 * s, c - 14 * s);
      ctx.lineTo(c - 12 * s, c + 14 * s);
      ctx.lineTo(c - 16 * s, c + 22 * s);
      ctx.lineTo(c + 16 * s, c + 22 * s);
      ctx.lineTo(c + 12 * s, c + 14 * s);
      ctx.lineTo(c + 14 * s, c - 14 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c - 18 * s, c + 26 * s);
      ctx.lineTo(c + 18 * s, c + 26 * s);
      ctx.lineTo(c + 16 * s, c + 22 * s);
      ctx.lineTo(c - 16 * s, c + 22 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    static drawQueen(ctx, c, s, fill, stroke) {
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2 * s;
      const points = 5;
      for (let i = 0; i < points; i++) {
        const angle = i / points * Math.PI - Math.PI / 2;
        const px = c + Math.cos(angle) * 14 * s;
        const py = c - 20 * s + Math.sin(angle) * 4 * s;
        ctx.beginPath();
        ctx.arc(px, py - 4 * s, 2.5 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(c - 16 * s, c - 14 * s);
      ctx.lineTo(c - 20 * s, c - 24 * s);
      ctx.lineTo(c - 8 * s, c - 10 * s);
      ctx.lineTo(c, c - 26 * s);
      ctx.lineTo(c + 8 * s, c - 10 * s);
      ctx.lineTo(c + 20 * s, c - 24 * s);
      ctx.lineTo(c + 16 * s, c - 14 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c - 16 * s, c - 14 * s);
      ctx.quadraticCurveTo(c - 14 * s, c + 6 * s, c - 16 * s, c + 22 * s);
      ctx.lineTo(c + 16 * s, c + 22 * s);
      ctx.quadraticCurveTo(c + 14 * s, c + 6 * s, c + 16 * s, c - 14 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c - 18 * s, c + 26 * s);
      ctx.lineTo(c + 18 * s, c + 26 * s);
      ctx.lineTo(c + 16 * s, c + 22 * s);
      ctx.lineTo(c - 16 * s, c + 22 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    static drawKing(ctx, c, s, fill, stroke) {
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2 * s;
      ctx.fillRect(c - 2 * s, c - 30 * s, 4 * s, 14 * s);
      ctx.strokeRect(c - 2 * s, c - 30 * s, 4 * s, 14 * s);
      ctx.fillRect(c - 6 * s, c - 26 * s, 12 * s, 4 * s);
      ctx.strokeRect(c - 6 * s, c - 26 * s, 12 * s, 4 * s);
      ctx.beginPath();
      ctx.moveTo(c - 16 * s, c - 10 * s);
      ctx.quadraticCurveTo(c, c - 20 * s, c + 16 * s, c - 10 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c - 16 * s, c - 10 * s);
      ctx.quadraticCurveTo(c - 14 * s, c + 8 * s, c - 16 * s, c + 22 * s);
      ctx.lineTo(c + 16 * s, c + 22 * s);
      ctx.quadraticCurveTo(c + 14 * s, c + 8 * s, c + 16 * s, c - 10 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(c - 14 * s, c + 4 * s);
      ctx.lineTo(c + 14 * s, c + 4 * s);
      ctx.stroke();
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      ctx.moveTo(c - 18 * s, c + 26 * s);
      ctx.lineTo(c + 18 * s, c + 26 * s);
      ctx.lineTo(c + 16 * s, c + 22 * s);
      ctx.lineTo(c - 16 * s, c + 22 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    static drawModifierIndicator(ctx, size, s) {
      ctx.fillStyle = "#ffd700";
      ctx.beginPath();
      ctx.arc(size - 6 * s, 6 * s, 4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#b8860b";
      ctx.lineWidth = 1 * s;
      ctx.stroke();
    }
  };

  // src/states/ArmySelectState.js
  var ArmySelectState = class {
    constructor() {
      this.stateMachine = null;
      this.eventBus = null;
      this.renderer = null;
      this.runManager = null;
      this.armies = getArmyList();
      this.selectedIndex = 0;
      this.hoverIndex = -1;
      this.clickHandler = null;
      this.moveHandler = null;
      this.keyHandler = null;
    }
    enter() {
      this.selectedIndex = 0;
      this.hoverIndex = -1;
      this.bindInput();
    }
    exit() {
      if (this.clickHandler) this.eventBus.off("click", this.clickHandler);
      if (this.moveHandler) this.eventBus.off("mousemove", this.moveHandler);
      if (this.keyHandler) this.eventBus.off("keydown", this.keyHandler);
    }
    bindInput() {
      this.clickHandler = (data) => this.handleClick(data);
      this.moveHandler = (data) => this.handleMove(data);
      this.keyHandler = (data) => this.handleKey(data);
      this.eventBus.on("click", this.clickHandler);
      this.eventBus.on("mousemove", this.moveHandler);
      this.eventBus.on("keydown", this.keyHandler);
    }
    getCardBounds() {
      const cardW = 180;
      const cardH = 240;
      const gap = 20;
      const totalW = this.armies.length * (cardW + gap) - gap;
      const startX = (this.renderer.width - totalW) / 2;
      const y = this.renderer.height / 2 - cardH / 2 + 20;
      return this.armies.map((_, i) => ({
        x: startX + i * (cardW + gap),
        y,
        w: cardW,
        h: cardH
      }));
    }
    handleClick(data) {
      const bounds = this.getCardBounds();
      for (let i = 0; i < bounds.length; i++) {
        const b = bounds[i];
        if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
          this.selectArmy(i);
          return;
        }
      }
    }
    handleMove(data) {
      const bounds = this.getCardBounds();
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
      if (data.code === "ArrowLeft") {
        this.selectedIndex = (this.selectedIndex - 1 + this.armies.length) % this.armies.length;
      } else if (data.code === "ArrowRight") {
        this.selectedIndex = (this.selectedIndex + 1) % this.armies.length;
      } else if (data.code === "Enter" || data.code === "Space") {
        this.selectArmy(this.selectedIndex);
      } else if (data.code === "Escape") {
        this.stateMachine.change("mainMenu");
      }
    }
    selectArmy(index) {
      const army = this.armies[index];
      if (this.runManager) {
        this.runManager.startRun(army.id);
        this.stateMachine.change("map");
      }
    }
    update(dt) {
    }
    render(ctx) {
      ctx.font = "bold 36px monospace";
      ctx.fillStyle = UI_COLORS.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Choose Your Army", this.renderer.width / 2, 60);
      ctx.font = "14px monospace";
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.fillText("Select a starting army for your run", this.renderer.width / 2, 95);
      const bounds = this.getCardBounds();
      for (let i = 0; i < this.armies.length; i++) {
        const army = this.armies[i];
        const b = bounds[i];
        const isHover = this.hoverIndex === i;
        const isSelected = this.selectedIndex === i;
        ctx.fillStyle = isHover || isSelected ? UI_COLORS.panel : UI_COLORS.bgLight;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = isSelected ? army.color : isHover ? UI_COLORS.accent : UI_COLORS.panelBorder;
        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.font = "bold 13px monospace";
        ctx.fillStyle = army.color;
        ctx.textAlign = "center";
        ctx.fillText(army.name, b.x + b.w / 2, b.y + 22);
        const pieceSize = 28;
        const piecesPerRow = 4;
        const pieceGap = 4;
        const pieceTotalW = Math.min(army.pieces.length, piecesPerRow) * (pieceSize + pieceGap);
        const pieceStartX = b.x + (b.w - pieceTotalW) / 2;
        for (let j = 0; j < army.pieces.length; j++) {
          const row = Math.floor(j / piecesPerRow);
          const col = j % piecesPerRow;
          const px = pieceStartX + col * (pieceSize + pieceGap);
          const py = b.y + 38 + row * (pieceSize + pieceGap);
          const tempPiece = new Piece(army.pieces[j].type, TEAMS.PLAYER);
          PieceRenderer.draw(ctx, tempPiece, px, py, pieceSize);
        }
        ctx.font = "11px monospace";
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = "center";
        const desc = army.description;
        this.wrapText(ctx, desc, b.x + b.w / 2, b.y + 140, b.w - 16, 14);
      }
      ctx.font = "12px monospace";
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.textAlign = "center";
      ctx.fillText("Click to select  |  Arrow keys to browse  |  Enter to confirm", this.renderer.width / 2, this.renderer.height - 40);
    }
    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
      const words = text.split(" ");
      let line = "";
      let lines = [];
      for (const word of words) {
        const test = line + (line ? " " : "") + word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x, y + i * lineHeight);
      }
    }
  };

  // src/states/MapState.js
  var NODE_COLORS = {
    battle: "#e94560",
    elite: "#ff9800",
    shop: "#4caf50",
    event: "#9c27b0",
    rest: "#2196f3",
    boss: "#ffd700"
  };
  var NODE_LABELS = {
    battle: "Battle",
    elite: "Elite",
    shop: "Shop",
    event: "Event",
    rest: "Rest",
    boss: "BOSS"
  };
  var MapState = class {
    constructor() {
      this.stateMachine = null;
      this.eventBus = null;
      this.renderer = null;
      this.runManager = null;
      this.floorData = null;
      this.hoverNode = null;
      this.clickHandler = null;
      this.moveHandler = null;
      this.keyHandler = null;
    }
    enter() {
      this.floorData = this.runManager.getCurrentFloorData();
      this.hoverNode = null;
      if (this.floorData) {
        const anyVisited = this.floorData.nodes.some((n) => n.visited);
        if (anyVisited && (this.floorData.nodes.length === 1 || this.floorData.nodes.every((n) => n.visited))) {
          const canContinue = this.runManager.advanceFloor();
          if (canContinue) {
            this.floorData = this.runManager.getCurrentFloorData();
          }
        }
      }
      this.bindInput();
    }
    exit() {
      if (this.clickHandler) this.eventBus.off("click", this.clickHandler);
      if (this.moveHandler) this.eventBus.off("mousemove", this.moveHandler);
      if (this.keyHandler) this.eventBus.off("keydown", this.keyHandler);
    }
    bindInput() {
      this.clickHandler = (data) => this.handleClick(data);
      this.moveHandler = (data) => this.handleMove(data);
      this.keyHandler = (data) => this.handleKey(data);
      this.eventBus.on("click", this.clickHandler);
      this.eventBus.on("mousemove", this.moveHandler);
      this.eventBus.on("keydown", this.keyHandler);
    }
    getNodeBounds() {
      if (!this.floorData) return [];
      const w = this.renderer.width;
      const h = this.renderer.height;
      const mapH = h * 0.6;
      const mapY = h * 0.15;
      const mapX = w * 0.1;
      const mapW = w * 0.8;
      const nodeR = 28;
      return this.floorData.nodes.map((node) => ({
        node,
        x: mapX + node.x * mapW,
        y: mapY + node.y * mapH,
        r: nodeR
      }));
    }
    handleClick(data) {
      const bounds = this.getNodeBounds();
      for (const b of bounds) {
        const dx = data.x - b.x;
        const dy = data.y - b.y;
        if (dx * dx + dy * dy < b.r * b.r) {
          this.selectNode(b.node);
          return;
        }
      }
    }
    handleMove(data) {
      const bounds = this.getNodeBounds();
      this.hoverNode = null;
      for (const b of bounds) {
        const dx = data.x - b.x;
        const dy = data.y - b.y;
        if (dx * dx + dy * dy < b.r * b.r) {
          this.hoverNode = b.node;
          break;
        }
      }
    }
    handleKey(data) {
      if (data.code === "Escape") {
        if (this.stateMachine.states.has("pause")) {
          this.stateMachine.push("pause");
        }
      }
    }
    selectNode(node) {
      if (node.visited) return;
      node.visited = true;
      this.runManager.currentNode = node;
      switch (node.type) {
        case "battle":
        case "elite": {
          const encounter = this.runManager.getEncounter(node.type);
          if (encounter) {
            const combatParams = this.runManager.prepareCombat(encounter);
            combatParams.isElite = encounter.isElite;
            this.stateMachine.change("combat", combatParams);
          }
          break;
        }
        case "boss": {
          this.stateMachine.change("bossIntro", { floor: this.runManager.currentFloor });
          break;
        }
        case "shop": {
          const items = this.runManager.generateShop();
          this.stateMachine.change("shop", { items });
          break;
        }
        case "event": {
          this.stateMachine.change("event", { floor: this.runManager.currentFloor });
          break;
        }
        case "rest": {
          this.doRest();
          break;
        }
      }
    }
    doRest() {
      const hasHealingRest = this.runManager.relicSystem.hasRelic("healingRest");
      const type = hasHealingRest ? "knight" : "pawn";
      this.runManager.recruitPiece(type);
      this.eventBus.emit("restCompleted", { recruitedType: type });
      this.checkFloorAdvance();
    }
    checkFloorAdvance() {
      const allVisited = this.floorData.nodes.every((n) => n.visited);
      const anyVisited = this.floorData.nodes.some((n) => n.visited);
      if (allVisited || this.floorData.nodes.length === 1) {
        const canContinue = this.runManager.advanceFloor();
        if (canContinue) {
          this.floorData = this.runManager.getCurrentFloorData();
          this.hoverNode = null;
        }
      }
    }
    update(dt) {
    }
    render(ctx) {
      const w = this.renderer.width;
      const h = this.renderer.height;
      ctx.font = "bold 28px monospace";
      ctx.fillStyle = UI_COLORS.text;
      ctx.textAlign = "center";
      ctx.fillText(`Floor ${this.runManager.currentFloor}`, w / 2, 40);
      ctx.font = "13px monospace";
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.fillText(`Army: ${this.runManager.roster.length} pieces  |  Gold: ${this.runManager.gold}  |  Relics: ${this.runManager.relicSystem.ownedRelics.length}`, w / 2, 68);
      if (!this.floorData) return;
      const bounds = this.getNodeBounds();
      ctx.strokeStyle = UI_COLORS.panelBorder;
      ctx.lineWidth = 2;
      for (const b of bounds) {
        for (const connId of b.node.connections) {
          const target = bounds.find((b2) => b2.node.id === connId);
          if (target) {
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
          }
        }
      }
      for (const b of bounds) {
        const isHover = this.hoverNode === b.node;
        const color = NODE_COLORS[b.node.type] || UI_COLORS.accent;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.node.visited ? UI_COLORS.bgLight : color;
        ctx.fill();
        ctx.strokeStyle = isHover ? "#ffffff" : b.node.visited ? UI_COLORS.textDim : color;
        ctx.lineWidth = isHover ? 3 : 2;
        ctx.stroke();
        if (b.node.visited) {
          ctx.font = "bold 16px monospace";
          ctx.fillStyle = UI_COLORS.textDim;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("\u2713", b.x, b.y);
        }
        ctx.font = "bold 11px monospace";
        ctx.fillStyle = b.node.visited ? UI_COLORS.textDim : UI_COLORS.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(NODE_LABELS[b.node.type] || b.node.type, b.x, b.y + b.r + 6);
      }
      if (this.hoverNode && !this.hoverNode.visited) {
        this.drawTooltip(ctx, this.hoverNode);
      }
      ctx.font = "12px monospace";
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.textAlign = "center";
      ctx.fillText("Click a node to proceed", w / 2, h - 30);
    }
    drawTooltip(ctx, node) {
      const w = this.renderer.width;
      ctx.font = "14px monospace";
      ctx.fillStyle = UI_COLORS.text;
      ctx.textAlign = "center";
      ctx.fillText(`${NODE_LABELS[node.type]} \u2014 Click to enter`, w / 2, this.renderer.height - 60);
      if (this.runManager.relicSystem.hasRelic("terrainSight") && node.terrain && node.terrain.length > 0) {
        ctx.font = "11px monospace";
        ctx.fillStyle = "#aaa";
        const terrainNames = node.terrain.map((t) => t.terrain || t.type || t).join(", ");
        ctx.fillText(`Terrain: ${terrainNames}`, w / 2, this.renderer.height - 44);
      }
    }
  };

  // src/board/Tile.js
  var Tile = class {
    constructor(col, row) {
      this.col = col;
      this.row = row;
      this.piece = null;
      this.terrain = TERRAIN_TYPES.NONE;
      this.isLight = (col + row) % 2 === 0;
    }
    isEmpty() {
      return this.piece === null;
    }
    hasPiece() {
      return this.piece !== null;
    }
    isPassable() {
      return this.terrain !== TERRAIN_TYPES.VOID;
    }
    setPiece(piece) {
      this.piece = piece;
      if (piece) {
        piece.col = this.col;
        piece.row = this.row;
      }
    }
    removePiece() {
      const piece = this.piece;
      this.piece = null;
      return piece;
    }
  };

  // src/util/GridUtil.js
  function isInBounds(col, row, cols, rows) {
    return col >= 0 && col < cols && row >= 0 && row < rows;
  }

  // src/board/Board.js
  var Board = class _Board {
    constructor(cols = 8, rows = 8) {
      this.cols = cols;
      this.rows = rows;
      this.tiles = [];
      this.pieces = [];
      this.init();
    }
    init() {
      this.tiles = [];
      for (let r = 0; r < this.rows; r++) {
        const row = [];
        for (let c = 0; c < this.cols; c++) {
          row.push(new Tile(c, r));
        }
        this.tiles.push(row);
      }
      this.pieces = [];
    }
    getTile(col, row) {
      if (!isInBounds(col, row, this.cols, this.rows)) return null;
      return this.tiles[row][col];
    }
    getPieceAt(col, row) {
      const tile = this.getTile(col, row);
      return tile ? tile.piece : null;
    }
    placePiece(piece, col, row) {
      const tile = this.getTile(col, row);
      if (!tile) return false;
      tile.setPiece(piece);
      if (!this.pieces.includes(piece)) {
        this.pieces.push(piece);
      }
      return true;
    }
    removePiece(piece) {
      const tile = this.getTile(piece.col, piece.row);
      if (tile) tile.removePiece();
      const idx = this.pieces.indexOf(piece);
      if (idx !== -1) this.pieces.splice(idx, 1);
    }
    movePiece(piece, toCol, toRow) {
      const fromTile = this.getTile(piece.col, piece.row);
      const toTile = this.getTile(toCol, toRow);
      if (!fromTile || !toTile) return null;
      let captured = null;
      if (toTile.piece && toTile.piece.team !== piece.team) {
        captured = toTile.piece;
        this.removePiece(captured);
      }
      fromTile.removePiece();
      toTile.setPiece(piece);
      piece.hasMoved = true;
      piece.moveCount++;
      return captured;
    }
    getTeamPieces(team) {
      return this.pieces.filter((p) => p.team === team);
    }
    findKing(team) {
      return this.pieces.find((p) => p.team === team && p.type === "king");
    }
    isSquareAttackedBy(col, row, attackingTeam, getMovesForPiece) {
      const attackers = this.getTeamPieces(attackingTeam);
      for (const piece of attackers) {
        const moves = getMovesForPiece(piece, true);
        if (moves.some((m) => m.col === col && m.row === row)) {
          return true;
        }
      }
      return false;
    }
    clone() {
      const copy = new _Board(this.cols, this.rows);
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          copy.tiles[r][c].terrain = this.tiles[r][c].terrain;
        }
      }
      for (const piece of this.pieces) {
        const cloned = piece.clone();
        copy.placePiece(cloned, cloned.col, cloned.row);
      }
      return copy;
    }
    setTerrain(col, row, terrain) {
      const tile = this.getTile(col, row);
      if (tile) tile.terrain = terrain;
    }
    getEmptyTiles() {
      const empty = [];
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const tile = this.tiles[r][c];
          if (tile.isEmpty() && tile.isPassable()) {
            empty.push(tile);
          }
        }
      }
      return empty;
    }
  };

  // src/board/BoardRenderer.js
  var TERRAIN_COLORS = {
    [TERRAIN_TYPES.FORTRESS]: { light: "#a0c4ff", dark: "#7ba7e0" },
    [TERRAIN_TYPES.ICE]: { light: "#cce5ff", dark: "#99ccee" },
    [TERRAIN_TYPES.BRAMBLE]: { light: "#8bc34a", dark: "#689f38" },
    [TERRAIN_TYPES.VOID]: { light: "#2a2a2a", dark: "#1a1a1a" },
    [TERRAIN_TYPES.ALTAR]: { light: "#ffd54f", dark: "#ffb300" }
  };
  var TERRAIN_SYMBOLS = {
    [TERRAIN_TYPES.FORTRESS]: "\u{1F6E1}",
    [TERRAIN_TYPES.ICE]: "\u2744",
    [TERRAIN_TYPES.BRAMBLE]: "\u2663",
    [TERRAIN_TYPES.VOID]: "\u25AA",
    [TERRAIN_TYPES.ALTAR]: "\u2606"
  };
  var BoardRenderer = class {
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
        y: this.offsetY + row * this.tileSize
      };
    }
    render(ctx, animatingPieces = /* @__PURE__ */ new Set()) {
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
      } else if (this.lastMove && (this.lastMove.from.col === col && this.lastMove.from.row === row || this.lastMove.to.col === col && this.lastMove.to.row === row)) {
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
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(TERRAIN_SYMBOLS[tile.terrain], pos.x + this.tileSize - 2, pos.y + this.tileSize - 2);
      }
      const move = this.legalMoves.find((m) => m.col === col && m.row === row);
      if (move) {
        if (move.type === "capture") {
          ctx.fillStyle = isLight ? TILE_COLORS.lightCapture : TILE_COLORS.darkCapture;
          ctx.fillRect(pos.x, pos.y, this.tileSize, this.tileSize);
          ctx.fillStyle = color;
          const inset = this.tileSize * 0.1;
          ctx.fillRect(pos.x + inset, pos.y + inset, this.tileSize - inset * 2, this.tileSize - inset * 2);
        } else {
          ctx.fillStyle = isLight ? "rgba(170,215,81,0.6)" : "rgba(124,179,66,0.6)";
          ctx.beginPath();
          ctx.arc(pos.x + this.tileSize / 2, pos.y + this.tileSize / 2, this.tileSize * 0.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (this.hoverTile && this.hoverTile.col === col && this.hoverTile.row === row) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(pos.x, pos.y, this.tileSize, this.tileSize);
      }
    }
    drawBoardBorder(ctx) {
      const bw = this.board.cols * this.tileSize;
      const bh = this.board.rows * this.tileSize;
      ctx.strokeStyle = UI_COLORS.panelBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(this.offsetX - 1, this.offsetY - 1, bw + 2, bh + 2);
      ctx.font = `${Math.max(10, this.tileSize * 0.18)}px monospace`;
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let c = 0; c < this.board.cols; c++) {
        const x = this.offsetX + c * this.tileSize + this.tileSize / 2;
        ctx.fillText(String.fromCharCode(97 + c), x, this.offsetY + bh + 14);
      }
      ctx.textAlign = "right";
      for (let r = 0; r < this.board.rows; r++) {
        const y = this.offsetY + r * this.tileSize + this.tileSize / 2;
        ctx.fillText(String(this.board.rows - r), this.offsetX - 8, y);
      }
    }
  };

  // src/pieces/MovementPattern.js
  var MovementPattern = class {
    static getMoves(piece, board, capturesOnly = false) {
      switch (piece.type) {
        case PIECE_TYPES.PAWN:
          return this.getPawnMoves(piece, board, capturesOnly);
        case PIECE_TYPES.KNIGHT:
          return this.getKnightMoves(piece, board, capturesOnly);
        case PIECE_TYPES.BISHOP:
          return this.getBishopMoves(piece, board, capturesOnly);
        case PIECE_TYPES.ROOK:
          return this.getRookMoves(piece, board, capturesOnly);
        case PIECE_TYPES.QUEEN:
          return this.getQueenMoves(piece, board, capturesOnly);
        case PIECE_TYPES.KING:
          return this.getKingMoves(piece, board, capturesOnly);
        default:
          return [];
      }
    }
    static getPawnMoves(piece, board, capturesOnly) {
      const moves = [];
      const direction = piece.team === TEAMS.PLAYER ? -1 : 1;
      const { col, row } = piece;
      if (!capturesOnly) {
        const fwd = row + direction;
        if (isInBounds(col, fwd, board.cols, board.rows)) {
          const tile = board.getTile(col, fwd);
          if (tile.isEmpty() && tile.isPassable()) {
            moves.push({ col, row: fwd, type: "move" });
            if (!piece.hasMoved) {
              const fwd2 = row + direction * 2;
              if (isInBounds(col, fwd2, board.cols, board.rows)) {
                const tile2 = board.getTile(col, fwd2);
                if (tile2.isEmpty() && tile2.isPassable()) {
                  moves.push({ col, row: fwd2, type: "move" });
                }
              }
            }
          }
        }
      }
      for (const dc of [-1, 1]) {
        const nc = col + dc;
        const nr = row + direction;
        if (isInBounds(nc, nr, board.cols, board.rows)) {
          const tile = board.getTile(nc, nr);
          if (tile.isPassable()) {
            if (tile.hasPiece() && tile.piece.team !== piece.team) {
              moves.push({ col: nc, row: nr, type: "capture" });
            } else if (capturesOnly) {
              moves.push({ col: nc, row: nr, type: "threat" });
            }
          }
        }
      }
      return moves;
    }
    static getKnightMoves(piece, board, capturesOnly) {
      const moves = [];
      const offsets = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1]
      ];
      for (const [dc, dr] of offsets) {
        const nc = piece.col + dc;
        const nr = piece.row + dr;
        if (!isInBounds(nc, nr, board.cols, board.rows)) continue;
        const tile = board.getTile(nc, nr);
        if (!tile.isPassable()) continue;
        if (tile.hasPiece()) {
          if (tile.piece.team !== piece.team) {
            moves.push({ col: nc, row: nr, type: "capture" });
          }
        } else if (!capturesOnly) {
          moves.push({ col: nc, row: nr, type: "move" });
        } else {
          moves.push({ col: nc, row: nr, type: "threat" });
        }
      }
      return moves;
    }
    static getSlidingMoves(piece, board, directions, capturesOnly) {
      const moves = [];
      for (const [dc, dr] of directions) {
        let nc = piece.col + dc;
        let nr = piece.row + dr;
        while (isInBounds(nc, nr, board.cols, board.rows)) {
          const tile = board.getTile(nc, nr);
          if (!tile.isPassable()) break;
          if (tile.hasPiece()) {
            if (tile.piece.team !== piece.team) {
              moves.push({ col: nc, row: nr, type: "capture" });
            }
            break;
          }
          if (!capturesOnly) {
            moves.push({ col: nc, row: nr, type: "move" });
          } else {
            moves.push({ col: nc, row: nr, type: "threat" });
          }
          nc += dc;
          nr += dr;
        }
      }
      return moves;
    }
    static getBishopMoves(piece, board, capturesOnly) {
      return this.getSlidingMoves(piece, board, [[-1, -1], [1, -1], [-1, 1], [1, 1]], capturesOnly);
    }
    static getRookMoves(piece, board, capturesOnly) {
      return this.getSlidingMoves(piece, board, [[0, -1], [0, 1], [-1, 0], [1, 0]], capturesOnly);
    }
    static getQueenMoves(piece, board, capturesOnly) {
      return this.getSlidingMoves(piece, board, [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0]
      ], capturesOnly);
    }
    static getKingMoves(piece, board, capturesOnly) {
      const moves = [];
      const offsets = [
        [-1, -1],
        [0, -1],
        [1, -1],
        [-1, 0],
        [1, 0],
        [-1, 1],
        [0, 1],
        [1, 1]
      ];
      for (const [dc, dr] of offsets) {
        const nc = piece.col + dc;
        const nr = piece.row + dr;
        if (!isInBounds(nc, nr, board.cols, board.rows)) continue;
        const tile = board.getTile(nc, nr);
        if (!tile.isPassable()) continue;
        if (tile.hasPiece()) {
          if (tile.piece.team !== piece.team) {
            moves.push({ col: nc, row: nr, type: "capture" });
          }
        } else if (!capturesOnly) {
          moves.push({ col: nc, row: nr, type: "move" });
        } else {
          moves.push({ col: nc, row: nr, type: "threat" });
        }
      }
      return moves;
    }
  };

  // src/combat/TurnManager.js
  var TurnManager = class {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.currentTeam = TEAMS.PLAYER;
      this.turnNumber = 0;
      this.extraTurns = 0;
      this.consecutiveCaptures = 0;
    }
    reset() {
      this.currentTeam = TEAMS.PLAYER;
      this.turnNumber = 0;
      this.extraTurns = 0;
      this.consecutiveCaptures = 0;
    }
    get isPlayerTurn() {
      return this.currentTeam === TEAMS.PLAYER;
    }
    nextTurn() {
      if (this.extraTurns > 0) {
        this.extraTurns--;
        this.eventBus.emit("extraTurn", { team: this.currentTeam });
        return;
      }
      this.currentTeam = this.currentTeam === TEAMS.PLAYER ? TEAMS.ENEMY : TEAMS.PLAYER;
      this.turnNumber++;
      this.eventBus.emit("turnChanged", {
        team: this.currentTeam,
        turn: this.turnNumber
      });
    }
    grantExtraTurn(count = 1) {
      this.extraTurns += count;
    }
    onCapture() {
      this.consecutiveCaptures++;
    }
    onNonCapture() {
      this.consecutiveCaptures = 0;
    }
    getConsecutiveCaptures() {
      return this.consecutiveCaptures;
    }
  };

  // src/combat/CaptureResolver.js
  var CaptureResolver = class {
    constructor(board, eventBus) {
      this.board = board;
      this.eventBus = eventBus;
    }
    canCapture(attacker, targetCol, targetRow) {
      const target = this.board.getPieceAt(targetCol, targetRow);
      if (!target) return false;
      if (target.team === attacker.team) return false;
      const tile = this.board.getTile(targetCol, targetRow);
      if (tile.terrain === TERRAIN_TYPES.FORTRESS) {
        return false;
      }
      for (const mod of target.modifiers) {
        if (mod.type === "protection") {
          if (mod.id === "sideProtection") {
            if (attacker.col !== targetCol && attacker.row === targetRow) {
              return false;
            }
          }
          if (mod.id === "firstTurnProtection" && target.moveCount <= 1) {
            return false;
          }
        }
      }
      return true;
    }
    resolveCapture(attacker, target) {
      this.board.removePiece(target);
      this.eventBus.emit("pieceCaptured", {
        captured: target,
        capturedBy: attacker,
        col: target.col,
        row: target.row
      });
      if (target.type === PIECE_TYPES.QUEEN) {
        for (const mod of target.modifiers) {
          if (mod.id === "queenSplit") {
            this.eventBus.emit("queenSplit", { queen: target });
          }
        }
      }
      return target;
    }
    getGoldValue(piece) {
      const values = {
        [PIECE_TYPES.PAWN]: 2,
        [PIECE_TYPES.KNIGHT]: 5,
        [PIECE_TYPES.BISHOP]: 5,
        [PIECE_TYPES.ROOK]: 8,
        [PIECE_TYPES.QUEEN]: 12,
        [PIECE_TYPES.KING]: 25
      };
      return values[piece.type] || 1;
    }
  };

  // src/combat/CheckDetector.js
  var CheckDetector = class {
    constructor(board) {
      this.board = board;
    }
    isKingInCheck(team) {
      const king = this.board.findKing(team);
      if (!king) return false;
      const enemyTeam = team === "player" ? "enemy" : "player";
      return this.isSquareAttacked(king.col, king.row, enemyTeam);
    }
    isSquareAttacked(col, row, byTeam) {
      const pieces = this.board.getTeamPieces(byTeam);
      for (const piece of pieces) {
        const moves = MovementPattern.getMoves(piece, this.board, true);
        if (moves.some((m) => m.col === col && m.row === row)) {
          return true;
        }
      }
      return false;
    }
    getAttackersOfSquare(col, row, byTeam) {
      const attackers = [];
      const pieces = this.board.getTeamPieces(byTeam);
      for (const piece of pieces) {
        const moves = MovementPattern.getMoves(piece, this.board, true);
        if (moves.some((m) => m.col === col && m.row === row)) {
          attackers.push(piece);
        }
      }
      return attackers;
    }
    wouldMoveCauseCheck(piece, toCol, toRow, team) {
      const boardCopy = this.board.clone();
      const pieceCopy = boardCopy.getPieceAt(piece.col, piece.row);
      if (!pieceCopy) return false;
      boardCopy.movePiece(pieceCopy, toCol, toRow);
      const king = boardCopy.findKing(team);
      if (!king) return false;
      const enemyTeam = team === "player" ? "enemy" : "player";
      const enemies = boardCopy.getTeamPieces(enemyTeam);
      for (const enemy of enemies) {
        const moves = MovementPattern.getMoves(enemy, boardCopy, true);
        if (moves.some((m) => m.col === king.col && m.row === king.row)) {
          return true;
        }
      }
      return false;
    }
    hasLegalMoves(team) {
      const pieces = this.board.getTeamPieces(team);
      for (const piece of pieces) {
        if (piece.isFrozen) continue;
        const moves = MovementPattern.getMoves(piece, this.board, false);
        for (const move of moves) {
          if (move.type === "threat") continue;
          if (!this.wouldMoveCauseCheck(piece, move.col, move.row, team)) {
            return true;
          }
        }
      }
      return false;
    }
  };

  // src/ai/AIBehaviors.js
  var AIBehaviors = {
    evaluateMove(piece, move, board, ownTeam, enemyTeam) {
      let score = 0;
      if (move.type === "capture") {
        const target = board.getPieceAt(move.col, move.row);
        if (target) {
          score += PIECE_VALUES[target.type] * 100;
          if (target.type === PIECE_TYPES.KING) {
            score += 1e4;
          }
        }
      }
      const risk = this.evaluateSquareRisk(move.col, move.row, piece, board, enemyTeam);
      score -= risk;
      const currentRisk = this.evaluateSquareRisk(piece.col, piece.row, piece, board, enemyTeam);
      if (currentRisk > 0 && risk === 0 && move.type !== "capture") {
        score += currentRisk * 0.5;
      }
      const centerCol = board.cols / 2;
      const centerRow = board.rows / 2;
      const centerDist = Math.abs(move.col - centerCol) + Math.abs(move.row - centerRow);
      score += (board.cols - centerDist) * 2;
      const enemyKing = board.findKing(enemyTeam);
      if (enemyKing) {
        const distToKing = Math.abs(move.col - enemyKing.col) + Math.abs(move.row - enemyKing.row);
        score += (20 - distToKing) * 3;
      }
      if (piece.type === PIECE_TYPES.PAWN) {
        const direction = piece.team === "player" ? -1 : 1;
        score += move.row * direction * 5;
      }
      score += this.evaluateKingSafety(board, ownTeam) * 0.1;
      const ownKing = board.findKing(ownTeam);
      if (ownKing && piece.type !== PIECE_TYPES.KING) {
        const distToOwnKing = Math.abs(move.col - ownKing.col) + Math.abs(move.row - ownKing.row);
        const enemies = board.getTeamPieces(enemyTeam);
        const nearbyEnemies = enemies.filter(
          (e) => Math.abs(e.col - ownKing.col) + Math.abs(e.row - ownKing.row) <= 3
        );
        if (nearbyEnemies.length > 0 && distToOwnKing <= 2) {
          score += nearbyEnemies.length * 15;
        }
      }
      return score;
    },
    evaluateSquareRisk(col, row, movingPiece, board, enemyTeam) {
      const enemies = board.getTeamPieces(enemyTeam);
      let risk = 0;
      for (const enemy of enemies) {
        const moves = MovementPattern.getMoves(enemy, board, true);
        if (moves.some((m) => m.col === col && m.row === row)) {
          risk += PIECE_VALUES[movingPiece.type] * 50;
          break;
        }
      }
      return risk;
    },
    evaluateKingSafety(board, team) {
      const king = board.findKing(team);
      if (!king) return -1e4;
      const enemyTeam = team === "player" ? "enemy" : "player";
      const enemies = board.getTeamPieces(enemyTeam);
      let dangerScore = 0;
      for (const enemy of enemies) {
        const dist = Math.abs(enemy.col - king.col) + Math.abs(enemy.row - king.row);
        if (dist <= 2) dangerScore += PIECE_VALUES[enemy.type] * 20;
        else if (dist <= 4) dangerScore += PIECE_VALUES[enemy.type] * 5;
      }
      return -dangerScore;
    }
  };

  // src/ai/ThreatMap.js
  var ThreatMap = class {
    constructor(board) {
      this.board = board;
      this.threats = /* @__PURE__ */ new Map();
      this.defenses = /* @__PURE__ */ new Map();
    }
    build(team) {
      this.threats.clear();
      this.defenses.clear();
      const pieces = this.board.getTeamPieces(team);
      for (const piece of pieces) {
        const moves = MovementPattern.getMoves(piece, this.board, true);
        for (const move of moves) {
          const key = `${move.col},${move.row}`;
          const target = this.board.getPieceAt(move.col, move.row);
          if (target && target.team === team) {
            if (!this.defenses.has(key)) this.defenses.set(key, []);
            this.defenses.get(key).push(piece);
          } else {
            if (!this.threats.has(key)) this.threats.set(key, []);
            this.threats.get(key).push(piece);
          }
        }
      }
    }
    isSquareThreatened(col, row) {
      return this.threats.has(`${col},${row}`);
    }
    getThreatsAt(col, row) {
      return this.threats.get(`${col},${row}`) || [];
    }
    isSquareDefended(col, row) {
      return this.defenses.has(`${col},${row}`);
    }
    getDefendersAt(col, row) {
      return this.defenses.get(`${col},${row}`) || [];
    }
    isPieceHanging(piece) {
      const key = `${piece.col},${piece.row}`;
      const threats = this.threats.get(key) || [];
      const defenders = this.defenses.get(key) || [];
      return threats.length > 0 && defenders.length === 0;
    }
  };

  // src/ai/AIController.js
  var AIController = class {
    constructor(board, eventBus) {
      this.board = board;
      this.eventBus = eventBus;
      this.difficulty = 1;
      this.threatMap = new ThreatMap(board);
      this.modifierSystem = null;
      this.relics = [];
      this.turnManager = null;
    }
    setDifficulty(level) {
      this.difficulty = Math.max(1, Math.min(5, level));
    }
    getBestMove(team = TEAMS.ENEMY) {
      const pieces = this.board.getTeamPieces(team);
      const enemyTeam = team === TEAMS.PLAYER ? TEAMS.ENEMY : TEAMS.PLAYER;
      this.threatMap.build(enemyTeam);
      let allMoves = [];
      const enemySlowed = this.relics.some((r) => r.id === "enemySlowed");
      const turnNum = this.turnManager ? this.turnManager.turnNumber : 0;
      for (const piece of pieces) {
        if (piece.isFrozen) continue;
        if (enemySlowed && piece.type === PIECE_TYPES.KING && turnNum % 2 === 0) continue;
        const baseMoves = MovementPattern.getMoves(piece, this.board, false).filter((m) => m.type !== "threat");
        const moves = this.modifierSystem ? this.modifierSystem.getModifiedMoves(piece, baseMoves) : baseMoves;
        for (const move of moves) {
          const score = AIBehaviors.evaluateMove(
            piece,
            move,
            this.board,
            team,
            enemyTeam
          );
          allMoves.push({ piece, move, score });
        }
      }
      if (allMoves.length === 0) return null;
      allMoves.sort((a, b) => b.score - a.score);
      if (this.difficulty < 5) {
        const topN = Math.max(1, Math.ceil(allMoves.length * (1 - this.difficulty * 0.22)));
        const candidates = allMoves.slice(0, topN);
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
      return allMoves[0];
    }
  };

  // src/pieces/ModifierSystem.js
  var ModifierSystem = class {
    constructor(board, relics = []) {
      this.board = board;
      this.relics = relics;
    }
    applyModifier(piece, moves, mod) {
      switch (mod.id) {
        case "knightKingMove":
          return this.addKingMoves(piece, moves);
        case "pawnDiagonalMove":
          return this.addPawnDiagonalMoves(piece, moves);
        case "bishopLeap":
          return this.addBishopLeapMoves(piece, moves);
        case "pawnForwardCapture":
          return this.addPawnForwardCapture(piece, moves);
        case "rookExtraRange":
          return this.addRookJumpMoves(piece, moves);
        case "kingInspire":
          return this.addInspiredMoves(piece, moves);
        default:
          return moves;
      }
    }
    applyRelicEffects(piece, moves) {
      if (piece.type === PIECE_TYPES.PAWN && this.hasRelic("pawnForwardCapture") && !piece.hasModifier("pawnForwardCapture")) {
        moves = this.addPawnForwardCapture(piece, moves);
      }
      return moves;
    }
    addKingMoves(piece, moves) {
      const offsets = [
        [-1, -1],
        [0, -1],
        [1, -1],
        [-1, 0],
        [1, 0],
        [-1, 1],
        [0, 1],
        [1, 1]
      ];
      for (const [dc, dr] of offsets) {
        const nc = piece.col + dc;
        const nr = piece.row + dr;
        if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) continue;
        const tile = this.board.getTile(nc, nr);
        if (!tile.isPassable()) continue;
        if (moves.some((m) => m.col === nc && m.row === nr)) continue;
        if (tile.hasPiece()) {
          if (tile.piece.team !== piece.team) {
            moves.push({ col: nc, row: nr, type: "capture" });
          }
        } else {
          moves.push({ col: nc, row: nr, type: "move" });
        }
      }
      return moves;
    }
    addPawnDiagonalMoves(piece, moves) {
      const dir = piece.team === TEAMS.PLAYER ? -1 : 1;
      for (const dc of [-1, 1]) {
        const nc = piece.col + dc;
        const nr = piece.row + dir;
        if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) continue;
        if (moves.some((m) => m.col === nc && m.row === nr)) continue;
        const tile = this.board.getTile(nc, nr);
        if (tile.isEmpty() && tile.isPassable()) {
          moves.push({ col: nc, row: nr, type: "move" });
        }
      }
      return moves;
    }
    addBishopLeapMoves(piece, moves) {
      const directions = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (const [dc, dr] of directions) {
        let nc = piece.col + dc;
        let nr = piece.row + dr;
        let leaped = false;
        while (isInBounds(nc, nr, this.board.cols, this.board.rows)) {
          const tile = this.board.getTile(nc, nr);
          if (!tile.isPassable()) break;
          if (tile.hasPiece()) {
            if (!leaped && tile.piece.team === piece.team) {
              leaped = true;
              nc += dc;
              nr += dr;
              continue;
            }
            if (tile.piece.team !== piece.team) {
              if (!moves.some((m) => m.col === nc && m.row === nr)) {
                moves.push({ col: nc, row: nr, type: "capture" });
              }
            }
            break;
          }
          if (!moves.some((m) => m.col === nc && m.row === nr)) {
            moves.push({ col: nc, row: nr, type: "move" });
          }
          nc += dc;
          nr += dr;
        }
      }
      return moves;
    }
    addPawnForwardCapture(piece, moves) {
      const dir = piece.team === TEAMS.PLAYER ? -1 : 1;
      const nc = piece.col;
      const nr = piece.row + dir;
      if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) return moves;
      const tile = this.board.getTile(nc, nr);
      if (tile.hasPiece() && tile.piece.team !== piece.team) {
        if (!moves.some((m) => m.col === nc && m.row === nr)) {
          moves.push({ col: nc, row: nr, type: "capture" });
        }
      }
      return moves;
    }
    addRookJumpMoves(piece, moves) {
      const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [dc, dr] of directions) {
        let blocked = false;
        let jumpCount = 0;
        for (let dist = 1; dist < Math.max(this.board.cols, this.board.rows); dist++) {
          const nc = piece.col + dc * dist;
          const nr = piece.row + dr * dist;
          if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) break;
          const tile = this.board.getTile(nc, nr);
          if (!tile.isPassable()) break;
          if (tile.hasPiece()) {
            if (!blocked && dist <= 2) {
              blocked = true;
              jumpCount++;
              if (jumpCount > 1) break;
              continue;
            }
            if (blocked && tile.piece.team !== piece.team) {
              if (!moves.some((m) => m.col === nc && m.row === nr)) {
                moves.push({ col: nc, row: nr, type: "capture" });
              }
            }
            break;
          }
          if (!moves.some((m) => m.col === nc && m.row === nr)) {
            moves.push({ col: nc, row: nr, type: "move" });
          }
        }
      }
      return moves;
    }
    addInspiredMoves(piece, moves) {
      return moves;
    }
    getModifiedMoves(piece, baseMoves) {
      let moves = [...baseMoves];
      for (const mod of piece.modifiers) {
        moves = this.applyModifier(piece, moves, mod);
      }
      moves = this.applyRelicEffects(piece, moves);
      if (piece.type !== PIECE_TYPES.KING) {
        const king = this.board.getTeamPieces(piece.team).find(
          (p) => p.type === PIECE_TYPES.KING && p.hasModifier("kingInspire")
        );
        if (king) {
          const dx = Math.abs(piece.col - king.col);
          const dy = Math.abs(piece.row - king.row);
          if (dx <= 1 && dy <= 1) {
            moves = this.extendMoveRange(piece, moves);
          }
        }
      }
      return moves;
    }
    extendMoveRange(piece, moves) {
      const extended = [];
      for (const m of moves) {
        const dc = m.col - piece.col;
        const dr = m.row - piece.row;
        const len = Math.max(Math.abs(dc), Math.abs(dr));
        if (len === 0) continue;
        const ndx = Math.sign(dc);
        const ndy = Math.sign(dr);
        const nc = m.col + ndx;
        const nr = m.row + ndy;
        if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) continue;
        if (moves.some((em) => em.col === nc && em.row === nr)) continue;
        if (extended.some((em) => em.col === nc && em.row === nr)) continue;
        const tile = this.board.getTile(nc, nr);
        if (!tile || !tile.isPassable()) continue;
        if (tile.hasPiece()) {
          if (tile.piece.team !== piece.team) {
            extended.push({ col: nc, row: nr, type: "capture" });
          }
        } else {
          extended.push({ col: nc, row: nr, type: "move" });
        }
      }
      return [...moves, ...extended];
    }
    hasRelic(id) {
      return this.relics.some((r) => r.id === id);
    }
    handlePostCapture(piece, capturedPiece) {
      const results = { extraMove: false };
      if (piece.hasModifier("bishopDoubleCapture") || piece.hasModifier("knightDoubleCapture")) {
        results.extraMove = true;
      }
      return results;
    }
  };

  // src/combat/CombatManager.js
  var CombatManager = class {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.board = null;
      this.turnManager = new TurnManager(eventBus);
      this.captureResolver = null;
      this.checkDetector = null;
      this.ai = null;
      this.capturedByPlayer = [];
      this.capturedByEnemy = [];
      this.goldEarned = 0;
      this.gameOver = false;
      this.winner = null;
      this.relics = [];
      this.modifierSystem = null;
    }
    initBattle(board, options = {}) {
      this.board = board;
      this.captureResolver = new CaptureResolver(board, this.eventBus);
      this.checkDetector = new CheckDetector(board);
      this.ai = new AIController(board, this.eventBus);
      this.ai.setDifficulty(options.difficulty || 2);
      this.turnManager.reset();
      this.capturedByPlayer = [];
      this.capturedByEnemy = [];
      this.goldEarned = 0;
      this.gameOver = false;
      this.winner = null;
      this.relics = options.relics || [];
      this.armyAbility = options.armyAbility || null;
      this.modifierSystem = new ModifierSystem(board, this.relics);
      this.ai.modifierSystem = this.modifierSystem;
      this.ai.relics = this.relics;
      this.ai.turnManager = this.turnManager;
      if (this.hasRelic("freeMove")) {
        this.turnManager.grantExtraTurn(1);
      }
    }
    getLegalMoves(piece) {
      if (piece.isFrozen) return [];
      const rawMoves = MovementPattern.getMoves(piece, this.board, false).filter((m) => m.type !== "threat");
      return this.modifierSystem ? this.modifierSystem.getModifiedMoves(piece, rawMoves) : rawMoves;
    }
    executeMove(piece, toCol, toRow) {
      const fromCol = piece.col;
      const fromRow = piece.row;
      const target = this.board.getPieceAt(toCol, toRow);
      let captured = null;
      if (target && target.team !== piece.team) {
        if (!this.captureResolver.canCapture(piece, toCol, toRow)) {
          return { success: false, reason: "protected" };
        }
        captured = this.captureResolver.resolveCapture(piece, target);
      }
      const fromTile = this.board.getTile(fromCol, fromRow);
      const toTile = this.board.getTile(toCol, toRow);
      fromTile.removePiece();
      toTile.setPiece(piece);
      piece.hasMoved = true;
      piece.moveCount++;
      const result = {
        success: true,
        piece,
        from: { col: fromCol, row: fromRow },
        to: { col: toCol, row: toRow },
        captured,
        promoted: false,
        extraTurn: false
      };
      if (captured) {
        if (piece.team === TEAMS.PLAYER) {
          this.capturedByPlayer.push(captured);
          this.goldEarned += this.captureResolver.getGoldValue(captured);
        } else {
          this.capturedByEnemy.push(captured);
        }
        this.turnManager.onCapture();
        if (captured.type === PIECE_TYPES.KING) {
          this.endBattle(piece.team);
          result.kingCaptured = true;
          return result;
        }
        if (this.hasRelic("captureStreak") && this.turnManager.getConsecutiveCaptures() >= 3) {
          this.turnManager.grantExtraTurn(1);
          result.extraTurn = true;
          this.turnManager.consecutiveCaptures = 0;
        }
        if (this.modifierSystem) {
          const postCapture = this.modifierSystem.handlePostCapture(piece, captured);
          if (postCapture.extraMove) {
            this.turnManager.grantExtraTurn(1);
            result.extraTurn = true;
          }
        }
      } else {
        this.turnManager.onNonCapture();
      }
      const landedTile = this.board.getTile(toCol, toRow);
      if (landedTile.terrain === TERRAIN_TYPES.BRAMBLE) {
        piece.isFrozen = true;
      }
      if (landedTile.terrain === TERRAIN_TYPES.ICE) {
        result.iceSlide = this.applyIceSlide(piece, toCol - fromCol, toRow - fromRow);
      }
      if (piece.type === PIECE_TYPES.PAWN) {
        const promoRow = piece.team === TEAMS.PLAYER ? 0 : this.board.rows - 1;
        let promoRank = promoRow;
        if ((this.hasRelic("earlyPromotion") || this.armyAbility === "earlyPromotion") && piece.team === TEAMS.PLAYER) {
          promoRank = 1;
        }
        if (piece.team === TEAMS.PLAYER && toRow <= promoRank || piece.team === TEAMS.ENEMY && toRow >= promoRank) {
          result.needsPromotion = true;
        }
        if (landedTile.terrain === TERRAIN_TYPES.ALTAR) {
          result.needsPromotion = true;
        }
      }
      return result;
    }
    applyIceSlide(piece, dx, dy) {
      if (dx === 0 && dy === 0) return null;
      const dirCol = dx === 0 ? 0 : dx > 0 ? 1 : -1;
      const dirRow = dy === 0 ? 0 : dy > 0 ? 1 : -1;
      const slideCol = piece.col + dirCol;
      const slideRow = piece.row + dirRow;
      const tile = this.board.getTile(slideCol, slideRow);
      if (tile && tile.isEmpty() && tile.isPassable()) {
        const fromTile = this.board.getTile(piece.col, piece.row);
        fromTile.removePiece();
        tile.setPiece(piece);
        return { col: slideCol, row: slideRow };
      }
      return null;
    }
    promotePiece(piece, newType) {
      piece.promote(newType);
      this.eventBus.emit("piecePromoted", { piece, newType });
    }
    endTurn() {
      const currentPieces = this.board.getTeamPieces(this.turnManager.currentTeam);
      for (const p of currentPieces) {
        if (p.isFrozen) p.isFrozen = false;
      }
      this.turnManager.nextTurn();
    }
    getAIMove() {
      if (!this.ai) return null;
      return this.ai.getBestMove(TEAMS.ENEMY);
    }
    endBattle(winnerTeam) {
      this.gameOver = true;
      this.winner = winnerTeam;
      this.eventBus.emit("combatEnd", {
        winner: winnerTeam,
        capturedByPlayer: this.capturedByPlayer,
        capturedByEnemy: this.capturedByEnemy,
        goldEarned: this.goldEarned,
        turns: this.turnManager.turnNumber
      });
    }
    isKingInCheck(team) {
      return this.checkDetector ? this.checkDetector.isKingInCheck(team) : false;
    }
    hasRelic(relicId) {
      return this.relics.some((r) => r.id === relicId);
    }
  };

  // src/ui/FloatingText.js
  var FloatingText = class {
    constructor() {
      this.texts = [];
    }
    add(x, y, text, color = "#ffffff", duration = 1e3, fontSize = 18) {
      this.texts.push({
        x,
        y,
        startY: y,
        text,
        color,
        duration,
        elapsed: 0,
        fontSize,
        alpha: 1
      });
    }
    update(dt) {
      for (const t of this.texts) {
        t.elapsed += dt * 1e3;
        const progress = t.elapsed / t.duration;
        t.y = t.startY - progress * 40;
        t.alpha = 1 - progress;
      }
      this.texts = this.texts.filter((t) => t.elapsed < t.duration);
    }
    render(ctx) {
      for (const t of this.texts) {
        ctx.globalAlpha = Math.max(0, t.alpha);
        ctx.font = `bold ${t.fontSize}px monospace`;
        ctx.fillStyle = t.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    }
  };

  // src/util/EasingFunctions.js
  var Easing = {
    linear: (t) => t,
    easeInQuad: (t) => t * t,
    easeOutQuad: (t) => t * (2 - t),
    easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic: (t) => t * t * t,
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    easeOutBack: (t) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    easeOutElastic: (t) => {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
    },
    easeOutBounce: (t) => {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  };

  // src/render/Tween.js
  var Tween = class {
    constructor(target, props, duration, easing = "easeOutCubic", onComplete = null) {
      this.target = target;
      this.startValues = {};
      this.endValues = {};
      this.duration = duration;
      this.elapsed = 0;
      this.easing = typeof easing === "function" ? easing : Easing[easing] || Easing.linear;
      this.onComplete = onComplete;
      this.done = false;
      this.delay = 0;
      for (const key of Object.keys(props)) {
        this.startValues[key] = target[key];
        this.endValues[key] = props[key];
      }
    }
    setDelay(ms) {
      this.delay = ms;
      return this;
    }
    update(dt) {
      if (this.done) return true;
      if (this.delay > 0) {
        this.delay -= dt * 1e3;
        if (this.delay > 0) return false;
      }
      this.elapsed += dt * 1e3;
      const progress = Math.min(this.elapsed / this.duration, 1);
      const t = this.easing(progress);
      for (const key of Object.keys(this.endValues)) {
        this.target[key] = this.startValues[key] + (this.endValues[key] - this.startValues[key]) * t;
      }
      if (progress >= 1) {
        this.done = true;
        if (this.onComplete) this.onComplete();
        return true;
      }
      return false;
    }
  };

  // src/render/AnimationManager.js
  var AnimationManager = class {
    constructor() {
      this.tweens = [];
      this.animations = [];
    }
    addTween(target, props, duration, easing, onComplete) {
      const tween = new Tween(target, props, duration, easing, onComplete);
      this.tweens.push(tween);
      return tween;
    }
    addAnimation(anim) {
      this.animations.push(anim);
      return anim;
    }
    update(dt) {
      this.tweens = this.tweens.filter((t) => !t.update(dt));
      this.animations = this.animations.filter((a) => {
        a.elapsed = (a.elapsed || 0) + dt * 1e3;
        if (a.elapsed >= a.duration) {
          if (a.onComplete) a.onComplete();
          return false;
        }
        if (a.update) a.update(a.elapsed / a.duration);
        return true;
      });
    }
    get isAnimating() {
      return this.tweens.length > 0 || this.animations.length > 0;
    }
    clear() {
      this.tweens = [];
      this.animations = [];
    }
  };

  // src/ai/Evaluator.js
  var Evaluator = class {
    static evaluateBoard(board, team) {
      const enemyTeam = team === "player" ? "enemy" : "player";
      let score = 0;
      for (const piece of board.getTeamPieces(team)) {
        score += PIECE_VALUES[piece.type] * 100;
      }
      for (const piece of board.getTeamPieces(enemyTeam)) {
        score -= PIECE_VALUES[piece.type] * 100;
      }
      let ownMoves = 0;
      let enemyMoves = 0;
      for (const p of board.getTeamPieces(team)) {
        ownMoves += MovementPattern.getMoves(p, board, false).length;
      }
      for (const p of board.getTeamPieces(enemyTeam)) {
        enemyMoves += MovementPattern.getMoves(p, board, false).length;
      }
      score += (ownMoves - enemyMoves) * 2;
      score += this.evaluateKingSafety(board, team);
      score -= this.evaluateKingSafety(board, enemyTeam);
      const centerCols = [Math.floor(board.cols / 2) - 1, Math.floor(board.cols / 2)];
      const centerRows = [Math.floor(board.rows / 2) - 1, Math.floor(board.rows / 2)];
      for (const c of centerCols) {
        for (const r of centerRows) {
          const piece = board.getPieceAt(c, r);
          if (piece) {
            score += piece.team === team ? 10 : -10;
          }
        }
      }
      return score;
    }
    static evaluateKingSafety(board, team) {
      const king = board.findKing(team);
      if (!king) return -5e3;
      const enemyTeam = team === "player" ? "enemy" : "player";
      let safety = 0;
      for (const enemy of board.getTeamPieces(enemyTeam)) {
        const dist = Math.abs(enemy.col - king.col) + Math.abs(enemy.row - king.row);
        if (dist <= 2) safety -= PIECE_VALUES[enemy.type] * 15;
        else if (dist <= 4) safety -= PIECE_VALUES[enemy.type] * 3;
      }
      for (const friend of board.getTeamPieces(team)) {
        if (friend === king) continue;
        const dist = Math.abs(friend.col - king.col) + Math.abs(friend.row - king.row);
        if (dist <= 2) safety += 5;
      }
      return safety;
    }
    static minimax(board, depth, isMaximizing, team, alpha = -Infinity, beta = Infinity) {
      if (depth === 0) {
        return { score: this.evaluateBoard(board, team) };
      }
      const currentTeam = isMaximizing ? team : team === "player" ? "enemy" : "player";
      const pieces = board.getTeamPieces(currentTeam);
      let bestMove = null;
      let bestScore = isMaximizing ? -Infinity : Infinity;
      for (const piece of pieces) {
        if (piece.isFrozen) continue;
        const moves = MovementPattern.getMoves(piece, board, false).filter((m) => m.type !== "threat");
        for (const move of moves) {
          const boardCopy = board.clone();
          const pieceCopy = boardCopy.getPieceAt(piece.col, piece.row);
          if (!pieceCopy) continue;
          boardCopy.movePiece(pieceCopy, move.col, move.row);
          const result = this.minimax(boardCopy, depth - 1, !isMaximizing, team, alpha, beta);
          if (isMaximizing) {
            if (result.score > bestScore) {
              bestScore = result.score;
              bestMove = { piece, move, score: bestScore };
            }
            alpha = Math.max(alpha, bestScore);
          } else {
            if (result.score < bestScore) {
              bestScore = result.score;
              bestMove = { piece, move, score: bestScore };
            }
            beta = Math.min(beta, bestScore);
          }
          if (beta <= alpha) break;
        }
        if (beta <= alpha) break;
      }
      return bestMove || { score: bestScore };
    }
  };

  // src/ai/BossAI.js
  var BossAI = class {
    constructor(board, eventBus, bossData) {
      this.board = board;
      this.eventBus = eventBus;
      this.bossData = bossData;
      this.currentPhase = 0;
      this.phaseTriggered = /* @__PURE__ */ new Set([0]);
    }
    checkPhaseTransition() {
      const phases = this.bossData.phases;
      for (let i = this.currentPhase + 1; i < phases.length; i++) {
        if (this.phaseTriggered.has(i)) continue;
        const phase = phases[i];
        if (phase.triggerCondition === "piecesRemaining") {
          const enemyCount = this.board.getTeamPieces(TEAMS.ENEMY).length;
          if (enemyCount <= phase.triggerValue) {
            this.triggerPhase(i);
            return true;
          }
        }
      }
      return false;
    }
    triggerPhase(phaseIndex) {
      const phase = this.bossData.phases[phaseIndex];
      this.currentPhase = phaseIndex;
      this.phaseTriggered.add(phaseIndex);
      if (phase.addPieces) {
        for (const p of phase.addPieces) {
          const tile = this.board.getTile(p.col, p.row);
          if (tile && tile.isEmpty()) {
            const piece = new Piece(p.type, TEAMS.ENEMY, p.col, p.row);
            this.board.placePiece(piece, p.col, p.row);
          }
        }
      }
      if (phase.addTerrain) {
        for (const t of phase.addTerrain) {
          this.board.setTerrain(t.col, t.row, t.terrain);
        }
      }
      if (phase.removeTerrain) {
        for (const t of phase.removeTerrain) {
          this.board.setTerrain(t.col, t.row, "none");
        }
      }
      this.eventBus.emit("bossPhaseChange", {
        phase: phaseIndex,
        name: phase.name
      });
    }
    getBestMove() {
      const depth = this.currentPhase >= 2 ? 3 : 2;
      const result = Evaluator.minimax(this.board, depth, true, TEAMS.ENEMY);
      if (result && result.piece && result.move) {
        return result;
      }
      return this.getFallbackMove();
    }
    getFallbackMove() {
      const pieces = this.board.getTeamPieces(TEAMS.ENEMY);
      let bestMove = null;
      let bestScore = -Infinity;
      for (const piece of pieces) {
        if (piece.isFrozen) continue;
        const moves = MovementPattern.getMoves(piece, this.board, false).filter((m) => m.type !== "threat");
        for (const move of moves) {
          let score = Math.random() * 5;
          if (move.type === "capture") {
            const target = this.board.getPieceAt(move.col, move.row);
            if (target) score += PIECE_VALUES[target.type] * 100;
          }
          const playerKing = this.board.findKing(TEAMS.PLAYER);
          if (playerKing) {
            const dist = Math.abs(move.col - playerKing.col) + Math.abs(move.row - playerKing.row);
            score += (20 - dist) * 3;
          }
          const ownKing = this.board.findKing(TEAMS.ENEMY);
          if (ownKing && piece.type !== PIECE_TYPES.KING) {
            const distToOwnKing = Math.abs(move.col - ownKing.col) + Math.abs(move.row - ownKing.row);
            if (distToOwnKing <= 2) score += 10;
          }
          if (score > bestScore) {
            bestScore = score;
            bestMove = { piece, move, score };
          }
        }
      }
      return bestMove;
    }
  };

  // src/states/CombatState.js
  var CombatState = class {
    constructor() {
      this.board = null;
      this.boardRenderer = null;
      this.combatManager = null;
      this.animManager = new AnimationManager();
      this.floatingText = new FloatingText();
      this.selectedPiece = null;
      this.legalMoves = [];
      this.gameOver = false;
      this.winner = null;
      this.stateMachine = null;
      this.eventBus = null;
      this.renderer = null;
      this.runManager = null;
      this.animatingMove = null;
      this.capturedByPlayer = [];
      this.capturedByEnemy = [];
      this.turnCount = 0;
      this.statusMessage = "";
      this.statusTimer = 0;
      this.pendingPromotion = null;
      this.promotionChoices = [PIECE_TYPES.QUEEN, PIECE_TYPES.ROOK, PIECE_TYPES.BISHOP, PIECE_TYPES.KNIGHT];
      this.clickHandler = null;
      this.moveHandler = null;
      this.rightClickHandler = null;
      this.keyHandler = null;
      this.encounterParams = null;
      this.screenShake = { x: 0, y: 0, intensity: 0, decay: 0.9 };
      this.isBoss = false;
      this.bossAI = null;
      this.bossPhaseMessage = "";
      this.bossPhaseTimer = 0;
    }
    enter(params = {}) {
      this.encounterParams = params;
      const cols = params.cols || 8;
      const rows = params.rows || 8;
      this.board = new Board(cols, rows);
      this.boardRenderer = new BoardRenderer(this.board, this.renderer);
      this.combatManager = new CombatManager(this.eventBus);
      this.combatManager.initBattle(this.board, {
        difficulty: params.difficulty || 2,
        relics: params.relics || [],
        armyAbility: params.armyAbility || null
      });
      this.selectedPiece = null;
      this.legalMoves = [];
      this.gameOver = false;
      this.winner = null;
      this.capturedByPlayer = [];
      this.capturedByEnemy = [];
      this.turnCount = 0;
      this.animatingMove = null;
      this.pendingPromotion = null;
      this.screenShake = { x: 0, y: 0, intensity: 0, decay: 0.9 };
      this.isBoss = params.isBoss || false;
      this.bossAI = null;
      this.bossPhaseMessage = "";
      this.bossPhaseTimer = 0;
      if (params.bossData) {
        this.bossAI = new BossAI(this.board, this.eventBus, params.bossData);
        this.eventBus.on("bossPhaseChange", (data) => {
          this.bossPhaseMessage = data.name;
          this.bossPhaseTimer = 3;
          this.shakeScreen(8);
        });
      }
      this.queenSplitHandler = (data) => this.handleQueenSplit(data);
      this.eventBus.on("queenSplit", this.queenSplitHandler);
      if (params.setup) {
        params.setup(this.board);
      } else if (params.playerPieces && params.enemyPieces) {
        for (const p of params.playerPieces) {
          const piece = p.piece instanceof Piece ? p.piece : p instanceof Piece ? p : new Piece(p.type, TEAMS.PLAYER);
          piece.hasMoved = false;
          piece.moveCount = 0;
          piece.isFrozen = false;
          this.board.placePiece(piece, p.col, p.row);
        }
        for (const p of params.enemyPieces) {
          const piece = p.piece instanceof Piece ? p.piece : p instanceof Piece ? p : new Piece(p.type, TEAMS.ENEMY);
          this.board.placePiece(piece, p.col, p.row);
        }
        if (params.terrain) {
          for (const t of params.terrain) {
            this.board.setTerrain(t.col, t.row, t.terrain);
          }
        }
      } else {
        this.setupDefaultBattle();
      }
      if (params.relics?.some((r) => r.id === "shieldStart")) {
        const playerPawns = this.board.getTeamPieces(TEAMS.PLAYER).filter((p) => p.type === PIECE_TYPES.PAWN);
        if (playerPawns.length > 0) {
          const minRow = Math.min(...playerPawns.map((p) => p.row));
          const frontPawns = playerPawns.filter((p) => p.row <= minRow + 1);
          for (const pawn of frontPawns) {
            if (!pawn.hasModifier("firstTurnProtection")) {
              pawn.addModifier({ id: "firstTurnProtection", type: "protection", name: "Opening Guard" });
            }
          }
        }
      }
      this.showStatus("Your move");
      this.bindInput();
    }
    setupDefaultBattle() {
      const b = this.board;
      const midCol = Math.floor(b.cols / 2);
      const lastRow = b.rows - 1;
      b.placePiece(new Piece(PIECE_TYPES.KING, TEAMS.PLAYER), midCol, lastRow);
      b.placePiece(new Piece(PIECE_TYPES.QUEEN, TEAMS.PLAYER), midCol - 1, lastRow);
      b.placePiece(new Piece(PIECE_TYPES.BISHOP, TEAMS.PLAYER), midCol - 2, lastRow);
      b.placePiece(new Piece(PIECE_TYPES.BISHOP, TEAMS.PLAYER), midCol + 1, lastRow);
      b.placePiece(new Piece(PIECE_TYPES.KNIGHT, TEAMS.PLAYER), midCol - 3, lastRow);
      b.placePiece(new Piece(PIECE_TYPES.KNIGHT, TEAMS.PLAYER), midCol + 2, lastRow);
      b.placePiece(new Piece(PIECE_TYPES.ROOK, TEAMS.PLAYER), Math.max(0, midCol - 4), lastRow);
      b.placePiece(new Piece(PIECE_TYPES.ROOK, TEAMS.PLAYER), Math.min(b.cols - 1, midCol + 3), lastRow);
      for (let c = Math.max(0, midCol - 4); c <= Math.min(b.cols - 1, midCol + 3); c++) {
        b.placePiece(new Piece(PIECE_TYPES.PAWN, TEAMS.PLAYER), c, lastRow - 1);
      }
      b.placePiece(new Piece(PIECE_TYPES.KING, TEAMS.ENEMY), midCol, 0);
      b.placePiece(new Piece(PIECE_TYPES.QUEEN, TEAMS.ENEMY), midCol + 1, 0);
      b.placePiece(new Piece(PIECE_TYPES.BISHOP, TEAMS.ENEMY), midCol - 2, 0);
      b.placePiece(new Piece(PIECE_TYPES.BISHOP, TEAMS.ENEMY), midCol + 2, 0);
      b.placePiece(new Piece(PIECE_TYPES.KNIGHT, TEAMS.ENEMY), midCol - 1, 0);
      b.placePiece(new Piece(PIECE_TYPES.KNIGHT, TEAMS.ENEMY), midCol + 3, 0);
      b.placePiece(new Piece(PIECE_TYPES.ROOK, TEAMS.ENEMY), Math.max(0, midCol - 3), 0);
      b.placePiece(new Piece(PIECE_TYPES.ROOK, TEAMS.ENEMY), Math.min(b.cols - 1, midCol + 4), 0);
      for (let c = Math.max(0, midCol - 4); c <= Math.min(b.cols - 1, midCol + 3); c++) {
        b.placePiece(new Piece(PIECE_TYPES.PAWN, TEAMS.ENEMY), c, 1);
      }
    }
    bindInput() {
      this.clickHandler = (data) => this.handleClick(data);
      this.moveHandler = (data) => this.handleMouseMove(data);
      this.rightClickHandler = () => this.deselect();
      this.keyHandler = (data) => this.handleKey(data);
      this.eventBus.on("click", this.clickHandler);
      this.eventBus.on("mousemove", this.moveHandler);
      this.eventBus.on("rightclick", this.rightClickHandler);
      this.eventBus.on("keydown", this.keyHandler);
    }
    exit() {
      if (this.clickHandler) this.eventBus.off("click", this.clickHandler);
      if (this.moveHandler) this.eventBus.off("mousemove", this.moveHandler);
      if (this.rightClickHandler) this.eventBus.off("rightclick", this.rightClickHandler);
      if (this.keyHandler) this.eventBus.off("keydown", this.keyHandler);
      if (this.queenSplitHandler) this.eventBus.off("queenSplit", this.queenSplitHandler);
    }
    handleClick(data) {
      if (this.animatingMove) return;
      if (this.pendingPromotion) {
        this.handlePromotionClick(data);
        return;
      }
      if (this.gameOver) {
        this.onCombatFinished();
        return;
      }
      if (!this.combatManager.turnManager.isPlayerTurn) return;
      const pos = this.boardRenderer.screenToBoard(data.x, data.y);
      if (!pos) return;
      const { col, row } = pos;
      const clickedPiece = this.board.getPieceAt(col, row);
      if (this.selectedPiece) {
        const move = this.legalMoves.find((m) => m.col === col && m.row === row);
        if (move) {
          this.startMoveAnimation(this.selectedPiece, move);
          return;
        }
        if (clickedPiece && clickedPiece.team === TEAMS.PLAYER && !clickedPiece.isFrozen) {
          this.selectPiece(clickedPiece);
          return;
        }
        this.deselect();
      } else {
        if (clickedPiece && clickedPiece.team === TEAMS.PLAYER && !clickedPiece.isFrozen) {
          this.selectPiece(clickedPiece);
        }
      }
    }
    handleMouseMove(data) {
      if (!this.boardRenderer) return;
      this.boardRenderer.hoverTile = this.boardRenderer.screenToBoard(data.x, data.y);
    }
    handleKey(data) {
      if (data.code === "Escape") {
        if (this.pendingPromotion) return;
        if (this.selectedPiece) {
          this.deselect();
        } else if (this.stateMachine.states.has("pause")) {
          this.stateMachine.push("pause");
        }
      }
    }
    selectPiece(piece) {
      this.selectedPiece = piece;
      this.legalMoves = this.combatManager.getLegalMoves(piece);
      this.boardRenderer.selectedPiece = piece;
      this.boardRenderer.legalMoves = this.legalMoves;
    }
    deselect() {
      this.selectedPiece = null;
      this.legalMoves = [];
      this.boardRenderer.selectedPiece = null;
      this.boardRenderer.legalMoves = [];
    }
    startMoveAnimation(piece, move) {
      this.deselect();
      this.animatingMove = {
        piece,
        fromCol: piece.col,
        fromRow: piece.row,
        toCol: move.col,
        toRow: move.row,
        progress: 0,
        duration: ANIMATION.moveDuration,
        moveType: move.type
      };
    }
    finishMove(anim) {
      const result = this.combatManager.executeMove(anim.piece, anim.toCol, anim.toRow);
      if (!result.success) return;
      this.boardRenderer.lastMove = { from: result.from, to: result.to };
      if (result.captured) {
        const pos = this.boardRenderer.boardToScreen(anim.toCol, anim.toRow);
        const ts = this.boardRenderer.tileSize;
        this.floatingText.add(pos.x + ts / 2, pos.y, "Captured!", UI_COLORS.accent, 800, 16);
        this.shakeScreen(4);
        this.capturedByPlayer = this.combatManager.capturedByPlayer;
        this.capturedByEnemy = this.combatManager.capturedByEnemy;
      }
      if (result.kingCaptured) {
        this.gameOver = true;
        this.winner = result.piece.team;
        this.shakeScreen(10);
        const msg = this.winner === TEAMS.PLAYER ? "VICTORY!" : "DEFEAT!";
        this.showStatus(msg);
        return;
      }
      if (result.needsPromotion) {
        if (anim.piece.team === TEAMS.PLAYER) {
          this.pendingPromotion = anim.piece;
          this.showStatus("Choose promotion");
          return;
        } else {
          this.combatManager.promotePiece(anim.piece, PIECE_TYPES.QUEEN);
          this.afterMove();
          return;
        }
      }
      this.afterMove();
    }
    afterMove() {
      this.combatManager.endTurn();
      this.turnCount = this.combatManager.turnManager.turnNumber;
      if (this.combatManager.turnManager.isPlayerTurn) {
        this.showStatus("Your move");
        this.updateCheckWarning();
      } else {
        this.showStatus("Enemy thinking...");
        setTimeout(() => this.doAITurn(), 350);
      }
    }
    updateCheckWarning() {
      const king = this.board.findKing(TEAMS.PLAYER);
      if (king && this.combatManager.isKingInCheck(TEAMS.PLAYER)) {
        this.boardRenderer.checkSquare = { col: king.col, row: king.row };
        this.showStatus("Your king is in danger!");
      } else {
        this.boardRenderer.checkSquare = null;
      }
    }
    doAITurn() {
      if (this.gameOver) return;
      if (this.combatManager.turnManager.isPlayerTurn) return;
      if (this.bossAI) {
        this.bossAI.checkPhaseTransition();
      }
      const result = this.bossAI ? this.bossAI.getBestMove() : this.combatManager.getAIMove();
      if (result) {
        this.startMoveAnimation(result.piece, result.move);
      } else {
        this.combatManager.endTurn();
        this.turnCount = this.combatManager.turnManager.turnNumber;
        this.showStatus("Your move");
        this.updateCheckWarning();
      }
    }
    onCombatFinished() {
      const isWin = this.winner === TEAMS.PLAYER;
      const survivingPlayerPieces = this.board.getTeamPieces(TEAMS.PLAYER);
      if (this.runManager && this.runManager.isActive) {
        this.eventBus.emit("combatFinished", {
          victory: isWin,
          goldEarned: this.combatManager.goldEarned,
          capturedByPlayer: this.combatManager.capturedByPlayer,
          capturedByEnemy: this.combatManager.capturedByEnemy,
          survivingPlayerPieces,
          turns: this.turnCount,
          isElite: this.encounterParams?.isElite || false
        });
      } else {
        this.stateMachine.change("mainMenu");
      }
    }
    shakeScreen(intensity) {
      this.screenShake.intensity = intensity;
    }
    showStatus(msg) {
      this.statusMessage = msg;
      this.statusTimer = 2.5;
    }
    handlePromotionClick(data) {
      const piece = this.pendingPromotion;
      if (!piece) return;
      const btnW = 70;
      const btnH = 70;
      const gap = 10;
      const totalW = this.promotionChoices.length * (btnW + gap) - gap;
      const startX = (this.renderer.width - totalW) / 2;
      const y = this.renderer.height / 2 - btnH / 2;
      for (let i = 0; i < this.promotionChoices.length; i++) {
        const bx = startX + i * (btnW + gap);
        if (data.x >= bx && data.x <= bx + btnW && data.y >= y && data.y <= y + btnH) {
          this.combatManager.promotePiece(piece, this.promotionChoices[i]);
          this.pendingPromotion = null;
          this.showStatus(`Promoted to ${this.promotionChoices[i]}!`);
          const pos = this.boardRenderer.boardToScreen(piece.col, piece.row);
          const ts = this.boardRenderer.tileSize;
          this.floatingText.add(pos.x + ts / 2, pos.y, "Promoted!", UI_COLORS.gold, 1e3, 18);
          if (this.combatManager.hasRelic("extraPieceOnPromote")) {
            this.spawnPawnNear(piece.col, piece.row, piece.team);
          }
          this.afterMove();
          return;
        }
      }
    }
    spawnPawnNear(col, row, team) {
      for (const [dc, dr] of [[0, 1], [0, -1], [-1, 0], [1, 0], [-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc >= 0 && nc < this.board.cols && nr >= 0 && nr < this.board.rows) {
          const tile = this.board.getTile(nc, nr);
          if (tile && tile.isEmpty() && tile.isPassable()) {
            const pawn = new Piece(PIECE_TYPES.PAWN, team, nc, nr);
            this.board.placePiece(pawn, nc, nr);
            const pos = this.boardRenderer.boardToScreen(nc, nr);
            const ts = this.boardRenderer.tileSize;
            this.floatingText.add(pos.x + ts / 2, pos.y, "+Pawn", UI_COLORS.success, 1e3, 14);
            return;
          }
        }
      }
    }
    handleQueenSplit(data) {
      const queen = data.queen;
      const { col, row } = queen;
      const adjacent = [];
      for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc >= 0 && nc < this.board.cols && nr >= 0 && nr < this.board.rows) {
          const tile = this.board.getTile(nc, nr);
          if (tile && tile.isEmpty() && tile.isPassable()) {
            adjacent.push({ col: nc, row: nr });
          }
        }
      }
      let spawned = 0;
      const spawnTypes = [PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK];
      for (let i = 0; i < spawnTypes.length && i < adjacent.length; i++) {
        const sq = adjacent[i];
        const piece = new Piece(spawnTypes[i], queen.team, sq.col, sq.row);
        this.board.placePiece(piece, sq.col, sq.row);
        spawned++;
      }
      if (spawned > 0) {
        const pos = this.boardRenderer.boardToScreen(col, row);
        const ts = this.boardRenderer.tileSize;
        this.floatingText.add(pos.x + ts / 2, pos.y, "Queen splits!", UI_COLORS.gold, 1200, 16);
        this.shakeScreen(6);
      }
    }
    update(dt) {
      if (this.statusTimer > 0) this.statusTimer -= dt;
      if (this.bossPhaseTimer > 0) this.bossPhaseTimer -= dt;
      this.floatingText.update(dt);
      this.animManager.update(dt);
      if (this.screenShake.intensity > 0.1) {
        this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity * 2;
        this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity * 2;
        this.screenShake.intensity *= this.screenShake.decay;
      } else {
        this.screenShake.x = 0;
        this.screenShake.y = 0;
        this.screenShake.intensity = 0;
      }
      if (this.animatingMove) {
        this.animatingMove.progress += dt * 1e3 / this.animatingMove.duration;
        if (this.animatingMove.progress >= 1) {
          const anim = this.animatingMove;
          this.animatingMove = null;
          this.finishMove(anim);
        }
      }
    }
    render(ctx) {
      if (!this.boardRenderer) return;
      ctx.save();
      ctx.translate(this.screenShake.x, this.screenShake.y);
      const animatingPieces = /* @__PURE__ */ new Set();
      if (this.animatingMove) {
        animatingPieces.add(this.animatingMove.piece.id);
      }
      this.boardRenderer.render(ctx, animatingPieces);
      if (this.animatingMove) {
        const anim = this.animatingMove;
        const from = this.boardRenderer.boardToScreen(anim.fromCol, anim.fromRow);
        const to = this.boardRenderer.boardToScreen(anim.toCol, anim.toRow);
        const t = easeOutCubic(anim.progress);
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t;
        PieceRenderer.draw(ctx, anim.piece, x, y, this.boardRenderer.tileSize);
      }
      ctx.restore();
      this.floatingText.render(ctx);
      this.drawUI(ctx);
      if (this.bossPhaseTimer > 0) this.drawBossPhase(ctx);
      if (this.pendingPromotion) this.drawPromotionUI(ctx);
      if (this.gameOver) this.drawGameOverOverlay(ctx);
    }
    drawUI(ctx) {
      const tm = this.combatManager ? this.combatManager.turnManager : null;
      const turnNum = tm ? Math.floor(tm.turnNumber / 2) + 1 : 1;
      const isPlayerTurn = tm ? tm.isPlayerTurn : true;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, this.renderer.width, 44);
      ctx.font = "14px monospace";
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`Turn ${turnNum}`, 16, 22);
      ctx.fillStyle = isPlayerTurn ? UI_COLORS.success : UI_COLORS.danger;
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText(isPlayerTurn ? "YOUR TURN" : "ENEMY TURN", this.renderer.width / 2, 22);
      if (this.combatManager) {
        ctx.fillStyle = UI_COLORS.gold;
        ctx.font = "14px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`Gold: ${this.combatManager.goldEarned}`, this.renderer.width - 16, 22);
      }
      if (this.statusTimer > 0 && this.statusMessage) {
        const alpha = Math.min(1, this.statusTimer);
        ctx.globalAlpha = alpha;
        ctx.font = "bold 16px monospace";
        ctx.fillStyle = UI_COLORS.accent;
        ctx.textAlign = "center";
        ctx.fillText(this.statusMessage, this.renderer.width / 2, 62);
        ctx.globalAlpha = 1;
      }
      this.drawCapturedPieces(ctx);
    }
    drawCapturedPieces(ctx) {
      const size = 22;
      const spacing = 24;
      const y = this.renderer.height - 36;
      if (this.capturedByPlayer.length > 0) {
        ctx.font = "11px monospace";
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = "left";
        ctx.fillText("Captured:", 12, y - 4);
        for (let i = 0; i < this.capturedByPlayer.length; i++) {
          PieceRenderer.draw(ctx, this.capturedByPlayer[i], 12 + i * spacing, y, size);
        }
      }
    }
    drawPromotionUI(ctx) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);
      ctx.font = "bold 22px monospace";
      ctx.fillStyle = UI_COLORS.text;
      ctx.textAlign = "center";
      ctx.fillText("Choose Promotion", this.renderer.width / 2, this.renderer.height / 2 - 65);
      const btnW = 70;
      const btnH = 70;
      const gap = 10;
      const totalW = this.promotionChoices.length * (btnW + gap) - gap;
      const startX = (this.renderer.width - totalW) / 2;
      const y = this.renderer.height / 2 - btnH / 2;
      for (let i = 0; i < this.promotionChoices.length; i++) {
        const bx = startX + i * (btnW + gap);
        ctx.fillStyle = UI_COLORS.panel;
        ctx.fillRect(bx, y, btnW, btnH);
        ctx.strokeStyle = UI_COLORS.panelBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, y, btnW, btnH);
        const tempPiece = new Piece(this.promotionChoices[i], this.pendingPromotion.team);
        PieceRenderer.draw(ctx, tempPiece, bx + 3, y + 3, btnW - 6);
        ctx.font = "10px monospace";
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = "center";
        ctx.fillText(this.promotionChoices[i], bx + btnW / 2, y + btnH + 14);
      }
    }
    drawBossPhase(ctx) {
      const alpha = Math.min(1, this.bossPhaseTimer * 0.8);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, this.renderer.height / 2 - 30, this.renderer.width, 60);
      ctx.font = "bold 22px monospace";
      ctx.fillStyle = UI_COLORS.danger;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.bossPhaseMessage, this.renderer.width / 2, this.renderer.height / 2);
      ctx.globalAlpha = 1;
    }
    drawGameOverOverlay(ctx) {
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);
      const isWin = this.winner === TEAMS.PLAYER;
      ctx.font = "bold 52px monospace";
      ctx.fillStyle = isWin ? UI_COLORS.success : UI_COLORS.danger;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isWin ? "VICTORY" : "DEFEAT", this.renderer.width / 2, this.renderer.height / 2 - 50);
      ctx.font = "18px monospace";
      ctx.fillStyle = UI_COLORS.text;
      ctx.fillText(
        `Turns: ${Math.floor(this.turnCount / 2)}  |  Captured: ${this.capturedByPlayer.length}  |  Gold: ${this.combatManager ? this.combatManager.goldEarned : 0}`,
        this.renderer.width / 2,
        this.renderer.height / 2 + 10
      );
      ctx.font = "14px monospace";
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.fillText("Click to continue", this.renderer.width / 2, this.renderer.height / 2 + 50);
    }
  };
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // src/states/ShopState.js
  var ShopState = class {
    constructor() {
      this.stateMachine = null;
      this.eventBus = null;
      this.renderer = null;
      this.runManager = null;
      this.items = [];
      this.hoverIndex = -1;
      this.message = "";
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
      this.message = "";
      this.messageTimer = 0;
      this.bindInput();
    }
    exit() {
      if (this.clickHandler) this.eventBus.off("click", this.clickHandler);
      if (this.moveHandler) this.eventBus.off("mousemove", this.moveHandler);
      if (this.keyHandler) this.eventBus.off("keydown", this.keyHandler);
    }
    bindInput() {
      this.clickHandler = (data) => this.handleClick(data);
      this.moveHandler = (data) => this.handleMove(data);
      this.keyHandler = (data) => this.handleKey(data);
      this.eventBus.on("click", this.clickHandler);
      this.eventBus.on("mousemove", this.moveHandler);
      this.eventBus.on("keydown", this.keyHandler);
    }
    getItemBounds() {
      const cardW = 160;
      const cardH = 180;
      const gap = 16;
      const totalW = this.items.length * (cardW + gap) - gap;
      const startX = (this.renderer.width - totalW) / 2;
      const y = this.renderer.height / 2 - cardH / 2;
      return this.items.map((item, i) => ({
        item,
        x: startX + i * (cardW + gap),
        y,
        w: cardW,
        h: cardH
      }));
    }
    getLeaveButton() {
      const bw = 140;
      const bh = 40;
      return { x: (this.renderer.width - bw) / 2, y: this.renderer.height - 80, w: bw, h: bh };
    }
    handleClick(data) {
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
        this.stateMachine.change("map");
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
      if (data.code === "Escape") {
        this.stateMachine.change("map");
      }
    }
    purchaseItem(item) {
      if (this.runManager.gold < item.price) {
        this.showMessage("Not enough gold!");
        return;
      }
      if (item.category === "modifier") {
        const valid = this.runManager.roster.filter(
          (p) => item.validPieces && item.validPieces.includes(p.type) && !p.hasModifier(item.id)
        );
        if (valid.length === 0) {
          this.showMessage("No valid pieces for this modifier!");
          return;
        }
        const success2 = this.runManager.purchaseShopItem(item);
        if (success2) {
          this.pendingModifier = item.modifier || item;
          this.validPieces = valid;
          this.showMessage("Select a piece to apply modifier");
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
        piece,
        x: startX + i * (btnW + gap),
        y,
        w: btnW,
        h: btnH
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
      ctx.font = "bold 32px monospace";
      ctx.fillStyle = UI_COLORS.text;
      ctx.textAlign = "center";
      ctx.fillText("Shop", w / 2, 50);
      ctx.font = "bold 18px monospace";
      ctx.fillStyle = UI_COLORS.gold;
      ctx.fillText(`Gold: ${this.runManager.gold}`, w / 2, 85);
      const bounds = this.getItemBounds();
      for (let i = 0; i < bounds.length; i++) {
        const b = bounds[i];
        const item = b.item;
        const isHover = this.hoverIndex === i;
        const canAfford = this.runManager.gold >= item.price;
        ctx.fillStyle = isHover ? UI_COLORS.panel : UI_COLORS.bgLight;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = canAfford ? isHover ? UI_COLORS.accent : UI_COLORS.panelBorder : "#555";
        ctx.lineWidth = isHover ? 2 : 1;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        if (item.category === "piece") {
          const tempPiece = new Piece(item.type, TEAMS.PLAYER);
          PieceRenderer.draw(ctx, tempPiece, b.x + (b.w - 40) / 2, b.y + 12, 40);
        } else {
          ctx.font = "28px serif";
          ctx.fillStyle = item.category === "relic" ? UI_COLORS.gold : UI_COLORS.info;
          ctx.textAlign = "center";
          ctx.fillText(item.category === "relic" ? "\u2605" : "\u25C6", b.x + b.w / 2, b.y + 40);
        }
        ctx.font = "bold 12px monospace";
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = "center";
        ctx.fillText(item.name, b.x + b.w / 2, b.y + 70);
        ctx.font = "10px monospace";
        ctx.fillStyle = UI_COLORS.textDim;
        this.wrapText(ctx, item.description, b.x + b.w / 2, b.y + 88, b.w - 16, 13);
        ctx.font = "bold 14px monospace";
        ctx.fillStyle = canAfford ? UI_COLORS.gold : UI_COLORS.danger;
        ctx.fillText(`${item.price}g`, b.x + b.w / 2, b.y + b.h - 16);
      }
      const lb = this.getLeaveButton();
      ctx.fillStyle = UI_COLORS.panel;
      ctx.fillRect(lb.x, lb.y, lb.w, lb.h);
      ctx.strokeStyle = UI_COLORS.panelBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(lb.x, lb.y, lb.w, lb.h);
      ctx.font = "bold 14px monospace";
      ctx.fillStyle = UI_COLORS.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Leave Shop", lb.x + lb.w / 2, lb.y + lb.h / 2);
      if (this.pendingModifier) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, w, this.renderer.height);
        ctx.font = "bold 18px monospace";
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = "center";
        ctx.fillText(`Apply ${this.pendingModifier.name} to:`, w / 2, this.renderer.height / 2 - 60);
        const pieceBounds = this.getPieceSelectionBounds();
        for (const b of pieceBounds) {
          ctx.fillStyle = UI_COLORS.panel;
          ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.strokeStyle = UI_COLORS.panelBorder;
          ctx.lineWidth = 2;
          ctx.strokeRect(b.x, b.y, b.w, b.h);
          PieceRenderer.draw(ctx, b.piece, b.x + 2, b.y + 2, b.w - 4);
        }
      }
      if (this.messageTimer > 0 && this.message) {
        ctx.globalAlpha = Math.min(1, this.messageTimer);
        ctx.font = "bold 16px monospace";
        ctx.fillStyle = UI_COLORS.accent;
        ctx.textAlign = "center";
        ctx.fillText(this.message, w / 2, this.renderer.height - 120);
        ctx.globalAlpha = 1;
      }
    }
    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
      const words = text.split(" ");
      let line = "";
      let lineNum = 0;
      for (const word of words) {
        const test = line + (line ? " " : "") + word;
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
  };

  // src/data/EventData.js
  var EVENTS = {
    mysteriousAltar: {
      id: "mysteriousAltar",
      title: "Mysterious Altar",
      description: 'You find a glowing altar in the ruins. An ancient voice whispers: "Sacrifice to gain power."',
      choices: [
        {
          text: "Sacrifice a pawn for a random relic",
          effect: "sacrificePawnForRelic",
          requirement: { minPawns: 1 }
        },
        {
          text: "Leave it alone",
          effect: "none"
        }
      ]
    },
    wanderingKnight: {
      id: "wanderingKnight",
      title: "Wandering Knight",
      description: "A lone knight offers to join your cause \u2014 for a price.",
      choices: [
        {
          text: "Pay 15 gold to recruit the knight",
          effect: "buyKnight",
          requirement: { minGold: 15 }
        },
        {
          text: "Challenge the knight \u2014 win and they join for free",
          effect: "knightChallenge"
        },
        {
          text: "Decline",
          effect: "none"
        }
      ]
    },
    forgottenArmory: {
      id: "forgottenArmory",
      title: "Forgotten Armory",
      description: "Old weapon racks line the walls. Some still hold equipment in usable condition.",
      choices: [
        {
          text: "Take a random modifier for a piece",
          effect: "randomModifier"
        },
        {
          text: "Search carefully for gold (10-20)",
          effect: "findGold"
        }
      ]
    },
    cursedMirror: {
      id: "cursedMirror",
      title: "Cursed Mirror",
      description: "A dark mirror shows a twisted reflection. Power radiates from it, but at what cost?",
      choices: [
        {
          text: "Touch the mirror \u2014 upgrade a random piece but lose 1 pawn",
          effect: "mirrorUpgrade",
          requirement: { minPawns: 1 }
        },
        {
          text: "Smash the mirror \u2014 gain 12 gold",
          effect: "smashMirrorGold"
        },
        {
          text: "Walk away",
          effect: "none"
        }
      ]
    },
    campfire: {
      id: "campfire",
      title: "Campfire Rest",
      description: "Your army finds a sheltered spot to rest. The fire crackles warmly.",
      choices: [
        {
          text: "Rest \u2014 recruit a free pawn",
          effect: "recruitPawn"
        },
        {
          text: "Train \u2014 give a random piece a modifier",
          effect: "trainModifier"
        }
      ]
    },
    gamblingDen: {
      id: "gamblingDen",
      title: "Gambling Den",
      description: 'Shady figures offer a game of chance. "Double or nothing," they say.',
      choices: [
        {
          text: "Gamble 10 gold \u2014 50% chance to double it",
          effect: "gamble",
          requirement: { minGold: 10 }
        },
        {
          text: "Rob them \u2014 free relic but take a battle",
          effect: "robGamblers"
        },
        {
          text: "Move along",
          effect: "none"
        }
      ]
    },
    blessedFountain: {
      id: "blessedFountain",
      title: "Blessed Fountain",
      description: "Crystal-clear water flows from an ancient fountain, shimmering with magical energy.",
      choices: [
        {
          text: "Drink \u2014 promote a random pawn immediately",
          effect: "promotePawn",
          requirement: { minPawns: 1 }
        },
        {
          text: "Fill a flask \u2014 gain the next battle with a free turn",
          effect: "grantFreeTurn"
        }
      ]
    }
  };
  function getRandomEvent(rng = Math) {
    const all = Object.values(EVENTS);
    return all[Math.floor(rng.random() * all.length)];
  }

  // src/states/EventState.js
  var EventState = class {
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
      if (this.clickHandler) this.eventBus.off("click", this.clickHandler);
      if (this.moveHandler) this.eventBus.off("mousemove", this.moveHandler);
      if (this.keyHandler) this.eventBus.off("keydown", this.keyHandler);
    }
    bindInput() {
      this.clickHandler = (data) => this.handleClick(data);
      this.moveHandler = (data) => this.handleMove(data);
      this.keyHandler = (data) => this.handleKey(data);
      this.eventBus.on("click", this.clickHandler);
      this.eventBus.on("mousemove", this.moveHandler);
      this.eventBus.on("keydown", this.keyHandler);
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
        choice,
        x,
        y: startY + i * (btnH + gap),
        w: btnW,
        h: btnH
      }));
    }
    handleClick(data) {
      if (this.result) {
        this.stateMachine.change("map");
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
      if (data.code === "Escape" || this.result && data.code === "Enter") {
        this.stateMachine.change("map");
      }
    }
    meetsRequirement(choice) {
      if (!choice.requirement) return true;
      const rm = this.runManager;
      if (choice.requirement.minGold && rm.gold < choice.requirement.minGold) return false;
      if (choice.requirement.minPawns) {
        const pawnCount = rm.roster.filter((p) => p.type === PIECE_TYPES.PAWN).length;
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
        case "none":
          this.result = "You move on.";
          break;
        case "sacrificePawnForRelic": {
          const pawns = rm.roster.filter((p) => p.type === PIECE_TYPES.PAWN);
          if (pawns.length > 0) {
            rm.roster.splice(rm.roster.indexOf(pawns[0]), 1);
            const relic = rm.relicSystem.getRandomReward(rng);
            if (relic) {
              rm.addRelic(relic);
              this.result = `Sacrificed a pawn. Gained relic: ${relic.name}!`;
            } else {
              this.result = "Sacrificed a pawn, but no relics available.";
            }
          }
          break;
        }
        case "buyKnight":
          rm.gold -= 15;
          rm.recruitPiece(PIECE_TYPES.KNIGHT);
          this.result = "A knight joins your army!";
          break;
        case "knightChallenge":
          if (rng.random() < 0.6) {
            rm.recruitPiece(PIECE_TYPES.KNIGHT);
            this.result = "You won the challenge! A knight joins for free!";
          } else {
            const pawns = rm.roster.filter((p) => p.type === PIECE_TYPES.PAWN);
            if (pawns.length > 0) {
              rm.roster.splice(rm.roster.indexOf(pawns[0]), 1);
              this.result = "You lost the challenge and a pawn was defeated.";
            } else {
              this.result = "You lost, but had no pawns to lose.";
            }
          }
          break;
        case "randomModifier": {
          const mod = getRandomModifier(rng);
          if (mod) {
            const validPieces = rm.roster.filter((p) => mod.validPieces.includes(p.type));
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
        case "findGold": {
          const gold = rng.randomInt(10, 20);
          rm.gold += gold;
          this.result = `Found ${gold} gold!`;
          break;
        }
        case "mirrorUpgrade": {
          const pawns = rm.roster.filter((p) => p.type === PIECE_TYPES.PAWN);
          if (pawns.length > 0) {
            rm.roster.splice(rm.roster.indexOf(pawns[0]), 1);
            const types = [PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK];
            const upgradeType = rng.randomChoice(types);
            const mod = getRandomModifier(rng);
            const upgradePiece = rm.recruitPiece(upgradeType);
            if (upgradePiece && mod) upgradePiece.addModifier({ ...mod });
            this.result = `Lost a pawn. Gained a ${upgradeType} with ${mod ? mod.name : "no modifier"}!`;
          }
          break;
        }
        case "smashMirrorGold":
          rm.gold += 12;
          this.result = "Gained 12 gold from the mirror shards.";
          break;
        case "recruitPawn":
          rm.recruitPiece(PIECE_TYPES.PAWN);
          this.result = "A pawn has joined your army.";
          break;
        case "trainModifier": {
          const mod = getRandomModifier(rng);
          if (mod) {
            const valid = rm.roster.filter((p) => mod.validPieces.includes(p.type));
            if (valid.length > 0) {
              rng.randomChoice(valid).addModifier({ ...mod });
              this.result = `Training complete! Gained ${mod.name}.`;
            } else {
              this.result = "No valid pieces to train.";
            }
          }
          break;
        }
        case "gamble":
          rm.gold -= 10;
          if (rng.random() < 0.5) {
            rm.gold += 20;
            this.result = "Lucky! You doubled your bet! +20 gold.";
          } else {
            this.result = "Unlucky. You lost 10 gold.";
          }
          break;
        case "robGamblers": {
          const relic = rm.relicSystem.getRandomReward(rng);
          if (relic) rm.addRelic(relic);
          this.result = relic ? `Stole ${relic.name}! But they might come for revenge...` : "Nothing worth stealing.";
          break;
        }
        case "promotePawn": {
          const pawns = rm.roster.filter((p) => p.type === PIECE_TYPES.PAWN);
          if (pawns.length > 0) {
            const types = [PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK];
            const promoType = rng.randomChoice(types);
            pawns[0].promote(promoType);
            this.result = `A pawn was promoted to ${promoType}!`;
          }
          break;
        }
        case "grantFreeTurn":
          rm.addRelic({ id: "freeMove", name: "Initiative Crown", description: "Start each battle with a free move" });
          this.result = "Gained Initiative Crown \u2014 free first move in battles!";
          break;
        default:
          this.result = "Nothing happened.";
      }
      this.resultTimer = 5;
    }
    update(dt) {
      if (this.resultTimer > 0) this.resultTimer -= dt;
    }
    render(ctx) {
      const w = this.renderer.width;
      if (!this.event) return;
      ctx.font = "bold 28px monospace";
      ctx.fillStyle = UI_COLORS.accent;
      ctx.textAlign = "center";
      ctx.fillText(this.event.title, w / 2, 60);
      ctx.font = "14px monospace";
      ctx.fillStyle = UI_COLORS.text;
      this.wrapText(ctx, this.event.description, w / 2, 110, 500, 20);
      if (this.result) {
        ctx.font = "bold 16px monospace";
        ctx.fillStyle = UI_COLORS.success;
        ctx.textAlign = "center";
        this.wrapText(ctx, this.result, w / 2, this.renderer.height / 2, 400, 22);
        ctx.font = "12px monospace";
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.fillText("Click to continue", w / 2, this.renderer.height - 50);
      } else {
        const bounds = this.getChoiceBounds();
        for (let i = 0; i < bounds.length; i++) {
          const b = bounds[i];
          const choice = b.choice;
          const isHover = this.hoverChoice === i;
          const canChoose = this.meetsRequirement(choice);
          ctx.fillStyle = isHover ? UI_COLORS.panel : UI_COLORS.bgLight;
          ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.strokeStyle = canChoose ? isHover ? UI_COLORS.accent : UI_COLORS.panelBorder : "#555";
          ctx.lineWidth = isHover ? 2 : 1;
          ctx.strokeRect(b.x, b.y, b.w, b.h);
          ctx.font = "13px monospace";
          ctx.fillStyle = canChoose ? UI_COLORS.text : UI_COLORS.textDim;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(choice.text, b.x + b.w / 2, b.y + b.h / 2);
        }
      }
    }
    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
      const words = text.split(" ");
      let line = "";
      let lineNum = 0;
      for (const word of words) {
        const test = line + (line ? " " : "") + word;
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
  };

  // src/data/BossData.js
  var BOSSES = {
    floor5: {
      id: "floor5",
      name: "The Dark Bishop",
      title: "Guardian of the Midgame",
      description: "A powerful bishop commands an army of zealots. The board shifts as the battle unfolds.",
      boardSize: { cols: 8, rows: 8 },
      phases: [
        {
          name: "Phase 1: The Congregation",
          pieces: [
            { type: PIECE_TYPES.KING, col: 4, row: 0 },
            { type: PIECE_TYPES.BISHOP, col: 2, row: 0 },
            { type: PIECE_TYPES.BISHOP, col: 5, row: 0 },
            { type: PIECE_TYPES.BISHOP, col: 3, row: 1 },
            { type: PIECE_TYPES.PAWN, col: 1, row: 1 },
            { type: PIECE_TYPES.PAWN, col: 2, row: 1 },
            { type: PIECE_TYPES.PAWN, col: 4, row: 1 },
            { type: PIECE_TYPES.PAWN, col: 5, row: 1 },
            { type: PIECE_TYPES.PAWN, col: 6, row: 1 }
          ],
          terrain: [
            { col: 0, row: 3, terrain: TERRAIN_TYPES.VOID },
            { col: 7, row: 3, terrain: TERRAIN_TYPES.VOID },
            { col: 3, row: 3, terrain: TERRAIN_TYPES.ALTAR },
            { col: 4, row: 3, terrain: TERRAIN_TYPES.ALTAR }
          ]
        },
        {
          name: "Phase 2: Divine Wrath",
          addPieces: [
            { type: PIECE_TYPES.BISHOP, col: 0, row: 0 },
            { type: PIECE_TYPES.KNIGHT, col: 7, row: 0 }
          ],
          addTerrain: [
            { col: 1, row: 4, terrain: TERRAIN_TYPES.BRAMBLE },
            { col: 6, row: 4, terrain: TERRAIN_TYPES.BRAMBLE }
          ],
          triggerCondition: "piecesRemaining",
          triggerValue: 5
        }
      ],
      goldReward: 40,
      difficulty: 3
    },
    floor10: {
      id: "floor10",
      name: "The Ivory King",
      title: "Ruler of the Board",
      description: "The final challenge. A complete chess army stands against you, led by a king who refuses to fall.",
      boardSize: { cols: 10, rows: 10 },
      phases: [
        {
          name: "Phase 1: Royal Guard",
          pieces: [
            { type: PIECE_TYPES.KING, col: 5, row: 0 },
            { type: PIECE_TYPES.QUEEN, col: 4, row: 0 },
            { type: PIECE_TYPES.ROOK, col: 1, row: 0 },
            { type: PIECE_TYPES.ROOK, col: 8, row: 0 },
            { type: PIECE_TYPES.BISHOP, col: 3, row: 0 },
            { type: PIECE_TYPES.BISHOP, col: 6, row: 0 },
            { type: PIECE_TYPES.KNIGHT, col: 2, row: 0 },
            { type: PIECE_TYPES.KNIGHT, col: 7, row: 0 },
            { type: PIECE_TYPES.PAWN, col: 1, row: 1 },
            { type: PIECE_TYPES.PAWN, col: 2, row: 1 },
            { type: PIECE_TYPES.PAWN, col: 3, row: 1 },
            { type: PIECE_TYPES.PAWN, col: 4, row: 1 },
            { type: PIECE_TYPES.PAWN, col: 5, row: 1 },
            { type: PIECE_TYPES.PAWN, col: 6, row: 1 },
            { type: PIECE_TYPES.PAWN, col: 7, row: 1 },
            { type: PIECE_TYPES.PAWN, col: 8, row: 1 }
          ],
          terrain: [
            { col: 0, row: 4, terrain: TERRAIN_TYPES.VOID },
            { col: 9, row: 4, terrain: TERRAIN_TYPES.VOID },
            { col: 0, row: 5, terrain: TERRAIN_TYPES.VOID },
            { col: 9, row: 5, terrain: TERRAIN_TYPES.VOID },
            { col: 4, row: 4, terrain: TERRAIN_TYPES.FORTRESS },
            { col: 5, row: 4, terrain: TERRAIN_TYPES.FORTRESS }
          ]
        },
        {
          name: "Phase 2: Reinforcements",
          addPieces: [
            { type: PIECE_TYPES.KNIGHT, col: 0, row: 0 },
            { type: PIECE_TYPES.KNIGHT, col: 9, row: 0 },
            { type: PIECE_TYPES.PAWN, col: 0, row: 1 },
            { type: PIECE_TYPES.PAWN, col: 9, row: 1 }
          ],
          addTerrain: [
            { col: 2, row: 5, terrain: TERRAIN_TYPES.ICE },
            { col: 7, row: 5, terrain: TERRAIN_TYPES.ICE }
          ],
          removeTerrain: [
            { col: 4, row: 4 },
            { col: 5, row: 4 }
          ],
          triggerCondition: "piecesRemaining",
          triggerValue: 8
        },
        {
          name: "Phase 3: Last Stand",
          addPieces: [
            { type: PIECE_TYPES.QUEEN, col: 4, row: 1 }
          ],
          addTerrain: [
            { col: 3, row: 3, terrain: TERRAIN_TYPES.BRAMBLE },
            { col: 6, row: 3, terrain: TERRAIN_TYPES.BRAMBLE }
          ],
          triggerCondition: "piecesRemaining",
          triggerValue: 4
        }
      ],
      goldReward: 60,
      difficulty: 5
    }
  };
  function getBossForFloor(floor) {
    if (floor === 5) return BOSSES.floor5;
    if (floor === 10) return BOSSES.floor10;
    return null;
  }

  // src/states/BossIntroState.js
  var BossIntroState = class {
    constructor() {
      this.stateMachine = null;
      this.eventBus = null;
      this.renderer = null;
      this.runManager = null;
      this.bossData = null;
      this.floor = 0;
      this.fadeIn = 0;
      this.clickHandler = null;
      this.keyHandler = null;
    }
    enter(params = {}) {
      this.floor = params.floor || 5;
      this.bossData = getBossForFloor(this.floor);
      this.fadeIn = 0;
      this.clickHandler = () => this.startBoss();
      this.keyHandler = (data) => {
        if (data.code === "Enter" || data.code === "Space") this.startBoss();
      };
      this.eventBus.on("click", this.clickHandler);
      this.eventBus.on("keydown", this.keyHandler);
    }
    exit() {
      if (this.clickHandler) this.eventBus.off("click", this.clickHandler);
      if (this.keyHandler) this.eventBus.off("keydown", this.keyHandler);
    }
    startBoss() {
      if (!this.bossData) return;
      const phase1 = this.bossData.phases[0];
      const encounter = {
        name: this.bossData.name,
        cols: this.bossData.boardSize.cols,
        rows: this.bossData.boardSize.rows,
        enemyPieces: phase1.pieces,
        terrain: phase1.terrain || [],
        goldReward: this.bossData.goldReward,
        isBoss: true,
        difficulty: this.bossData.difficulty,
        bossData: this.bossData
      };
      const combatParams = this.runManager.prepareCombat(encounter);
      combatParams.isBoss = true;
      combatParams.bossData = this.bossData;
      this.stateMachine.change("combat", combatParams);
    }
    update(dt) {
      this.fadeIn = Math.min(1, this.fadeIn + dt * 2);
    }
    render(ctx) {
      if (!this.bossData) return;
      const w = this.renderer.width;
      const h = this.renderer.height;
      const alpha = this.fadeIn;
      ctx.globalAlpha = alpha;
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
      grad.addColorStop(0, "rgba(20, 10, 30, 0.8)");
      grad.addColorStop(1, "rgba(10, 5, 15, 1)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.font = "bold 14px monospace";
      ctx.fillStyle = UI_COLORS.danger;
      ctx.textAlign = "center";
      ctx.fillText(`FLOOR ${this.floor} BOSS`, w / 2, h / 2 - 80);
      ctx.font = "bold 42px monospace";
      ctx.fillStyle = UI_COLORS.accent;
      ctx.fillText(this.bossData.name, w / 2, h / 2 - 30);
      ctx.font = "italic 16px monospace";
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.fillText(this.bossData.title, w / 2, h / 2 + 10);
      ctx.font = "13px monospace";
      ctx.fillStyle = UI_COLORS.text;
      this.wrapText(ctx, this.bossData.description, w / 2, h / 2 + 50, 500, 18);
      ctx.font = "14px monospace";
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.fillText("Click to begin the fight", w / 2, h - 60);
      ctx.globalAlpha = 1;
    }
    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
      const words = text.split(" ");
      let line = "";
      let lineNum = 0;
      for (const word of words) {
        const test = line + (line ? " " : "") + word;
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
  };

  // src/states/VictoryState.js
  var VictoryState = class {
    constructor() {
      this.stateMachine = null;
      this.eventBus = null;
      this.renderer = null;
      this.runManager = null;
      this.stats = null;
      this.fadeIn = 0;
      this.clickHandler = null;
      this.keyHandler = null;
    }
    enter(params = {}) {
      this.stats = params.stats || (this.runManager ? this.runManager.stats : {});
      this.fadeIn = 0;
      this.clickHandler = () => this.returnToMenu();
      this.keyHandler = (data) => {
        if (data.code === "Enter" || data.code === "Space") this.returnToMenu();
      };
      this.eventBus.on("click", this.clickHandler);
      this.eventBus.on("keydown", this.keyHandler);
    }
    exit() {
      if (this.clickHandler) this.eventBus.off("click", this.clickHandler);
      if (this.keyHandler) this.eventBus.off("keydown", this.keyHandler);
    }
    returnToMenu() {
      this.stateMachine.change("mainMenu");
    }
    update(dt) {
      this.fadeIn = Math.min(1, this.fadeIn + dt);
    }
    render(ctx) {
      const w = this.renderer.width;
      const h = this.renderer.height;
      ctx.globalAlpha = this.fadeIn;
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.5);
      grad.addColorStop(0, "rgba(255, 215, 0, 0.1)");
      grad.addColorStop(1, "rgba(10, 10, 15, 1)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.font = "bold 52px monospace";
      ctx.fillStyle = UI_COLORS.gold;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("VICTORY", w / 2, h / 2 - 80);
      ctx.font = "18px monospace";
      ctx.fillStyle = UI_COLORS.text;
      ctx.fillText("You have conquered the board!", w / 2, h / 2 - 30);
      if (this.stats) {
        const lines = [
          `Battles Won: ${this.stats.battlesWon || 0}`,
          `Pieces Lost: ${this.stats.piecesLost || 0}`,
          `Pieces Recruited: ${this.stats.piecesRecruited || 0}`,
          `Floors Cleared: ${this.stats.floorsCleared || 0}`,
          `Gold Spent: ${this.stats.goldSpent || 0}`
        ];
        ctx.font = "14px monospace";
        ctx.fillStyle = UI_COLORS.textDim;
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], w / 2, h / 2 + 20 + i * 24);
        }
      }
      ctx.font = "14px monospace";
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.fillText("Click to return to menu", w / 2, h - 50);
      ctx.globalAlpha = 1;
    }
  };

  // src/states/GameOverState.js
  var GameOverState = class {
    constructor() {
      this.stateMachine = null;
      this.eventBus = null;
      this.renderer = null;
      this.runManager = null;
      this.stats = null;
      this.fadeIn = 0;
      this.clickHandler = null;
      this.keyHandler = null;
    }
    enter(params = {}) {
      this.stats = params.stats || (this.runManager ? this.runManager.stats : {});
      this.fadeIn = 0;
      this.clickHandler = () => {
        if (this.fadeIn > 0.5) this.stateMachine.change("mainMenu");
      };
      this.keyHandler = (data) => {
        if (data.code === "Enter" || data.code === "Space") this.stateMachine.change("mainMenu");
      };
      this.eventBus.on("click", this.clickHandler);
      this.eventBus.on("keydown", this.keyHandler);
    }
    exit() {
      if (this.clickHandler) this.eventBus.off("click", this.clickHandler);
      if (this.keyHandler) this.eventBus.off("keydown", this.keyHandler);
    }
    update(dt) {
      this.fadeIn = Math.min(1, this.fadeIn + dt);
    }
    render(ctx) {
      const w = this.renderer.width;
      const h = this.renderer.height;
      ctx.globalAlpha = this.fadeIn;
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.5);
      grad.addColorStop(0, "rgba(80, 10, 10, 0.6)");
      grad.addColorStop(1, "rgba(10, 5, 5, 1)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.font = "bold 52px monospace";
      ctx.fillStyle = UI_COLORS.danger;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GAME OVER", w / 2, h / 2 - 80);
      ctx.font = "18px monospace";
      ctx.fillStyle = UI_COLORS.text;
      ctx.fillText("Your king has fallen.", w / 2, h / 2 - 30);
      if (this.stats) {
        ctx.font = "14px monospace";
        ctx.fillStyle = UI_COLORS.textDim;
        const lines = [
          `Floor Reached: ${this.stats.floorsCleared || 0}`,
          `Battles Won: ${this.stats.battlesWon || 0}`,
          `Pieces Lost: ${this.stats.piecesLost || 0}`
        ];
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], w / 2, h / 2 + 20 + i * 24);
        }
      }
      ctx.font = "14px monospace";
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.fillText("Click to return to menu", w / 2, h - 50);
      ctx.globalAlpha = 1;
    }
  };

  // src/states/PauseState.js
  var PauseState = class {
    constructor() {
      this.stateMachine = null;
      this.eventBus = null;
      this.renderer = null;
      this.saveManager = null;
      this.runManager = null;
      this.buttons = [];
      this.clickHandler = null;
      this.moveHandler = null;
      this.keyHandler = null;
    }
    enter() {
      this.createButtons();
      this.clickHandler = (data) => {
        for (const btn of this.buttons) btn.handleClick(data.x, data.y);
      };
      this.moveHandler = (data) => {
        for (const btn of this.buttons) btn.handleMove(data.x, data.y);
      };
      this.keyHandler = (data) => {
        if (data.code === "Escape") this.stateMachine.pop();
      };
      this.eventBus.on("click", this.clickHandler);
      this.eventBus.on("mousemove", this.moveHandler);
      this.eventBus.on("keydown", this.keyHandler);
    }
    exit() {
      if (this.clickHandler) this.eventBus.off("click", this.clickHandler);
      if (this.moveHandler) this.eventBus.off("mousemove", this.moveHandler);
      if (this.keyHandler) this.eventBus.off("keydown", this.keyHandler);
    }
    createButtons() {
      const w = this.renderer.width;
      const h = this.renderer.height;
      const btnW = 180;
      const btnH = 40;
      const x = (w - btnW) / 2;
      const startY = h / 2 - 40;
      const gap = 12;
      this.buttons = [
        new Button(x, startY, btnW, btnH, "Resume", {
          onClick: () => this.stateMachine.pop()
        }),
        new Button(x, startY + btnH + gap, btnW, btnH, "Save Game", {
          onClick: () => this.saveGame()
        }),
        new Button(x, startY + 2 * (btnH + gap), btnW, btnH, "Quit to Menu", {
          color: UI_COLORS.panel,
          hoverColor: UI_COLORS.danger,
          onClick: () => this.stateMachine.change("mainMenu")
        })
      ];
    }
    saveGame() {
      if (this.saveManager && this.runManager) {
        this.saveManager.save(this.runManager.serialize());
      }
    }
    update(dt) {
    }
    render(ctx) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);
      ctx.font = "bold 32px monospace";
      ctx.fillStyle = UI_COLORS.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PAUSED", this.renderer.width / 2, this.renderer.height / 2 - 100);
      for (const btn of this.buttons) {
        btn.render(ctx);
      }
    }
  };

  // src/states/SettingsState.js
  var SettingsState = class {
    constructor() {
      this.stateMachine = null;
      this.eventBus = null;
      this.renderer = null;
      this.buttons = [];
      this.clickHandler = null;
      this.moveHandler = null;
      this.keyHandler = null;
    }
    enter() {
      this.createButtons();
      this.clickHandler = (data) => {
        for (const btn of this.buttons) btn.handleClick(data.x, data.y);
      };
      this.moveHandler = (data) => {
        for (const btn of this.buttons) btn.handleMove(data.x, data.y);
      };
      this.keyHandler = (data) => {
        if (data.code === "Escape") this.stateMachine.change("mainMenu");
      };
      this.eventBus.on("click", this.clickHandler);
      this.eventBus.on("mousemove", this.moveHandler);
      this.eventBus.on("keydown", this.keyHandler);
    }
    exit() {
      if (this.clickHandler) this.eventBus.off("click", this.clickHandler);
      if (this.moveHandler) this.eventBus.off("mousemove", this.moveHandler);
      if (this.keyHandler) this.eventBus.off("keydown", this.keyHandler);
    }
    createButtons() {
      const w = this.renderer.width;
      const h = this.renderer.height;
      const btnW = 180;
      const btnH = 40;
      const x = (w - btnW) / 2;
      this.buttons = [
        new Button(x, h - 80, btnW, btnH, "Back", {
          onClick: () => this.stateMachine.change("mainMenu")
        })
      ];
    }
    update(dt) {
    }
    render(ctx) {
      const w = this.renderer.width;
      const h = this.renderer.height;
      ctx.font = "bold 28px monospace";
      ctx.fillStyle = UI_COLORS.text;
      ctx.textAlign = "center";
      ctx.fillText("Settings", w / 2, 50);
      ctx.font = "14px monospace";
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.textAlign = "center";
      ctx.fillText("No configurable settings yet \u2014 all built-in defaults", w / 2, h / 2);
      for (const btn of this.buttons) {
        btn.render(ctx);
      }
    }
  };

  // src/core/Game.js
  var Game = class {
    constructor(canvas2) {
      this.canvas = canvas2;
      this.eventBus = new EventBus();
      this.renderer = new Renderer(canvas2);
      this.input = new InputManager(canvas2, this.eventBus);
      this.stateMachine = new StateMachine(this.eventBus);
      this.audioManager = new AudioManager(this.eventBus);
      this.saveManager = new SaveManager();
      this.runManager = new RunManager(this.eventBus);
      this.effects = new EffectsRenderer(this.eventBus);
      this.loop = new GameLoop(
        (dt) => this.update(dt),
        () => this.render()
      );
      this.setupStates();
      this.setupRunEvents();
    }
    setupStates() {
      const states = {
        mainMenu: new MainMenuState(),
        armySelect: new ArmySelectState(),
        map: new MapState(),
        combat: new CombatState(),
        shop: new ShopState(),
        event: new EventState(),
        bossIntro: new BossIntroState(),
        victory: new VictoryState(),
        gameOver: new GameOverState(),
        pause: new PauseState(),
        settings: new SettingsState()
      };
      for (const [name, state] of Object.entries(states)) {
        state.renderer = this.renderer;
        state.runManager = this.runManager;
        state.saveManager = this.saveManager;
        state.audioManager = this.audioManager;
        this.stateMachine.add(name, state);
      }
    }
    setupRunEvents() {
      this.eventBus.on("combatEnd", (data) => {
        if (data.winner === "player") {
          this.audioManager.playSFX("victory");
        } else {
          this.audioManager.playSFX("defeat");
        }
      });
      this.eventBus.on("combatFinished", (data) => {
        if (data.victory) {
          this.runManager.onBattleWon(data);
          this.saveManager.save(this.runManager.serialize());
          this.stateMachine.change("map");
        } else {
          this.runManager.onBattleLost();
        }
      });
      this.eventBus.on("runEnded", (data) => {
        this.saveManager.deleteSave();
        if (data.victory) {
          this.stateMachine.change("victory", { stats: data.stats });
        } else {
          this.stateMachine.change("gameOver", { stats: data.stats });
        }
      });
    }
    start() {
      this.stateMachine.change("mainMenu");
      this.loop.start();
    }
    update(dt) {
      this.stateMachine.update(dt);
      this.effects.update(dt);
    }
    render() {
      this.renderer.clear();
      const ctx = this.renderer.context;
      this.stateMachine.render(ctx);
      this.effects.render(ctx);
    }
  };

  // src/main.js
  var canvas = document.getElementById("game-canvas");
  var game = new Game(canvas);
  window.game = game;
  game.start();
})();
