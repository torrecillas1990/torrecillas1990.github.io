
const TILE_SIZE = 48;
const WORLD_SCALE_3D = 2.6;
const WORLD_TILES = 140;
const HALF_WORLD = WORLD_TILES / 2;
const WATER_SURFACE_Y = -0.22;
const SWIM_START_DEPTH = 1.28;
const SWIM_EXIT_DEPTH = 1.05;
const DIVE_MIN_DEPTH = 2.6;
const DUNGEON_Y_OFFSET = -60;
const SAVE_STORAGE_KEY = 'aethelgard_black_cauldron_save_v4';

let activeTheme = AETHELGARD_THEME;

const BIOMES = new Proxy({}, {
    get(_, prop) { return activeTheme.biomes[prop]; },
    ownKeys() { return Reflect.ownKeys(activeTheme.biomes); },
    getOwnPropertyDescriptor(_, prop) { return Reflect.getOwnPropertyDescriptor(activeTheme.biomes, prop); }
});
const pointsOfInterest = new Proxy([], {
    get(_, prop) { return Reflect.get(activeTheme.pointsOfInterest, prop); }
});
const DUNGEONS_DEF = new Proxy([], {
    get(_, prop) { return Reflect.get(activeTheme.dungeons, prop); }
});
const DUNGEONS = DUNGEONS_DEF;
const WEAPONS_CATALOG = new Proxy({}, {
    get(_, prop) { return activeTheme.weapons[prop]; }
});
const POTIONS_CATALOG = new Proxy({}, {
    get(_, prop) { return activeTheme.potions[prop]; }
});
const SPELLS_CATALOG = new Proxy([], {
    get(_, prop) { return Reflect.get(activeTheme.spells, prop); }
});

const ART_STYLES_META = {
    cgi1985: {
        label: 'CGI 1985',
        fullName: 'CGI Fantasía Oscura 1985',
        desc: 'Iluminación dramática púrpura y esmeralda, materiales PBR con relieve y niebla volumétrica.'
    },
    toon: {
        label: 'Cel-Shading',
        fullName: 'Cel-Shading Anime (Toon)',
        desc: 'Sombreado por bandas estilizadas, contornos dibujados a tinta y colores vibrantes.'
    },
    oil: {
        label: 'Óleo / Gouache',
        fullName: 'Pintura al Óleo Clásica',
        desc: 'Pinceladas pictóricas ricas, luz dorada de cuento y contraste cálido.'
    },
    ps1: {
        label: 'Retro PS1',
        fullName: 'Retro 3D Baja Resolución (PS1)',
        desc: 'Renderizado pixelado nítido, sombreado poligonal facetado y nostalgia de los 90.'
    }
};

const gameSettings = {
    artStyle: 'cgi1985',
    mouseSensitivity: 1.0,
    fov: 50,
    camDist: 21,
    exposure: 1.15,
    fogMultiplier: 1.0,
    timeSpeedMult: 1.0,
    pointerLock: true,
    invertY: false,
    shadows: true,
    particles: true,
    vignette: true,
    highDpi: true
};

const player = {
    x: 0, y: 0,
    y3D: 0.4, vy3D: 0,
    gravity: -34.0, jumpForce: 13.6,
    isGrounded: true, jumpCount: 0, maxJumps: 2,
    jumpStretch: 0, landSquash: 0,
    speed: 228, sprintMultiplier: 1.62,
    hp: 100, maxHp: 100,
    stamina: 100, maxStamina: 100,
    mana: 100, maxMana: 100,
    oxygen: 100, maxOxygen: 100,
    lowOxygenWarned: false, drowningToastCooldown: 0, bubbleCooldown: 0,
    waterDepth: 0, isSwimming: false, isDiving: false, wasInWater: false,
    swimPitch: 0, swimFrame: 0, rippleCooldown: 0,
    pilotingBoat: null, nearbyBoat: null,
    level: 1, xp: 0, xpToNext: 100, spendableXp: 40,
    gold: 90, kills: 0,
    rotationY: Math.PI,
    walkFrame: 0,
    torchOn: true,
    attackTimer: 0, attackCooldown: 0, comboIndex: 0, hurtTimer: 0,
    speedBuffTimer: 0, magicBuffTimer: 0, aegisTimer: 0, undineBreathTimer: 0,
    potions: { health: 3, stamina: 2, magic: 2 },
    ownedWeapons: ['apprentice_sword'],
    equippedWeapon: 'apprentice_sword',
    unlockedSpells: ['emerald_bolt', 'undine_breath', 'arcane_light', 'cauldron_storm'],
    spellLevels: {
        emerald_bolt: 1, undine_breath: 1, arcane_light: 1, cauldron_storm: 1,
        dallben_aegis: 1, morva_nova: 1, frost_prison: 1,
        horned_judgment: 1, cauldron_cataclysm: 1
    },
    spellCooldowns: {},
    equippedSpellId: 'emerald_bolt',
    heldObject: null,
    relics: [activeTheme.initialRelic],
    visitedBiomes: new Set([activeTheme.defaultBiomeId]),
    logs: [activeTheme.initialLog],
    waypoint: { ...activeTheme.initialWaypoint }
};

function setGameTheme(theme) {
    if (!theme) return;
    activeTheme = theme;

    if (theme.title) document.title = theme.title;
    player.relics = [theme.initialRelic];
    player.visitedBiomes = new Set([theme.defaultBiomeId]);
    player.logs = [theme.initialLog];
    player.waypoint = { ...theme.initialWaypoint };
}

const worldState = {
    timeOfDay: 20.5,
    dayCount: 1,
    weather: 'CLEAR',
    nearbyPOI: null,
    nearbyDungeonPortal: null,
    activeDungeon: null,
    camYaw: 0,
    camPitch: 0.42,
    camDist: 21,
    paused: false
};

const mapState = {
    zoom: 1.0,
    panX: 0,
    panY: 0,
    oracleVision: true,
    showLabels: true,
    dragging: false,
    movedDuringDrag: false,
    dragStartX: 0,
    dragStartY: 0
};

const mapViewConfig = mapState;