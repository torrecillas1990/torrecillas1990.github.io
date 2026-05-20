// ============================================================================
// 1. MOTOR DE AUDIO SINTETIZADO (8-BIT WEB AUDIO API)
// ============================================================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let bjpInterval;
let musicaEncendida = true;

function playTone(freq, type, duration) {
    try {
        let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
        osc.type = type; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch(e){}
}

function reproducirMusica(tipo) {
    clearInterval(bjpInterval);
    if (!musicaEncendida) return;
    
    let tipoAHR = tipo || (modo === 'batalla' ? 'batalla' : 'exploracion');
    
    if(tipoAHR === 'exploracion') {
        let notas = [261, 293, 329, 349, 392, 349, 329, 293];
        let i = 0;
        bjpInterval = setInterval(() => {
            playTone(notas[i%notas.length], 'square', 0.2);
            i++;
        }, 250);
    } else if (tipoAHR === 'batalla') {
        let i = 0;
        bjpInterval = setInterval(() => {
            playTone(i % 2 === 0 ? 150 : 110, 'sawtooth', 0.15);
            i++;
        }, 180);
    }
}

// ============================================================================
// 2. CONFIGURACIÓN DE BLOQUES Y GENERACIÓN GRÁFICA PROCEDURAL
// ============================================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const TILE_SIZE = 32;

const assets = {
    01: crearTile('#558b2f', '#33691e', 'hierba'),
    02: crearTile('#9ccc65', '#aed581', 'suelo'),
    10: crearTile('#78909c', '#37474f', 'muro'),
    11: crearTile('#b71c1c', '#d32f2f', 'tejado'),
    12: crearTile('#a1887f', '#8d6e63', 'pared'),
    20: crearTile('#2e7d32', '#1b5e20', 'arbol'),
    21: crearTile('#90a4ae', '#546e7a', 'piedra'),
    30: crearTile('#ffe0b2', '#f5cc96', 'parquet'),
    31: crearTile('#e53935', '#b71c1c', 'alfombra'),
    32: crearTile('#b3e5fc', '#81d4fa', 'baldosa'),
    40: crearTile('#8d6e63', '#4e342e', 'cueva'),
    50: crearTile('#0288d1', '#01579b', 'agua'),
    60: crearTile('#ece2c6', '#a2574f', 'orilla'),
    70: crearTile('#5d4037', '#3e2723', 'puerta'),
    71: crearTile('#ffb74d', '#e53935', 'alfombra_salida'),
    72: crearTile('#9e9e9e', '#2196f3', 'ordenador'),
    73: crearTile('#43a047', '#ffe082', 'tienda'), // <--- Mostrador verde y caja registradora dorada
    74: crearTile('#e53935', '#ffffff', 'objeto_suelo'), // <--- Objeto recogible
	75: crearTile('#f8bbd0', '#e91e63', 'curacion'), // <--- Máquina rosa con cruz
    80: crearTile('#e0f7fa', '#b2ebf2', 'hielo'),
    81: crearTile('#ffb300', '#ff8f00', 'cinta_derecha'),
    82: crearTile('#ffb300', '#ff8f00', 'cinta_izquierda'),
    83: crearTile('#ffb300', '#ff8f00', 'cinta_arriba'),
    84: crearTile('#ffb300', '#ff8f00', 'cinta_abajo'),
    85: crearTile('#01579b', '#0091ea', 'remolino_agua'),
    86: crearTile('#d7ccc8', '#a1887f', 'remolino_tierra'),
    100: crearTile('#5d4037', '#3e2723', 'puerta'),
    101: crearTile('#5d4037', '#3e2723', 'alfombra_salida'),
    102: crearTile('#5d4037', '#3e2723', 'puerta'),
    103: crearTile('#5d4037', '#3e2723', 'alfombra_salida'),
    104: crearTile('#5d4037', '#3e2723', 'puerta'),

    player: crearSpriteJugador('#ffb74d', '#e53935'),
    playerSurf: crearSpriteSurf(),
    playerHielo: crearSpriteJugador('#e0f7fa', '#0288d1'),
    pkmnJugador: crearSpritePokemon('#2196f3'), 
    pkmnEnemigo: crearSpritePokemon('#f44336')                     
};

function crearTile(col1, col2, tipo) {
    let c = document.createElement('canvas'); c.width = TILE_SIZE; c.height = TILE_SIZE;
    let cx = c.getContext('2d');
    cx.fillStyle = col1; cx.fillRect(0,0,TILE_SIZE,TILE_SIZE);
    cx.fillStyle = col2;
    if(tipo==='hierba') { for(let i=0; i<4; i++) cx.fillRect(i*8+2, 4, 3, 24); }
    if(tipo==='muro') { cx.fillRect(0,0,TILE_SIZE,4); cx.fillRect(8,0,4,14); }
    if(tipo==='tejado') { cx.beginPath(); cx.moveTo(0, TILE_SIZE); cx.lineTo(TILE_SIZE/2, 0); cx.lineTo(TILE_SIZE, TILE_SIZE); cx.fill(); }
    if(tipo==='arbol') { cx.beginPath(); cx.arc(TILE_SIZE/2, TILE_SIZE/2, 12, 0, Math.PI*2); cx.fill(); }
    if(tipo==='piedra') { cx.fillRect(4, 4, TILE_SIZE-8, TILE_SIZE-8); cx.fillStyle='#cfd8dc'; cx.fillRect(6,6,6,6); }
    if(tipo==='parquet') { cx.fillRect(0, 0, TILE_SIZE, 2); cx.fillRect(0, 16, TILE_SIZE, 2); }
    if(tipo==='baldosa') { cx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE); }
    if(tipo==='cueva') { cx.fillRect(2, 2, 6, 6); cx.fillRect(18, 20, 8, 4); }
    if(tipo==='agua') { cx.fillRect(2, 8, 12, 2); cx.fillRect(16, 22, 10, 2); }
    if(tipo==='orilla') { cx.fillRect(6,6,4,4); cx.fillRect(20,18,4,4); cx.fillRect(8,16,4,4); cx.fillRect(20,5,4,4); }
    if(tipo==='puerta') { cx.fillRect(4, 4, TILE_SIZE-8, TILE_SIZE); cx.fillStyle='#ffd54f'; cx.fillRect(6,16,4,4); }
    if(tipo==='alfombra_salida') { cx.fillRect(2, 16, TILE_SIZE-4, TILE_SIZE-16); }
    if(tipo==='hielo') { cx.strokeStyle = '#ffffff'; cx.beginPath(); cx.moveTo(4,4); cx.lineTo(28,28); cx.stroke(); }
    if(tipo==='cinta_derecha') { cx.beginPath(); cx.moveTo(8, 8); cx.lineTo(24, 16); cx.lineTo(8, 24); cx.fill(); }
    if(tipo==='cinta_izquierda') { cx.beginPath(); cx.moveTo(24, 8); cx.lineTo(8, 16); cx.lineTo(24, 24); cx.fill(); }
    if(tipo==='cinta_arriba') { cx.beginPath(); cx.moveTo(8, 24); cx.lineTo(16, 8); cx.lineTo(24, 24); cx.fill(); }
    if(tipo==='cinta_abajo') { cx.beginPath(); cx.moveTo(8, 8); cx.lineTo(16, 24); cx.lineTo(24, 8); cx.fill(); }
    if(tipo==='remolino_agua') { cx.beginPath(); cx.arc(TILE_SIZE/2, TILE_SIZE/2, 10, 0, Math.PI, true); cx.stroke(); }
    if(tipo==='remolino_tierra') { cx.fillRect(6,6,4,4); cx.fillRect(20,18,5,5); }
    if(tipo==='ordenador') {
        cx.fillStyle = '#616161'; cx.fillRect(2, 18, TILE_SIZE-4, 12);
        cx.fillStyle = col1; cx.fillRect(4, 2, TILE_SIZE-8, 16);
        cx.fillStyle = col2; cx.fillRect(7, 4, TILE_SIZE-14, 11);
        cx.fillStyle = '#fff'; cx.fillRect(9, 6, 2, 2);
    }
	if(tipo==='tienda') {
		cx.fillStyle = col1; cx.fillRect(0, 14, TILE_SIZE, 18); // Mostrador base
		cx.fillStyle = col2; cx.fillRect(6, 4, 12, 10); // Caja registradora
		cx.fillStyle = '#b71c1c'; cx.fillRect(14, 8, 4, 4); // Botón de la caja
	}
    if(tipo === 'objeto_suelo') {
        // Fondo: Suelo base
        cx.fillStyle = '#9ccc65'; cx.fillRect(0,0,TILE_SIZE,TILE_SIZE);
        // La Poké Ball tirada en el centro
        let bx = TILE_SIZE/2; let by = TILE_SIZE/2 + 2;
        cx.fillStyle = col1; cx.beginPath(); cx.arc(bx, by, 6, Math.PI, 0); cx.fill();
        cx.fillStyle = col2; cx.beginPath(); cx.arc(bx, by, 6, 0, Math.PI); cx.fill();
        cx.lineWidth = 1; cx.strokeStyle = '#000';
        cx.beginPath(); cx.arc(bx, by, 6, 0, Math.PI*2); cx.stroke();
        cx.beginPath(); cx.moveTo(bx-6, by); cx.lineTo(bx+6, by); cx.stroke();
        cx.fillStyle = '#000'; cx.beginPath(); cx.arc(bx, by, 2, 0, Math.PI*2); cx.fill();
        cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(bx, by, 1, 0, Math.PI*2); cx.fill();
    }
	if(tipo === 'curacion') {
        cx.fillStyle = col1; cx.fillRect(0, 4, TILE_SIZE, TILE_SIZE-4); // Base de la máquina
        cx.fillStyle = col2; cx.fillRect(TILE_SIZE/2 - 3, 10, 6, 14); // Cruz vertical
        cx.fillRect(TILE_SIZE/2 - 7, 14, 14, 6); // Cruz horizontal
        cx.fillStyle = '#fff'; cx.fillRect(4, 6, 24, 2); // Brillo superior
    }
    return c;
}

function crearSpriteJugador(colCabeza, colCuerpo) {
    let c = document.createElement('canvas'); c.width = TILE_SIZE; c.height = TILE_SIZE;
    let cx = c.getContext('2d');
    cx.fillStyle = colCabeza; cx.fillRect(8, 4, 16, 12); 
    cx.fillStyle = colCuerpo; cx.fillRect(6, 16, 20, 14); 
    cx.fillStyle = '#000'; cx.fillRect(10, 8, 3, 3); cx.fillRect(19, 8, 3, 3); 
    return c;
}

function crearSpriteSurf() {
    let c = document.createElement('canvas'); c.width = TILE_SIZE; c.height = TILE_SIZE;
    let cx = c.getContext('2d');
    cx.fillStyle = '#26a69a'; cx.beginPath(); cx.arc(TILE_SIZE/2, TILE_SIZE/2+4, 12, 0, Math.PI*2); cx.fill();
    cx.fillStyle = '#ffe082'; cx.fillRect(12, 4, 8, 12);
    return c;
}

function crearSpritePokemon(color) {
    let c = document.createElement('canvas'); c.width = 64; c.height = 64;
    let cx = c.getContext('2d');
    cx.fillStyle = color; cx.beginPath(); cx.arc(32, 32, 24, 0, Math.PI*2); cx.fill(); 
    cx.fillStyle = '#000'; cx.beginPath(); ctx.arc(24, 24, 4, 0, Math.PI*2); cx.arc(40, 24, 4, 0, Math.PI*2); cx.fill(); 
    return c;
}

function puedeSurfear() {
    // Busca en todo el equipo si hay algún Pokémon de tipo AGUA
    return equipo.some(pkmn => pkmn.tipo === 'AGUA');
}

// ============================================================================
// 3. VARIABLES DE ESTADO Y ALMACENAMIENTO GLOBAL
// ============================================================================
let mapaActual = 'pueblo';
let puntoReaparicion = { mapa: 'pueblo', x: 3, y: 4 };
let modo = 'exploracion';
const teclas = {};

const CAMERA = {
    x: 0,
    y: 0,
    width: 512,  // Tu tamaño de canvas
    height: 512
};

// --- SUSTITUYE TU OBJETO JUGADOR ACTUAL ---
const jugador = {
    gridX: 2, gridY: 2,      // Posición lógica (tiles)
    pixelX: 2 * TILE_SIZE,   // Posición visual (píxeles)
    pixelY: 2 * TILE_SIZE,
    moviendo: false,         // ¿Está en medio de una animación?
    velocidadAnim: 8,        // Frames que dura el paso (a menor número, más rápido)
    frameActual: 0,
    dirX: 0, dirY: 0,
    estadoEstilo: 'normal',
    anguloGiro: 0
};

const ESPECIES_POKEDEX = ['Charmander', 'Charmeleon', 'Bulbasaur', 'Ivysaur', 'Squirtle', 'Wartortle', 'Pidgey', 'Pikachu'];
let especiesAvistadas = { 'Charmander': true };

// --- NUEVA TABLA DE EFECTIVIDADES ELEMENTALES ---
const TABLA_TIPOS = {
    FUEGO:    { PLANTA: 2.0, AGUA: 0.5, FUEGO: 0.5 },
    AGUA:     { FUEGO: 2.0, PLANTA: 0.5, AGUA: 0.5 },
    PLANTA:   { AGUA: 2.0, FUEGO: 0.5, PLANTA: 0.5, VOLADOR: 0.5 },
    ELECTRICO:{ VOLADOR: 2.0, AGUA: 2.0, ELECTRICO: 0.5, PLANTA: 0.5 },
    VOLADOR:  { PLANTA: 2.0, ELECTRICO: 0.5 }
};

// --- NUEVO: DICCIONARIO GLOBAL DE ATAQUES ---
const DICCIONARIO_ATAQUES = {
    'Arañazo':      { n:'Arañazo', d:12, tipo:'NORMAL', pp:35, ppMax:35 },
    'Gruñido':      { n:'Gruñido', d:5, tipo:'NORMAL', pp:40, ppMax:40 }, // Haremos que haga daño leve por ahora
    'Lanzallamas':  { n:'Lanzallamas', d:35, tipo:'FUEGO', pp:15, ppMax:15 },
    'Hoja Afilada': { n:'Hoja Afilada', d:25, tipo:'PLANTA', pp:15, ppMax:15 },
    'Pistola Agua': { n:'Pistola Agua', d:20, tipo:'AGUA', pp:20, ppMax:20 },
    'Rayo':         { n:'Rayo', d:30, tipo:'ELECTRICO', pp:15, ppMax:15 }
};

// --- NUEVO: MOVIMIENTOS APRENDIDOS POR NIVEL ---
const MOVIMIENTOS_POR_NIVEL = {
    'Charmander': { 6: 'Lanzallamas' }, 
    'Charmeleon': { 6: 'Lanzallamas' }, // Por si evoluciona y lo aprende a la vez
    'Bulbasaur':  { 6: 'Hoja Afilada' },
    'Squirtle':   { 6: 'Pistola Agua' }
};

// --- MODIFICACIÓN DEL EQUIPO INICIAL (Para forzar el límite de 4 ataques) ---
let equipo = [
    { 
        nombre: 'Charmander', tipo: 'FUEGO', estado: 'OK',
        hpMax: 50, hp: 50, nivel: 5, exp: 0, 
        ataques: [
            {n:'Placaje', d:10, tipo:'NORMAL', pp:35, ppMax:35}, 
            {n:'Arañazo', d:12, tipo:'NORMAL', pp:35, ppMax:35},
            {n:'Gruñido', d:5,  tipo:'NORMAL', pp:40, ppMax:40},
            {n:'Ascuas',  d:18, tipo:'FUEGO',  pp:25, ppMax:25}
        ] 
    },
	{ 
        nombre: 'Squirtle', tipo: 'AGUA', estado: 'OK',
        hpMax: 50, hp: 50, nivel: 5, exp: 0, 
        ataques: [
            {n:'Placaje', d:10, tipo:'NORMAL', pp:35, ppMax:35}, 
            {n:'Arañazo', d:12, tipo:'NORMAL', pp:35, ppMax:35},
            {n:'Gruñido', d:5,  tipo:'NORMAL', pp:40, ppMax:40},
            {n:'Pistola Agua',  d:20, tipo:'AGUA',  pp:20, ppMax:20}
        ] 
    }
];

// Variables temporales para pausar la secuencia de victoria
let movimientoPendiente = null;
let pokemonAprendiendo = null;

const ENEMIGOS_SALVAJES = [
    { 
        nombre: 'Bulbasaur', tipo: 'PLANTA', estado: 'OK', hpMax: 50, hp: 50, nivel: 5, 
        ataques: [{n:'Látigo Cepa', d:14, tipo:'PLANTA', pp:25, ppMax:25}] 
    },
    { 
        nombre: 'Squirtle', tipo: 'AGUA', estado: 'OK', hpMax: 50, hp: 50, nivel: 5, 
        ataques: [{n:'Burbuja', d:14, tipo:'AGUA', pp:25, ppMax:25}] 
    },
    { 
        nombre: 'Pidgey', tipo: 'VOLADOR', estado: 'OK', hpMax: 30, hp: 30, nivel: 3, 
        ataques: [{n:'Tornado', d:10, tipo:'VOLADOR', pp:35, ppMax:35}] 
    },
    { 
        nombre: 'Pikachu', tipo: 'ELECTRICO', estado: 'OK', hpMax: 35, hp: 35, nivel: 4, 
        ataques: [{n:'Impactrueno', d:16, tipo:'ELECTRICO', pp:20, ppMax:20}] 
    }
];

let caja = [];
let miPokemon = equipo[0];
// --- INVENTARIO INTEGRADO CON CONSUMIBLES ELEMENTALES ---
let inventario = { 
    pociones: 5, 
    bolas: 5, 
    curaQuemadura: 2,  // Cura el estado 'QUEMADO'
    antiparaliz: 2,    // Cura el estado 'PARALIZADO'
    elixir: 1          // Restaura al máximo los PP de todos los ataques del activo
};

// --- NUEVO SISTEMA DE EVOLUCIONES DE ESPECIES ---
const REGLAS_EVOLUCION = {
    'Charmander': { nivel: 6, siguiente: 'Charmeleon', hpBonus: 15 },
    'Bulbasaur':  { nivel: 6, siguiente: 'Ivysaur', hpBonus: 15 },
    'Squirtle':   { nivel: 6, siguiente: 'Wartortle', hpBonus: 15 }
};

// --- ECONOMÍA Y CATÁLOGO DE LA TIENDA ---
let monedero = 300; // Dinero inicial del jugador

const CATALOGO_TIENDA = [
    { id: 'pociones',      nombre: 'Poción',          precio: 200 },
    { id: 'bolas',         nombre: 'Bola Captura',    precio: 200 },
    { id: 'curaQuemadura', nombre: 'Cura Quemadura',  precio: 150 },
    { id: 'antiparaliz',   nombre: 'Antiparálisis',   precio: 100 },
    { id: 'elixir',        nombre: 'Elixir Máximo',   precio: 500 }
];

let enemigoActual = null; 
let turnoBloqueado = false;
let animacionCaptura = false;

// --- BASE DE DATOS DE NPCs POR MAPA ---
const NPCS = {
    exterior: [
        {
            id: 'entrenador_chano',
            esEntrenador: true,
            derrotado: false,
            direccion: 'abajo',  // Hacia dónde mira por defecto
            rangoVision: 3,      // Cuántos tiles de distancia controla
            gridX: 9, gridY: 1,  // Posición en el mapa
            colCabeza: '#ffb300', colCuerpo: '#0288d1', // Gorra amarilla, shorts azules
            dialogo: ["¡Nuestras miradas se han cruzado!", "¡Eso significa que debemos combatir!"],
			equipoRival: [
				{ 
					nombre: 'Pikachu', tipo: 'ELECTRICO', estado: 'OK', hpMax: 35, hp: 35, nivel: 4, 
					ataques: [{n:'Impactrueno', d:14, tipo:'ELECTRICO', pp:20, ppMax:20}] 
				},
				{ 
					nombre: 'Squirtle', tipo: 'AGUA', estado: 'OK', hpMax: 40, hp: 40, nivel: 5, 
					ataques: [{n:'Burbuja', d:12, tipo:'AGUA', pp:25, ppMax:25}] 
				}
			]
        },
        {
            id: 'anciano_sabio',
            gridX: 7, gridY: 3,
            colCabeza: '#cfd8dc', colCuerpo: '#37474f',
            dialogo: [
                "¡Hola, joven aspirante!",
                "Cuidado con la pista de hielo del norte, ¡es súper resbaladiza!",
                "Si te quedas atrapado, deslízate hacia una roca sólida para frenar."
            ]
        }
    ],
    interior_casa: [
        {
            id: 'mama_pkmn',
            gridX: 4, gridY: 4,
            colCabeza: '#ff8a80', colCuerpo: '#c2185b',
            dialogo: [
                "¡Hola, cariño! Qué casa tan bonita estás programando.",
                "Recuerda que puedes usar mi ORDENADOR para gestionar tus criaturas.",
                "Y no olvides GUARDAR la partida en el menú START antes de salir."
            ]
        }
    ]
};

// --- SISTEMA DE RECOLECCIÓN DE OBJETOS ---
let objetosRecogidos = {}; // Guarda un registro de { "mapa_x_y": true }

function recogerObjetoSuelo(gridX, gridY) {
    // Generar una clave única para saber qué objeto del mundo es este
    let claveUnica = `${mapaActual}_${gridX}_${gridY}`;
    
    // Si por algún motivo ya está recogido, abortamos
    if (objetosRecogidos[claveUnica]) return; 

    // Pool de posibles premios (se puede añadir elixir, etc)
    let posibles = ['pociones', 'bolas', 'pociones', 'bolas', 'curaQuemadura', 'antiparaliz'];
    let premio = posibles[Math.floor(Math.random() * posibles.length)];

    // Añadir a la mochila y marcar como recogido
    inventario[premio]++;
    objetosRecogidos[claveUnica] = true;
    
    // Borrar el objeto físicamente del mapa en tiempo real (lo cambiamos por suelo ID 02)
    MAPAS[mapaActual][gridY][gridX] = 02; 
    
    // Efecto de sonido del mítico "jingle" de objeto
    playTone(600, 'square', 0.1);
    setTimeout(() => playTone(800, 'square', 0.15), 100);

    // Lanzar diálogo de notificación
    let nombreFormateado = premio.replace(/([A-Z])/g, ' $1').toUpperCase();
    iniciarDialogo([`¡Encontraste ${nombreFormateado}!`, `Lo has guardado en el bolsillo de tu MOCHILA.`]);
}

// Variables para segmentar las reglas de la batalla en curso
let tipoBatalla = 'salvaje'; // Puede ser 'salvaje' o 'entrenador'
let entrenadorActual = null;
let indiceEnemigoActual = 0; // Rastrea el Pokémon actual del rival

// Variables de control de flujo del texto
let dialogoActual = null;
let indiceLineaDialogo = 0;

// ============================================================================
// 4. MOTOR DE FÍSICAS, MOVIMIENTO Y COLISIONES
// ============================================================================
function obtenerPropiedadesBloque(id) {
    return {
        esSolidoNonatural:   (id >= 10 && id <= 19),
        esSolidoNatural:     (id >= 20 && id <= 29),
        tieneEncuentros:     id === 01 || id === 40 || id === 50,
        esAgua:              (id >= 50 && id <= 59) || id === 85,
        esTransicionAgua:    (id >= 60 && id <= 69),
        esInteractivo:       (id >= 70 && id <= 79),
        esOrdenador:         (id === 72),
        esTienda:            (id === 73),
		esObjetoSuelo:       (id === 74),
		esCuracion:          (id === 75),
        esHielo:             (id === 80),
        esCintaDerecha:      (id === 81),
        esCintaIzquierda:    (id === 82),
        esCintaArriba:       (id === 83),
        esCintaAbajo:        (id === 84),
        esRemolinoAgua:      (id === 85),
        esRemolinoTierra:    (id === 86),
        esPortal:            (id >= 100 && id <= 199)
    };
}

function comprobarColision(futuroX, futuroY) {
    let margen = 4;
    let esquinas = [
        {x: futuroX + margen, y: futuroY + margen},
        {x: futuroX + TILE_SIZE - margen, y: futuroY + margen},
        {x: futuroX + margen, y: futuroY + TILE_SIZE - margen},
        {x: futuroX + TILE_SIZE - margen, y: futuroY + TILE_SIZE - margen}
    ];

    // 1. Colisión con la matriz física del mapa
    let mapa = MAPAS[mapaActual];
    for (let e of esquinas) {
        let gridX = Math.floor(e.x / TILE_SIZE);
        let gridY = Math.floor(e.y / TILE_SIZE);
        
        if (!mapa[gridY] || mapa[gridY][gridX] === undefined) return true;
        
        let props = obtenerPropiedadesBloque(mapa[gridY][gridX]);
		if (props.esSolidoNonatural || props.esSolidoNatural || props.esOrdenador || props.esTienda || props.esCuracion) return true;
        if (props.esAgua && jugador.estadoEstilo === 'normal') return true;
    }

    // 2. NUEVO: Colisión con NPCs del mapa actual
    let npcsMapa = NPCS[mapaActual] || [];
    for (let npc of npcsMapa) {
        let jugadorGridX_Futuro = Math.floor((futuroX + TILE_SIZE / 2) / TILE_SIZE);
        let jugadorGridY_Futuro = Math.floor((futuroY + TILE_SIZE / 2) / TILE_SIZE);
        
        if (npc.gridX === jugadorGridX_Futuro && npc.gridY === jugadorGridY_Futuro) {
            return true; // Sólido, no puedes atravesar al NPC
        }
    }
    
    return false;
}

function actualizarMovimiento() {
    if (modo !== 'exploracion' || jugador.moviendo) return;

    let dirX = 0, dirY = 0;
    if (teclas['ArrowUp'])    dirY = -1;
    else if (teclas['ArrowDown'])  dirY = 1;
    else if (teclas['ArrowLeft'])  dirX = -1;
    else if (teclas['ArrowRight']) dirX = 1;
	
	// Bloqueo especial: Si estás en hielo, el motor de eventos es el que decide el movimiento
    // A menos que estés parado (dirX/Y == 0)
    if (dirX !== 0 || dirY !== 0) {
        let proximaX = jugador.gridX + dirX;
        let proximaY = jugador.gridY + dirY;

        if (comprobarColisionGrid(proximaX, proximaY) != true) {
            jugador.dirX = dirX;
            jugador.dirY = dirY;
            jugador.moviendo = true;
            jugador.frameActual = 0;
        }
    }
}

// Nueva versión de colisión lógica
function comprobarColisionGrid(gx, gy) {
    let mapa = MAPAS[mapaActual];
    // Seguridad: Si gx o gy salen de los límites, bloquea
    if (!mapa[gy] || mapa[gy][gx] === undefined) return true;
    
    let id = mapa[gy][gx];
    let props = obtenerPropiedadesBloque(id);
	
	// Si es agua, comprobamos si el jugador tiene un Pokémon de agua
    if (props.esAgua) {
        if (puedeSurfear()) {
            jugador.estadoEstilo = 'surf'; // Cambiamos el sprite a surf
            return false; // ¡Puedes pasar!
        } else {
            return true; // Es sólido, no tienes surf
        }
    }
    if (props.esSolidoNonatural || props.esSolidoNatural || props.esOrdenador || props.esTienda || props.esCuracion) return true;
    if (props.esAgua && jugador.estadoEstilo !== 'surf') return true; // Solo pasa si surfeas
    if (props.esHielo) return false;
    if (props.esCintaDerecha || props.esCintaIzquierda || props.esCintaArriba || props.esCintaAbajo) return false;
    if (props.esRemolinoAgua) return false;
    if (props.esRemolinoTierra) return false;
	
    // Si sales del hielo o del agua, vuelves al estado normal
    if (!props.esHielo && !props.esAgua) {
        jugador.estadoEstilo = 'normal';
    }
	
    // Colisión NPCs
    let npcs = NPCS[mapaActual] || [];
    if (npcs.some(n => n.gridX === gx && n.gridY === gy)) return true;

    return false;
}
function chequearEventosMapa() {
    let mapa = MAPAS[mapaActual];
    let bloqueActual = mapa[jugador.gridY][jugador.gridX];
    let props = obtenerPropiedadesBloque(bloqueActual);

    // 1. Efectos de Terreno (Pisar bloque)
    if (props.esHielo) {
        jugador.estadoEstilo = 'hielo';
        // Lógica de hielo: Deslizar automáticamente en la misma dirección
        // Solo si tenemos dirección acumulada
        if (jugador.dirX !== 0 || jugador.dirY !== 0) {
            //setTimeout(() => {
                // Forzamos movimiento en la misma dirección sin esperar input
                jugador.moviendo = true;
                // La animación se ejecutará en el siguiente frame del loop
            //}, 10); 
        }
    }

    if (props.esCintaDerecha) {jugador.dirX = 1; jugador.dirY = 0; jugador.moviendo = true; }
    if (props.esCintaIzquierda) {jugador.dirX = -1; jugador.dirY = 0; jugador.moviendo = true; }
	if (props.esCintaArriba) {jugador.dirX = 0; jugador.dirY = -1; jugador.moviendo = true; }
	if (props.esCintaAbajo) {jugador.dirX = 0; jugador.dirY = 1; jugador.moviendo = true; }
	
	if (props.esRemolinoAgua) {
		jugador.anguloGiro = 8;
		let ran = Math.random();
		console.log(ran);
		if (ran <= 0.25) jugador.dirX = 0; jugador.dirY = 1;
		if (ran > 0.25 && ran < 0.5) jugador.dirX = 1; jugador.dirY = 0;
		if (ran > 0.5 && ran < 0.75) jugador.dirX = 0; jugador.dirY = -1;
		if (ran > 0.75) jugador.dirX = -1; jugador.dirY = 0;
		jugador.moviendo = true; 
	}
	
	if (props.esRemolinoTierra) { jugador.velocidadAnim = 16; } else { jugador.velocidadAnim = 8; }

    // 2. Eventos estándar
    if (props.tieneEncuentros && Math.random() < 0.1) iniciarBatalla();
    if (props.esObjetoSuelo) recogerObjetoSuelo(jugador.gridX, jugador.gridY);
    
    // 3. Portales
    if (props.esPortal) {
        switch (bloqueActual) {
			case 100: // Entrar a la casa
				mapaActual = 'interior_casa_1';
				jugador.gridX = 6; jugador.gridY = 6; 
				jugador.pixelX = jugador.gridX * TILE_SIZE;
				jugador.pixelY = jugador.gridY * TILE_SIZE;
				break;
			case 101: // Salir de la casa
				mapaActual = 'exterior';
				jugador.gridX = 4; jugador.gridY = 6; // Justo delante de la puerta
				jugador.pixelX = jugador.gridX * TILE_SIZE;
				jugador.pixelY = jugador.gridY * TILE_SIZE;
				break;
			case 102: // Entrar a la casa
				mapaActual = 'interior_casa_2';
				jugador.gridX = 3; jugador.gridY = 4; // Justo delante de la puerta
				jugador.pixelX = jugador.gridX * TILE_SIZE;
				jugador.pixelY = jugador.gridY * TILE_SIZE;
				break;
			case 103: // Salir de la casa
				mapaActual = 'pueblo';
				jugador.gridX = 4; jugador.gridY = 4; // Justo delante de la puerta
				jugador.pixelX = jugador.gridX * TILE_SIZE;
				jugador.pixelY = jugador.gridY * TILE_SIZE;
				break;
			default:
				mapaActual = 'exterior';
				jugador.gridX = 3; jugador.gridY = 4; // Justo delante de la puerta
				jugador.pixelX = jugador.gridX * TILE_SIZE;
				jugador.pixelY = jugador.gridY * TILE_SIZE;
				break;
        }
    }
}

function detenerFisicas() {
    jugador.dirX = 0; jugador.dirY = 0; jugador.anguloGiro = 0;
    for (let k in teclas) teclas[k] = false;
}

function intentarInteractuar() {
    if (modo !== 'exploracion') return;
	
    // Usamos las coordenadas de la cuadrícula directamente
	let gx = jugador.gridX;
    let gy = jugador.gridY;

    // Calculamos las celdas adyacentes (vecinos)
    let vecinos = [
        {x: gx, y: gy - 1}, // Arriba
        {x: gx, y: gy + 1}, // Abajo
        {x: gx - 1, y: gy}, // Izquierda
        {x: gx + 1, y: gy}  // Derecha
    ];
	
    // 1. Verificar NPCs
    let npcsMapa = NPCS[mapaActual] || [];
	for (let npc of npcsMapa) {
		for (let v of vecinos) {
			console.log(`Buscando NPC en: ${npc.gridX},${npc.gridY} - Vecino chequeado: ${v.x},${v.y}`);
			if (npc.gridX === v.x && npc.gridY === v.y) { 
				console.log("¡NPC encontrado!");
				iniciarDialogo(npc.dialogo); 
				return; 
			}
		}
	}

    // 2. Verificar Bloques estructurales (PC, Tienda, Objetos, Curación)
	let mapa = MAPAS[mapaActual];
    for (let v of vecinos) {
        // Validamos que el vecino esté dentro del mapa
        if (mapa[v.y] && mapa[v.y][v.x] !== undefined) {
            let idBloque = mapa[v.y][v.x];
            let props = obtenerPropiedadesBloque(idBloque);
			
            if (props.esOrdenador) { abrirMenuOrdenador(); return; }
            if (props.esTienda) { abrirTienda(); return; }
            if (props.esObjetoSuelo) { recogerObjetoSuelo(v.x, v.y); return; }
            if (props.esCuracion) { iniciarCuracion(); return; }
			if (props.esAgua && !puedeSurfear()) {
				iniciarDialogo(["El agua parece profunda...", "Necesitas un Pokémon de tipo AGUA para SURFEAR."]);
				return;
			}
        }
    }
}

// --- LOGICA DE TRANSACCIONES DE LA TIENDA ---
function abrirTienda() {
    modo = 'tienda';
    detenerFisicas();
    document.getElementById('contenedorTienda').style.display = 'flex';
    renderizarTiendaUI();
    playTone(440, 'sine', 0.08);
}

function cerrarTienda() {
    modo = 'exploracion';
    document.getElementById('contenedorTienda').style.display = 'none';
    playTone(330, 'sine', 0.05);
}

function renderizarTiendaUI() {
    document.getElementById('tiendaTitulo').innerText = `TIENDA POKÉMON (Tu Saldo: $${monedero})`;
    const contenedor = document.getElementById('listaProductosTienda');
    contenedor.innerHTML = '';

    CATALOGO_TIENDA.forEach(prod => {
        contenedor.innerHTML += `
            <div class="fila-registro" style="align-items: center;">
                <span>${prod.nombre.toUpperCase()} ($${prod.precio})</span>
                <button onclick="comprarObjeto('${prod.id}', ${prod.precio})" style="width:70px; padding:3px; font-size:11px; text-align:center;">
                    COMPRAR
                </button>
            </div>`;
    });
}

function comprarObjeto(idItem, precio) {
    if (monedero < precio) {
        alert("¡No tienes suficiente dinero para comprar este artículo!");
        playTone(150, 'sine', 0.15);
        return;
    }
    
    monedero -= precio;
    inventario[idItem]++;
    playTone(580, 'triangle', 0.1); // Sonido de caja registradora
    renderizarTiendaUI();
}

// --- SISTEMA DE CENTRO POKÉMON ---
function iniciarCuracion() {
    modo = 'curacion'; // Bloquea momentáneamente el movimiento
    detenerFisicas();
    
    // 1. Guardar el nuevo punto de reaparición
    puntoReaparicion.mapa = mapaActual;
    puntoReaparicion.x = jugador.gridX;
    puntoReaparicion.y = jugador.gridY;

    // 2. Interfaz visual
    document.getElementById('dialogoUI').style.display = 'flex';
    document.getElementById('dialogoTexto').innerText = "Estamos curando a tus Pokémon...";

    // 3. La mítica melodía de curación de 4 tonos
    playTone(392, 'square', 0.2); // Sol
    setTimeout(() => playTone(493, 'square', 0.2), 250); // Si
    setTimeout(() => playTone(659, 'square', 0.2), 500); // Mi agudo
    setTimeout(() => playTone(523, 'square', 0.4), 750); // Do agudo (Sostenido)

    // 4. Restauración de datos y vuelta al diálogo
    setTimeout(() => {
        equipo.forEach(pkmn => {
            pkmn.hp = pkmn.hpMax;
            pkmn.estado = 'OK';
            pkmn.ataques.forEach(atk => atk.pp = atk.ppMax); // Restaurar PP también
        });
        
        iniciarDialogo([
            "¡Tus Pokémon están en plena forma!",
            "Tu punto de reaparición se ha guardado aquí.",
            "¡Esperamos volver a verte!"
        ]);
    }, 1500);
}

// --- MAQUINA DE ESTADOS DEL SISTEMA DE DIÁLOGOS ---
function iniciarDialogo(lineas) {
    console.log("Intentando iniciar diálogo con:", lineas); // <--- ERROR TRACE
    modo = 'dialogo';
    detenerFisicas();
    dialogoActual = lineas;
    indiceLineaDialogo = 0;
    
    let el = document.getElementById('dialogoUI');
    if (el) {
        el.style.display = 'flex'; // Cambiamos a flex para mostrarlo
        console.log("UI de diálogo activada");
    } else {
        console.error("¡ERROR: No encuentro el elemento dialogoUI en el HTML!");
    }
    
    mostrarTextoDialogo();
    playTone(400, 'sine', 0.04);
}

function mostrarTextoDialogo() {
    document.getElementById('dialogoTexto').innerText = dialogoActual[indiceLineaDialogo];
}

let dialogoSaltando = false;
function avanzarDialogo() {
    if (dialogoSaltando) return; // Evita que se solapen pulsaciones
    dialogoSaltando = true;
    indiceLineaDialogo++;
    playTone(450, 'sine', 0.03);
    
    if (indiceLineaDialogo < dialogoActual.length) {
        mostrarTextoDialogo();
        dialogoSaltando = false; // Permitimos la siguiente pulsación
    } else {
        finalizarDialogo();
        dialogoSaltando = false;
    }
}

function finalizarDialogo() {
    modo = 'exploracion';
    dialogoActual = null;
    document.getElementById('dialogoUI').style.display = 'none';
    playTone(300, 'sine', 0.04);
}

function comprobarVisionEntrenadores() {
    if (modo !== 'exploracion') return;

    let npcsMapa = NPCS[mapaActual] || [];
    let jugadorGridX = Math.floor((jugador.gridX + TILE_SIZE / 2) / TILE_SIZE);
    let jugadorGridY = Math.floor((jugador.gridY + TILE_SIZE / 2) / TILE_SIZE);

    for (let npc of npcsMapa) {
        if (npc.esEntrenador && !npc.derrotado) {
            let interceptado = false;

            // Proyectar rayos visuales en línea recta según el rango configurado
            for (let f = 1; f <= npc.rangoVision; f++) {
                let celdaX = npc.gridX;
                let celdaY = npc.gridY;

                if (npc.direccion === 'abajo') celdaY += f;
                if (npc.direccion === 'arriba') celdaY -= f;
                if (npc.direccion === 'izquierda') celdaX -= f;
                if (npc.direccion === 'derecha') celdaX += f;

                if (celdaX === jugadorGridX && celdaY === jugadorGridY) {
                    interceptado = true;
                    break;
                }
            }

            if (interceptado) {
                modo = 'alerta'; // Congela los inputs normales de control
                detenerFisicas();
                playTone(580, 'sawtooth', 0.25); // ¡Sonido clásico de sorpresa "!"

                // Pausa dramática antes de desplegar el diálogo del reto
                setTimeout(() => {
                    iniciarDialogo(npc.dialogo);
                    
                    // Sobrescribimos el cierre del diálogo para saltar directo a la batalla
                    window.finalizarDialogo = () => {
                        modo = 'exploracion';
                        document.getElementById('dialogoUI').style.display = 'none';
                        
                        // Iniciar Combate bajo formato Profesional de Entrenador
						// ... Dentro de comprobarVisionEntrenadores(), modifica la línea de arranque:
						tipoBatalla = 'entrenador';
						entrenadorActual = npc;
						indiceEnemigoActual = 0; // <--- Inicializa siempre en el primer Pokémon
						modo = 'batalla';
                        reproducirMusica('batalla');
                        
                        enemigoActual = JSON.parse(JSON.stringify(npc.equipoRival[0]));
                        document.getElementById('battleUI').style.display = 'block';
                        document.getElementById('battleText').innerText = `¡El Entrenador te desafía con un ${enemigoActual.nombre} Nvl:${enemigoActual.nivel}!`;
                        cerrarAtaques();
                        
                        // Restaurar la función original de cierre para futuros diálogos con NPCs normales
                        window.finalizarDialogo = () => {
                            modo = 'exploracion'; dialogoActual = null;
                            document.getElementById('dialogoUI').style.display = 'none';
                            playTone(300, 'sine', 0.04);
                        };
                    };
                }, 600);
                return;
            }
        }
    }
}

// Transicion entre mapas
function comprobarTransicionBordes() {
    if (modo !== 'exploracion') return;

    let mapa = MAPAS[mapaActual];
    let anchoMapa = mapa[0].length;
    
    // Usamos anchoMapa - 1 porque los índices de array empiezan en 0
    if (mapaActual === 'exterior' && jugador.gridX >= anchoMapa - 1) { // TRANSICIÓN: De exterior a pueblo (Por la derecha)
        let ancho = MAPAS['pueblo'][0].length;
        ejecutarEfectoTransicionBorde('pueblo', 1, 2); 
    } else if (mapaActual === 'pueblo' && jugador.gridX <= 0) { // TRANSICIÓN: De Pueblo a Exterior (Por la izquierda)
        let ancho = MAPAS['exterior'][0].length;
        ejecutarEfectoTransicionBorde('exterior', ancho - 3, jugador.gridY * 2); 
    } else if (mapaActual === 'pueblo' && jugador.gridX >= anchoMapa - 1) { // TRANSICIÓN: De Pueblo a Ruta (Por la derecha)
        let ancho = MAPAS['ruta_1'][0].length;
        ejecutarEfectoTransicionBorde('ruta_1', 1, jugador.gridY); 
    } else if (mapaActual === 'ruta_1' && jugador.gridX <= 0) { // TRANSICIÓN: De Ruta de vuelta a Pueblo (Por la izquierda)
        let ancho = MAPAS['pueblo'][0].length;
        ejecutarEfectoTransicionBorde('pueblo', ancho - 1, jugador.gridY); 
    }
}

function ejecutarEfectoTransicionBorde(nuevoMapa, destinoX, destinoY) {
    modo = 'transicion'; // Bloquea la lógica de juego un instante
    detenerFisicas();
    playTone(300, 'triangle', 0.1);

    // Reubicación de coordenadas
    mapaActual = nuevoMapa;
    jugador.gridX = destinoX;
    jugador.gridY = destinoY;

    // Simular el clásico parpadeo de pantalla negra de las portátiles
    canvas.style.opacity = '0';
    setTimeout(() => {
        canvas.style.opacity = '1';
        modo = 'exploracion';
    }, 300);
}

// ============================================================================
// 5. SISTEMA DEL ORDENADOR (ALMACENAMIENTO EN CAJA)
// ============================================================================
function abrirMenuOrdenador() {
    modo = 'ordenador';
    detenerFisicas();
    document.getElementById('contenedorOrdenador').style.display = 'flex';
    actualizarPCUI();
    playTone(520, 'sine', 0.08);
}

function cerrarMenuOrdenador() {
    modo = 'exploracion';
    document.getElementById('contenedorOrdenador').style.display = 'none';
    playTone(320, 'sine', 0.05);
}

function actualizarPCUI() {
    const listaEquipo = document.getElementById('pcListaEquipo');
    const listaCaja = document.getElementById('pcListaCaja');
    listaEquipo.innerHTML = '';
    listaCaja.innerHTML = '';

    equipo.forEach((pkmn, index) => {
        listaEquipo.innerHTML += `
            <div class="item-pc-pkmn" onclick="pcDepositar(${index})">
                <span>${pkmn.nombre}</span>
                <span>Nvl:${pkmn.nivel}</span>
            </div>`;
    });

    if (caja.length === 0) {
        listaCaja.innerHTML = `<div style="color:#aaa; text-align:center; font-size:11px; padding-top:10px;">Caja vacía</div>`;
    } else {
        caja.forEach((pkmn, index) => {
            listaCaja.innerHTML += `
                <div class="item-pc-pkmn" onclick="pcRetirar(${index})">
                    <span>${pkmn.nombre}</span>
                    <span>Nvl:${pkmn.nivel}</span>
                </div>`;
        });
    }
}

function pcDepositar(index) {
    if (equipo.length <= 1) {
        alert("¡No puedes depositar a tu último Pokémon! Necesitas al menos uno para combatir.");
        playTone(150, 'sine', 0.2);
		return;
    }
    let pkmn = equipo.splice(index, 1)[0];
    caja.push(pkmn);
    if (pkmn === miPokemon) miPokemon = equipo[0];
    
    playTone(400, 'triangle', 0.05);
    actualizarPCUI();
}

function pcRetirar(index) {
    if (equipo.length >= 6) {
        alert("Tu equipo ya está lleno (Máximo 6 miembros). Deposita un Pokémon primero.");
        return;
    }
    let pkmn = caja.splice(index, 1)[0];
    equipo.push(pkmn);
    
    playTone(480, 'triangle', 0.05);
    actualizarPCUI();
}

// ============================================================================
// 6. ENTORNO DE COMBATE POR TURNOS Y CAPTURA
// ============================================================================
function iniciarBatalla() {
	if (modo !== 'exploracion') return;
    modo = 'batalla';
    detenerFisicas();
    reproducirMusica('batalla');
    let plantilla = ENEMIGOS_SALVAJES[Math.floor(Math.random() * ENEMIGOS_SALVAJES.length)];
    enemigoActual = JSON.parse(JSON.stringify(plantilla));
    document.getElementById('battleUI').style.display = 'block';
    document.getElementById('battleText').innerText = `¡Un ${enemigoActual.nombre} salvaje de Nvl ${enemigoActual.nivel} apareció!`;
    cerrarAtaques();
}

// --- RENDERIZADO DE ATAQUES CON PP ---
function abrirAtaques() {
    if(turnoBloqueado) return;
    document.getElementById('menuOpciones').style.display = 'none';
    document.getElementById('menuAtaques').style.display = 'grid';
    
    for(let i=0; i<3; i++) {
        let btn = document.getElementById(`btnAtk${i}`);
        let atk = miPokemon.ataques[i];
        if(atk) { 
            btn.innerText = `${atk.n} [${atk.pp}/${atk.ppMax}]`; 
            btn.style.display = 'block'; 
            // Deshabilitar botón si no quedan PP
            btn.disabled = atk.pp <= 0;
        } else { 
            btn.style.display = 'none'; 
        }
    }
}

function cerrarAtaques() {
    document.getElementById('menuAtaques').style.display = 'none';
    document.getElementById('menuOpciones').style.display = 'grid';
}

// --- TURNO DEL JUGADOR CON VALIDACIÓN DE PP Y ESTADOS ---
function ejecutarAtaque(indiceAtk) {
    if(turnoBloqueado) return;
    turnoBloqueado = true;
    let ataque = miPokemon.ataques[indiceAtk];
    
    // 1. Verificación de Paralización
    if (miPokemon.estado === 'PARALIZADO' && Math.random() < 0.25) {
        document.getElementById('battleText').innerText = `¡${miPokemon.nombre} está paralizado y no se puede mover!`;
        playTone(150, 'sine', 0.3);
        setTimeout(procesarFinDeTurnoJugador, 1500);
        return;
    }

    // 2. Consumo de PP
    ataque.pp--;
    document.getElementById('battleText').innerText = `¡${miPokemon.nombre} usó ${ataque.n}!`;
    playTone(440, 'sawtooth', 0.2);

    setTimeout(() => {
        // 3. Cálculo de Efectividad de Tipo
        let mult = 1.0;
        if (TABLA_TIPOS[ataque.tipo] && TABLA_TIPOS[ataque.tipo][enemigoActual.tipo]) {
            mult = TABLA_TIPOS[ataque.tipo][enemigoActual.tipo];
        }

        // Aplicar daño elemental
        let danoFinal = Math.floor(ataque.d * mult);
        enemigoActual.hp = Math.max(0, enemigoActual.hp - danoFinal);

        // Chance de aplicar estado secundario (ej: Quemar con Fuego, Paralizar con Eléctrico)
        if (mult > 1.0 && enemigoActual.hp > 0 && enemigoActual.estado === 'OK') {
            if (ataque.tipo === 'FUEGO' && Math.random() < 0.4) {
                enemigoActual.estado = 'QUEMADO';
                setTimeout(() => { document.getElementById('battleText').innerText = `¡El ${enemigoActual.nombre} salvaje se ha quemado!`; }, 1000);
            }
            if (ataque.tipo === 'ELECTRICO' && Math.random() < 0.4) {
                enemigoActual.estado = 'PARALIZADO';
                setTimeout(() => { document.getElementById('battleText').innerText = `¡El ${enemigoActual.nombre} salvaje ha quedado paralizado!`; }, 1000);
            }
        }

        // Mostrar feedback visual de efectividad
        if (mult > 1.0) document.getElementById('battleText').innerText = "¡Es súper efectivo!";
        else if (mult < 1.0) document.getElementById('battleText').innerText = "No es muy efectivo...";

        setTimeout(() => {
            if (enemigoActual.hp <= 0) {
                procesarVictoria();
            } else {
                procesarFinDeTurnoJugador();
            }
        }, 1200);
    }, 1000);
}

// --- RESOLUCIÓN TÁCTICA DEL FIN DE TURNO ---
function procesarFinDeTurnoJugador() {
    // Aplicar daño por quemadura si corresponde
    if (enemigoActual.estado === 'QUEMADO') {
        let danoEntropia = Math.ceil(enemigoActual.hpMax * 0.1);
        enemigoActual.hp = Math.max(0, enemigoActual.hp - danoEntropia);
        document.getElementById('battleText').innerText = `¡El ${enemigoActual.nombre} salvaje sufre por la quemadura!`;
        playTone(180, 'sine', 0.2);
        
        setTimeout(() => {
            if (enemigoActual.hp <= 0) procesarVictoria();
            else turnoEnemigo();
        }, 1200);
    } else {
        turnoEnemigo();
    }
}

// --- TURNO DEL ENEMIGO CON INTELIGENCIA ELEMENTAL Y ESTADOS ---
function turnoEnemigo() {
    // 1. Verificación de Paralización Enemiga
	if (enemigoActual.estado === 'PARALIZADO' && Math.random() < 0.25) {
		document.getElementById('battleText').innerText = `¡El ${enemigoActual.nombre} salvaje está paralizado y no puede atacar!`;
		playTone(150, 'sine', 0.3);
		setTimeout(() => {
			document.getElementById('battleText').innerText = `¿Qué debe hacer ${miPokemon.nombre}?`;
			turnoBloqueado = false; 
			cerrarAtaques();
		}, 1500);
		return;
	}
	
    let atkEnemigo = enemigoActual.ataques[Math.floor(Math.random() * enemigoActual.ataques.length)];
    document.getElementById('battleText').innerText = `¡${enemigoActual.nombre} salvaje usó ${atkEnemigo.n}!`;
    playTone(220, 'sine', 0.25);

    setTimeout(() => {
        let mult = 1.0;
        if (TABLA_TIPOS[atkEnemigo.tipo] && TABLA_TIPOS[atkEnemigo.tipo][miPokemon.tipo]) {
            mult = TABLA_TIPOS[atkEnemigo.tipo][miPokemon.tipo];
        }

        let danoFinal = Math.floor(atkEnemigo.d * mult);
        miPokemon.hp = Math.max(0, miPokemon.hp - danoFinal);

        if (mult > 1.0) document.getElementById('battleText').innerText = "¡Es súper efectivo!";
        else if (mult < 1.0) document.getElementById('battleText').innerText = "No es muy efectivo...";

        setTimeout(() => {
            if(miPokemon.hp <= 0) {
                procesarDerrota();
            } else {
                procesarFinDeTurnoEnemigo();
            }
        }, 1200);
    }, 1200);
}

function procesarFinDeTurnoEnemigo() {
    if (miPokemon.estado === 'QUEMADO') {
        let danoEntropia = Math.ceil(miPokemon.hpMax * 0.1);
        miPokemon.hp = Math.max(0, miPokemon.hp - danoEntropia);
        document.getElementById('battleText').innerText = `¡${miPokemon.nombre} sufre por la quemadura!`;
        playTone(180, 'sine', 0.2);
        
        setTimeout(() => {
            if (miPokemon.hp <= 0) procesarDerrota();
            else {
                document.getElementById('battleText').innerText = `¿Qué debe hacer ${miPokemon.nombre}?`;
                turnoBloqueado = false; cerrarAtaques();
            }
        }, 1200);
    } else {
        document.getElementById('battleText').innerText = `¿Qué debe hacer ${miPokemon.nombre}?`;
        turnoBloqueado = false; cerrarAtaques();
    }
}

// --- AUXILIARES REFACTORIZADOS DE FIN DE COMBATE ---
// --- PROCESADOR DE VICTORIA CON MOTOR DE EVOLUCIÓN APRENDIZAJE Y DINERO ---
function procesarVictoria() {
    playTone(600, 'square', 0.4);
    document.getElementById('battleText').innerText = `¡El ${enemigoActual.nombre} enemigo se ha debilitado!`;
    
    setTimeout(() => {
        miPokemon.exp += 20;
        document.getElementById('battleText').innerText = `¡${miPokemon.nombre} ganó 20 Puntos de EXP!`;
        
        if(miPokemon.exp >= miPokemon.nivel * 15) {
            miPokemon.nivel++; miPokemon.hpMax += 5; miPokemon.hp = miPokemon.hpMax;
            setTimeout(() => { 
                document.getElementById('battleText').innerText = `¡Subiste al Nivel ${miPokemon.nivel}!`; 
                
                let reglaEvolucion = REGLAS_EVOLUCION[miPokemon.nombre];
                
                // Función interna: Comprobar ataques tras posible evolución
                const comprobarNuevosAtaques = () => {
                    let nuevoAtaqueStr = MOVIMIENTOS_POR_NIVEL[miPokemon.nombre]?.[miPokemon.nivel];
                    
                    if(nuevoAtaqueStr && DICCIONARIO_ATAQUES[nuevoAtaqueStr]) {
                        let ataqueObjeto = JSON.parse(JSON.stringify(DICCIONARIO_ATAQUES[nuevoAtaqueStr]));
                        
                        if(miPokemon.ataques.length < 4) {
                            miPokemon.ataques.push(ataqueObjeto);
                            document.getElementById('battleText').innerText = `¡${miPokemon.nombre} aprendió ${nuevoAtaqueStr}!`;
                            playTone(500, 'triangle', 0.2);
                            setTimeout(finalizarSecuenciaVictoria, 2000);
                        } else {
                            // Limite alcanzado: Abrir panel de elección
                            pokemonAprendiendo = miPokemon;
                            movimientoPendiente = ataqueObjeto;
                            abrirMenuAprenderAtaque();
                        }
                    } else {
                        finalizarSecuenciaVictoria();
                    }
                };

                // Comprobar evolución
                if (reglaEvolucion && miPokemon.nivel >= reglaEvolucion.nivel) {
                    setTimeout(() => {
                        let nombreViejo = miPokemon.nombre;
                        miPokemon.nombre = reglaEvolucion.siguiente; 
                        miPokemon.hpMax += reglaEvolucion.hpBonus;   
                        miPokemon.hp = miPokemon.hpMax;
                        especiesAvistadas[miPokemon.nombre] = true; 
                        
                        playTone(300, 'square', 0.1);
                        setTimeout(() => playTone(450, 'square', 0.1), 100);
                        setTimeout(() => playTone(600, 'square', 0.3), 200);

                        document.getElementById('battleText').innerText = `¡¿Qué?! ¡${nombreViejo} ha evolucionado en ${miPokemon.nombre}!`;
                        
                        // Una vez evolucionado, comprobamos si aprende algo nuevo
                        setTimeout(comprobarNuevosAtaques, 2500); 
                    }, 1500);
                } else {
                    // Si no evoluciona, saltamos directo a comprobar ataques
                    setTimeout(comprobarNuevosAtaques, 1500);
                }
            }, 1000);
        } else {
            // Si no sube de nivel, finaliza el combate
            setTimeout(finalizarSecuenciaVictoria, 1500);
        }
    }, 1500);
}

// Sub-secuencia extraída para el cierre limpio de la batalla
function finalizarSecuenciaVictoria() {
    if (tipoBatalla === 'entrenador' && entrenadorActual && (indiceEnemigoActual + 1) < entrenadorActual.equipoRival.length) {
        indiceEnemigoActual++;
        enemigoActual = JSON.parse(JSON.stringify(entrenadorActual.equipoRival[indiceEnemigoActual]));
        document.getElementById('battleText').innerText = `¡El Entrenador envía a ${enemigoActual.nombre} Nvl:${enemigoActual.nivel}!`;
        playTone(400, 'square', 0.15);
        setTimeout(() => {
            document.getElementById('battleText').innerText = `¿Qué debe hacer ${miPokemon.nombre}?`;
            turnoBloqueado = false; cerrarAtaques();
        }, 1500);
    } else {
        if (tipoBatalla === 'entrenador' && entrenadorActual) {
            entrenadorActual.derrotado = true;
            monedero += 400;
            document.getElementById('battleText').innerText = "¡Has derrotado al Entrenador! Ganaste $400.";
            playTone(600, 'square', 0.1);
            setTimeout(finalizarBatalla, 2500);
        } else {
            finalizarBatalla();
        }
    }
}

// --- SISTEMA DE OLVIDO/APRENDIZAJE DE MOVIMIENTOS ---
function abrirMenuAprenderAtaque() {
    document.getElementById('contenedorAprenderAtaque').style.display = 'flex';
    document.getElementById('textoAprender').innerText = `${pokemonAprendiendo.nombre} intenta aprender ${movimientoPendiente.n}.\nSin embargo, ya conoce 4 ataques. ¿Quieres olvidar uno para hacer hueco?`;
    
    const contenedorLista = document.getElementById('listaAtaquesAprender');
    contenedorLista.innerHTML = '';
    
    // Generar botón por cada ataque actual
    pokemonAprendiendo.ataques.forEach((atk, index) => {
        let btn = document.createElement('button');
        btn.className = 'item-pc-pkmn'; // Aprovechamos las clases CSS del PC
        btn.innerText = `OLVIDAR: ${atk.n} [Tipo: ${atk.tipo}]`;
        btn.onclick = () => procesarOlvidoAtaque(index);
        contenedorLista.appendChild(btn);
    });
    
    // Botón de Cancelar
    let btnCancelar = document.createElement('button');
    btnCancelar.className = 'btn-volver-pausa';
    btnCancelar.innerText = `DEJAR DE APRENDER ${movimientoPendiente.n.toUpperCase()}`;
    btnCancelar.onclick = () => cancelarOlvidoAtaque();
    contenedorLista.appendChild(btnCancelar);
}

function procesarOlvidoAtaque(indice) {
    let ataqueOlvidado = pokemonAprendiendo.ataques[indice];
    pokemonAprendiendo.ataques[indice] = movimientoPendiente; // Reemplazo directo en el array
    
    document.getElementById('contenedorAprenderAtaque').style.display = 'none';
    document.getElementById('battleText').innerText = `1, 2, y... ¡Puf! ${pokemonAprendiendo.nombre} olvidó ${ataqueOlvidado.n} y aprendió ${movimientoPendiente.n}.`;
    playTone(550, 'triangle', 0.2);
    
    // Limpieza de memoria temporal
    pokemonAprendiendo = null; movimientoPendiente = null;
    
    setTimeout(finalizarSecuenciaVictoria, 3000);
}

function cancelarOlvidoAtaque() {
    document.getElementById('contenedorAprenderAtaque').style.display = 'none';
    document.getElementById('battleText').innerText = `${pokemonAprendiendo.nombre} no aprendió ${movimientoPendiente.n}.`;
    playTone(200, 'sawtooth', 0.2); // Tono de negación
    
    // Limpieza de memoria temporal
    pokemonAprendiendo = null; movimientoPendiente = null;
    
    setTimeout(finalizarSecuenciaVictoria, 2000);
}

function procesarDerrota() {
    document.getElementById('battleText').innerText = `¡Tu ${miPokemon.nombre} se debilitó! Volviendo a zona segura...`;
    setTimeout(() => {
        // Restauración completa tras el "Game Over"
        equipo.forEach(p => { 
            p.hp = p.hpMax; 
            p.estado = 'OK'; 
            p.ataques.forEach(atk => atk.pp = atk.ppMax); 
        });
        
        // Volver al último punto seguro
        mapaActual = puntoReaparicion.mapa;
        jugador.gridX = puntoReaparicion.x; 
        jugador.gridY = puntoReaparicion.y; 
        
        tipoBatalla = 'salvaje'; // Restaurar modo por defecto
        finalizarBatalla();
    }, 2500);
}

function abrirMenuPokemon() {
    if(turnoBloqueado) return;
    document.getElementById('menuOpciones').style.display = 'none';
    document.getElementById('menuPokemon').style.display = 'grid';
    document.getElementById('battleText').innerText = "Selecciona un Pokémon para combatir:";

    for(let i = 0; i < 6; i++) {
        let btn = document.getElementById(`btnPkmn${i}`);
        if (!btn) continue;
        let pkmn = equipo[i];

        if(pkmn) {
            btn.style.display = 'block';
            btn.innerText = `${pkmn.nombre} (${pkmn.hp}/${pkmn.hpMax})`;
            if (pkmn === miPokemon) {
                btn.innerText = `• ${pkmn.nombre} •`;
            } else if (pkmn.hp <= 0) {
                btn.innerText = `${pkmn.nombre} (X_X)`;
            }
        } else {
            btn.style.display = 'none';
        }
    }
}

function elegirPokemon(indice) {
    let pokemonSeleccionado = equipo[indice];
    if (!pokemonSeleccionado) return;

    if (pokemonSeleccionado === miPokemon) {
        document.getElementById('battleText').innerText = `¡${pokemonSeleccionado.nombre} ya está en la arena!`;
        return;
    }
    if (pokemonSeleccionado.hp <= 0) {
        document.getElementById('battleText').innerText = `¡${pokemonSeleccionado.nombre} no tiene energías!`;
        return;
    }

    turnoBloqueado = true;
    document.getElementById('menuPokemon').style.display = 'none';
    document.getElementById('battleText').innerText = `¡Regresa ${miPokemon.nombre}! ... ¡Adelante ${pokemonSeleccionado.nombre}!`;
    
    playTone(300, 'square', 0.1);
    setTimeout(() => playTone(450, 'square', 0.15), 100);

    miPokemon = pokemonSeleccionado;
    setTimeout(() => { turnoEnemigo(); }, 2000);
}

function cambiarPokemon() {
    if(turnoBloqueado) return;
    let indexActual = equipo.indexOf(miPokemon);
    miPokemon = equipo[(indexActual + 1) % equipo.length];
    document.getElementById('battleText').innerText = `¡Adelante ${miPokemon.nombre}!`;
    playTone(400, 'square', 0.1);
    cerrarAtaques();
}

function cerrarMenuPokemon() {
    document.getElementById('menuPokemon').style.display = 'none';
    document.getElementById('menuOpciones').style.display = 'grid';
    document.getElementById('battleText').innerText = `¿Qué debe hacer ${miPokemon.nombre}?`;
}

// --- INVENTARIO DE COMBATE RENDEREADO DINÁMICAMENTE ---
function abrirInventario() {
    if(turnoBloqueado) return;
    document.getElementById('menuOpciones').style.display = 'none';
    
    const menuInv = document.getElementById('menuInventario');
    menuInv.style.display = 'grid'; // Usa la cuadrícula del CSS
    menuInv.innerHTML = ''; // Limpiar render previo

    // Generar un botón por cada objeto útil que poseamos
    for (let objeto in inventario) {
        if (inventario[objeto] > 0 || objeto === 'bolas') { 
            let nombreFormateado = objeto.replace(/([A-Z])/g, ' $1').toUpperCase();
            let btn = document.createElement('button');
            btn.innerText = `${nombreFormateado} (x${inventario[objeto]})`;
            btn.onclick = () => ejecutarObjetoBatalla(objeto);
            menuInv.appendChild(btn);
        }
    }

    // Botón nativo para salir del submenú
    let btnVolver = document.createElement('button');
    btnVolver.innerText = "VOLVER";
    btnVolver.onclick = cerrarInventario;
    menuInv.appendChild(btnVolver);
    
    document.getElementById('battleText').innerText = "¿Qué objeto quieres usar de la mochila?";
}

function cerrarInventario() {
    document.getElementById('menuInventario').style.display = 'none';
    document.getElementById('menuOpciones').style.display = 'grid';
    document.getElementById('battleText').innerText = `¿Qué debe hacer ${miPokemon.nombre}?`;
}

// --- RESOLUTOR DE EFECTOS MEDICINALES Y REGLAS DE CAPTURA ---
function ejecutarObjetoBatalla(objeto) {
    if (inventario[objeto] <= 0) return;

    // Regla Especial 1: Lanzamiento de bolas (Captura)
    if (objeto === 'bolas') {
        if (tipoBatalla === 'entrenador') {
            document.getElementById('battleText').innerText = "¡No puedes robar los Pokémon de otro Entrenador!";
            playTone(150, 'sine', 0.2);
            return;
        }
        inventario.bolas--;
        turnoBloqueado = true;
        animacionCaptura = true;
        cerrarInventario();
        document.getElementById('battleText').innerText = `¡Lanzaste una BOLA!`;
        playTone(350, 'triangle', 0.2);
        setTimeout(() => calcularCaptura(), 1200);
        return;
    }

    // Regla Especial 2: Medicinas Curativas
    if (objeto === 'pociones') {
        if (miPokemon.hp === miPokemon.hpMax) {
            document.getElementById('battleText').innerText = "¡La salud de tu Pokémon ya está al máximo!"; return;
        }
        miPokemon.hp = Math.min(miPokemon.hpMax, miPokemon.hp + 25);
        document.getElementById('battleText').innerText = `¡Usaste POCIÓN! ${miPokemon.nombre} recuperó 25 PS.`;
    } 
    else if (objeto === 'curaQuemadura') {
        if (miPokemon.estado !== 'QUEMADO') {
            document.getElementById('battleText').innerText = "¡Tu Pokémon no está quemado!"; return;
        }
        miPokemon.estado = 'OK';
        document.getElementById('battleText').innerText = `¡Usaste CURA QUEMADURA! Tu Pokémon sanó de sus quemaduras.`;
    } 
    else if (objeto === 'antiparaliz') {
        if (miPokemon.estado !== 'PARALIZADO') {
            document.getElementById('battleText').innerText = "¡Tu Pokémon no sufre de parálisis!"; return;
        }
        miPokemon.estado = 'OK';
        document.getElementById('battleText').innerText = `¡Usaste ANTIPARALIZ! Tu Pokémon recuperó la movilidad.`;
    } 
    else if (objeto === 'elixir') {
        miPokemon.ataques.forEach(atk => atk.pp = atk.ppMax);
        document.getElementById('battleText').innerText = "¡Usaste ELIXIR! Todos los PP del Pokémon se han restaurado.";
    }

    // Consumir stock, bloquear menús y ceder turno al enemigo
    inventario[objeto]--;
    turnoBloqueado = true;
    cerrarInventario();
    playTone(550, 'sine', 0.1); // Sonido de sanación
    setTimeout(turnoEnemigo, 1500);
}

function calcularCaptura() {
    let probBase = 0.3; 
    let ratioSalud = enemigoActual.hp / enemigoActual.hpMax;
    let probFinal = probBase + ((1 - ratioSalud) * 0.5); 
    ejecutarTemblores(0, probFinal);
}

function ejecutarTemblores(fase, probFinal) {
    if (fase < 3) {
        document.getElementById('battleText').innerText = "...";
        playTone(120, 'sawtooth', 0.1);

        let tirada = Math.random();
        if (tirada > probFinal + 0.15) {
            setTimeout(() => {
                animacionCaptura = false;
                document.getElementById('battleText').innerText = "¡Oh no! ¡El Pokémon se escapó!";
                playTone(150, 'square', 0.4);
                setTimeout(turnoEnemigo, 1500);
            }, 1000);
            return;
        }
        setTimeout(() => ejecutarTemblores(fase + 1, probFinal), 1000);
        
    } else {
        document.getElementById('battleText').innerText = `¡Genial! ¡${enemigoActual.nombre} fue capturado!`;
        playTone(600, 'square', 0.1);
        setTimeout(() => playTone(800, 'square', 0.2), 150);
        setTimeout(() => playTone(1000, 'square', 0.4), 300);

        let nuevoAmigo = JSON.parse(JSON.stringify(enemigoActual));
        nuevoAmigo.hp = nuevoAmigo.hpMax;
        nuevoAmigo.exp = 0;
        
        especiesAvistadas[nuevoAmigo.nombre] = true;

        if (equipo.length < 6) {
            equipo.push(nuevoAmigo);
            setTimeout(() => {
                document.getElementById('battleText').innerText = `¡${enemigoActual.nombre} se unió a tu EQUIPO!`;
            }, 1500);
        } else {
            caja.push(nuevoAmigo);
            setTimeout(() => {
                document.getElementById('battleText').innerText = `¡Equipo lleno! ${enemigoActual.nombre} fue enviado a la CAJA.`;
            }, 1500);
        }
    
        setTimeout(() => {
            animacionCaptura = false;
            finalizarBatalla();
        }, 3500);
    }
}

function intentarHuir() {
    if(turnoBloqueado) return;
    
    if (tipoBatalla === 'entrenador') {
        document.getElementById('battleText').innerText = "¡No puedes huir de un combate de Entrenador!";
        playTone(150, 'sine', 0.2);
        return;
    }
    
    document.getElementById('battleText').innerText = "¡Escapaste sin problemas!";
    playTone(800, 'triangle', 0.3);
    setTimeout(finalizarBatalla, 1000);
}

function finalizarBatalla() {
    modo = 'exploracion';
    turnoBloqueado = false;
    animacionCaptura = false; // Reset de la animación
    
    // Ocultar elementos visuales
    document.getElementById('battleUI').style.display = 'none';
    document.getElementById('menuAtaques').style.display = 'none';
    document.getElementById('menuPokemon').style.display = 'none';
    document.getElementById('menuInventario').style.display = 'none';
    
    reproducirMusica('exploracion');
    console.log("Batalla finalizada, UI oculta.");
}

// ============================================================================
// 7. SISTEMA DE GESTIÓN DE MENÚ DE PAUSA (SUBPANELES HTML)
// ============================================================================
let menuCursor = {
    index: 0,
    max: 0,
    nombreMenu: null
};

// --- NUEVO SISTEMA DE CURSOR DINÁMICO ---
let menuCursorIndex = 0;

function obtenerBotonesVisibles() {
    // Escanea todos los botones y filas clickeables
    let elementos = document.querySelectorAll('button, .item-pc-pkmn');
    
    // Filtra para devolver SOLO los que están visibles, que no sean la cruceta táctil y que no estén bloqueados
    return Array.from(elementos).filter(el => {
        let esVisible = el.offsetWidth > 0 || el.offsetHeight > 0;
        let noEsCrucetaTactil = !el.id.startsWith('btnV');
        return esVisible && noEsCrucetaTactil && !el.disabled;
    });
}

// Esta función simplifica mover el cursor
function moverCursorMenu(direccion) {
    let botones = obtenerBotonesVisibles();
    if (botones.length === 0) return;

    // Ajuste de seguridad si el menú cambia de tamaño
    if (menuCursorIndex >= botones.length) menuCursorIndex = 0;

    // Quitar la clase visual de todos
    botones.forEach(b => b.classList.remove('menu-activo'));

    // Mover el índice
    if (direccion === 'down' || direccion === 'right') {
        menuCursorIndex = (menuCursorIndex + 1) % botones.length;
    } else if (direccion === 'up' || direccion === 'left') {
        menuCursorIndex = (menuCursorIndex - 1 + botones.length) % botones.length;
    }

    playTone(300, 'sine', 0.03);
    
    // Aplicar resaltado al nuevo
    botones[menuCursorIndex].classList.add('menu-activo');
    botones[menuCursorIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function activarBotonMenu() {
    let botones = obtenerBotonesVisibles();
    if (botones.length > 0 && botones[menuCursorIndex]) {
        botones[menuCursorIndex].click();
        menuCursorIndex = 0; // Reiniciar el cursor para la siguiente pantalla
    }
}

function abrirMenuPausa() {
    modo = 'pausa';
    detenerFisicas();
    document.getElementById('contenedorPausa').style.display = 'block';
    document.getElementById('menuPausa').style.display = 'flex';
    ocultarTodosLosSubPaneles();
    playTone(400, 'triangle', 0.05);
	
	// Inicializar cursor
    menuCursor.index = 0;
    menuCursor.max = document.querySelectorAll('.panel-menu-opcion').length; // O lo que uses
    menuCursor.nombreMenu = 'pausa';
}

function cerrarMenuPausa() {
    modo = 'exploracion';
    document.getElementById('contenedorPausa').style.display = 'none';
    playTone(300, 'triangle', 0.05);
}

function abrirSubPanel(idPanel) {
    playTone(450, 'sine', 0.05);
    document.getElementById('menuPausa').style.display = 'none';
    ocultarTodosLosSubPaneles();
    
    const panel = document.getElementById(`panel${idPanel.charAt(0).toUpperCase() + idPanel.slice(1)}`);
    panel.style.display = 'flex';

    if (idPanel === 'pokedex') construirPokedexUI();
    if (idPanel === 'equipo') construirEquipoUI();
    if (idPanel === 'mochila') construirMochilaUI();
    if (idPanel === 'opciones') construirOpcionesUI();
    if (idPanel === 'guardar') document.getElementById('txtGuardar').innerText = "¿Deseas guardar tu progreso actual?";
}

function regresarAlMenuPausa() {
    playTone(350, 'sine', 0.05);
    ocultarTodosLosSubPaneles();
    document.getElementById('menuPausa').style.display = 'flex';
}

function ocultarTodosLosSubPaneles() {
    const paneles = ['panelPokedex', 'panelEquipo', 'panelMochila', 'panelGuardar', 'panelOpciones'];
    paneles.forEach(p => document.getElementById(p).style.display = 'none');
}

function alternarMenuPausa() {
    if (modo === 'exploracion') abrirMenuPausa();
    else if (modo === 'pausa') cerrarMenuPausa();
}

function construirPokedexUI() {
    const contenedor = document.getElementById('listaPokedex');
    contenedor.innerHTML = '';
    
    ESPECIES_POKEDEX.forEach((nombre, index) => {
        let numero = String(index + 1).padStart(3, '0');
        let capturado = especiesAvistadas[nombre];
        contenedor.innerHTML += `
            <div class="fila-registro">
                <span>Nº${numero} ${capturado ? nombre.toUpperCase() : '----------'}</span>
                <span style="color: ${capturado ? '#4caf50' : '#ccc'}">${capturado ? '✓ ATTRAP' : '???'}</span>
            </div>`;
    });
}

function construirEquipoUI() {
    const conEquipo = document.getElementById('listaEquipoPausa');
    const conCaja = document.getElementById('listaCajaPausa');
    conEquipo.innerHTML = ''; conCaja.innerHTML = '';

    equipo.forEach((pkmn) => {
        conEquipo.innerHTML += `
            <div class="fila-registro">
                <span>${pkmn.nombre} (Nvl ${pkmn.nivel})</span>
                <span>HP: ${pkmn.hp}/${pkmn.hpMax}</span>
            </div>`;
    });

    if(caja.length === 0) {
        conCaja.innerHTML = `<div style="color:#999; text-align:center; font-size:12px; padding:6px;">La caja está vacía</div>`;
    } else {
        caja.forEach((pkmn) => {
            conCaja.innerHTML += `
                <div class="fila-registro" style="color:#555;">
                    <span>${pkmn.nombre} (Nvl ${pkmn.nivel})</span>
                    <span>ALMACENADO</span>
                </div>`;
        });
    }
}

function construirMochilaUI() {
    const contenedor = document.getElementById('listaMochilaPausa');
    contenedor.innerHTML = '';
    let totalItems = 0;

    for (let objeto in inventario) {
        if (inventario[objeto] >= 1) {
            totalItems++;
            let nombreFormateado = objeto.charAt(0).toUpperCase() + objeto.slice(1);
            contenedor.innerHTML += `
                <div class="fila-registro">
                    <span>• ${nombreFormateado}</span>
                    <span>x${inventario[objeto]}</span>
                </div>`;
        }
    }
    if (totalItems === 0) {
        contenedor.innerHTML = `<div style="color:#999; text-align:center; font-size:12px; padding:6px;">Mochila vacía</div>`;
    }
}

function construirOpcionesUI() {
    const contenedor = document.getElementById('listaOpcionesPausa');
    contenedor.innerHTML = `
        <div style="padding: 10px; display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 14px;">
                <span>MÚSICA DE FONDO</span>
                <button onclick="alternarMusica()" style="width: 100px; padding: 6px; font-size: 11px; text-align: center;">
                    ${musicaEncendida ? 'ENCENDIDA' : 'APAGADA'}
                </button>
            </div>
            <div style="font-size: 11px; color: #777; border-top: 1px dashed #ccc; padding-top: 12px; line-height: 1.5;">
                • TEXTOS: RÁPIDO (Predeterminado)<br>
                • SONIDO: MONO (Sintetizador WebAudio)<br>
                • PANTALLA: AJUSTE AJUSTABLE
            </div>
        </div>`;
}

function alternarMusica() {
    musicaEncendida = !musicaEncendida;
    if (musicaEncendida) reproducirMusica();
    else clearInterval(bjpInterval);
    construirOpcionesUI();
    playTone(450, 'sine', 0.05);
}

function pausaConfirmarGuardar() {
    try {
        const salvado = {
            jugadorX: jugador.gridX * TILE_SIZE, 
            jugadorY: jugador.gridY * TILE_SIZE,
            mapa: mapaActual, inventario: inventario,
            equipo: equipo, caja: caja,
            especiesAvistadas: especiesAvistadas,
            musicaEncendida: musicaEncendida,
            monedero: monedero,
			objetosRecogidos: objetosRecogidos,
			puntoReaparicion: puntoReaparicion
        };
        localStorage.setItem('pokemon_pro_save', JSON.stringify(salvado));
        playTone(600, 'square', 0.08);
        setTimeout(() => playTone(800, 'square', 0.15), 80);
        document.getElementById('txtGuardar').innerText = "¡Partida guardada con éxito!";
    } catch(e) {
        document.getElementById('txtGuardar').innerText = "Error al acceder a la memoria.";
    }
}

// ============================================================================
// 8. CAPTURA Y ASIGNACIÓN UNIFICADA DE EVENTOS (TECLADO Y PANTALLAS TÁCTILES)
// ============================================================================
let juegoIniciado = false;
window.addEventListener('keydown', e => {
    if (!juegoIniciado) {
        juegoIniciado = true;
        reproducirMusica('exploracion'); // Mueve la música aquí
        return;
    }
	
	// Si estamos en un menú, bloqueamos el movimiento del jugador
    // Evita que la página web haga scroll al usar las flechas o el espacio
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault(); 
    }
	
    teclas[e.key] = true; 
    audioCtx.resume(); 

    if (e.key === ' ' || e.key === 'Spacebar') {
        if (modo === 'exploracion' || modo === 'pausa') {
            e.preventDefault();
            alternarMenuPausa();
        }
    }

	// --- NAVEGACIÓN EN MENÚS ---
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight'){
        if (['pausa', 'ordenador', 'tienda', 'batalla'].includes(modo)) moverCursorMenu('down');
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft'){
        if (['pausa', 'ordenador', 'tienda', 'batalla'].includes(modo)) moverCursorMenu('up');
    }
	
    if (e.key === 'Escape' || e.key.toLowerCase() === 'b') {
        if (modo === 'pausa') {
            let algunoAbierto = false;
            ['panelPokedex', 'panelEquipo', 'panelMochila', 'panelGuardar', 'panelOpciones'].forEach(p => {
                if(document.getElementById(p).style.display === 'flex') algunoAbierto = true;
            });
            if (algunoAbierto) regresarAlMenuPausa();
            else cerrarMenuPausa();
        }
    }
    
	// --- BOTÓN DE ACEPTAR ---
    if (e.key.toLowerCase() === 'a' || e.key === 'Enter') {
        if (modo === 'exploracion') intentarInteractuar();
        else if (modo === 'dialogo') avanzarDialogo();
        else if (['pausa', 'ordenador', 'tienda', 'batalla'].includes(modo)) activarBotonMenu();
    }
    
    if (e.key.toLowerCase() === 'b' || e.key === 'Escape') {
		if (modo === 'ordenador') cerrarMenuOrdenador();
		else if (modo === 'tienda') cerrarTienda();
    }
});

window.addEventListener('keyup', e => teclas[e.key] = false);

const mapeoMovimiento = [
    { id: 'btnVUp', tecla: 'ArrowUp' },
    { id: 'btnVDown', tecla: 'ArrowDown' },
    { id: 'btnVLeft', tecla: 'ArrowLeft' },
    { id: 'btnVRight', tecla: 'ArrowRight' }
];

mapeoMovimiento.forEach(control => {
    const boton = document.getElementById(control.id);
    if(boton) {
        boton.addEventListener('touchstart', (e) => {
            if (!juegoIniciado) {
                juegoIniciado = true;
                reproducirMusica('exploracion');
                return;
            }
            e.preventDefault(); audioCtx.resume();
            
            // Verificamos si estamos en algún menú (incluyendo los de batalla)
            if (['pausa', 'ordenador', 'tienda', 'batalla'].includes(modo)) {
                let dir = (control.tecla === 'ArrowDown' || control.tecla === 'ArrowRight') ? 'down' : 'up';
                moverCursorMenu(dir);
            } else {
                // Si estamos explorando el mapa
                teclas[control.tecla] = true;
            }
        });
        boton.addEventListener('touchend', (e) => {
			if (!juegoIniciado) {
				juegoIniciado = true;
				reproducirMusica('exploracion'); // Mueve la música aquí
				return;
			}
            e.preventDefault();
            teclas[control.tecla] = false;
        });
    }
});

if(document.getElementById('btnVA')) {
    document.getElementById('btnVA').addEventListener('touchstart', (e) => {
		if (!juegoIniciado) {
			juegoIniciado = true;
			reproducirMusica('exploracion'); // Mueve la música aquí
			return;
		}
        e.preventDefault(); audioCtx.resume();
        playTone(400, 'sine', 0.05);
        
        if (modo === 'exploracion') intentarInteractuar();
        else if (modo === 'dialogo') avanzarDialogo();
        else if (['pausa', 'ordenador', 'tienda', 'batalla'].includes(modo)) activarBotonMenu();
    });
}

if(document.getElementById('btnVB')) {
    document.getElementById('btnVB').addEventListener('touchstart', (e) => {
		if (!juegoIniciado) {
			juegoIniciado = true;
			reproducirMusica('exploracion'); // Mueve la música aquí
			return;
		}
        e.preventDefault(); audioCtx.resume();
        if (modo === 'ordenador') { cerrarMenuOrdenador(); return; }
        if (modo === 'pausa') {
            let algunoAbierto = false;
            ['panelPokedex', 'panelEquipo', 'panelMochila', 'panelGuardar', 'panelOpciones'].forEach(p => {
                if(document.getElementById(p).style.display === 'flex') algunoAbierto = true;
            });
            if (algunoAbierto) regresarAlMenuPausa();
            else cerrarMenuPausa();
            return;
        }
        if(modo === 'batalla' && !turnoBloqueado) {
            playTone(250, 'sine', 0.05);
            cerrarAtaques(); cerrarInventario(); cerrarMenuPokemon();
        }
		if (modo === 'tienda') { cerrarTienda(); return; }
    });
}

if(document.getElementById('btnVStart')) {
    document.getElementById('btnVStart').addEventListener('touchstart', (e) => {
		if (!juegoIniciado) {
			juegoIniciado = true;
			reproducirMusica('exploracion'); // Mueve la música aquí
			return;
		}
        e.preventDefault(); audioCtx.resume();
        if (modo === 'exploracion' || modo === 'pausa') alternarMenuPausa();
    });
}

if(document.getElementById('btnVSelect')) {
    document.getElementById('btnVSelect').addEventListener('touchstart', (e) => {
		if (!juegoIniciado) {
			juegoIniciado = true;
			reproducirMusica('exploracion'); // Mueve la música aquí
			return;
		}
        e.preventDefault(); playTone(450, 'triangle', 0.08);
    });
}

// ============================================================================
// 9. BUCLE CENTRAL DEL JUEGO E INICIALIZACIÓN
// ============================================================================
function loop() {
    if (!juegoIniciado) {
        ctx.fillStyle = "black";
        ctx.fillRect(0,0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "20px Courier New";
        ctx.fillText("PRESIONA CUALQUIER TECLA", 50, canvas.height/2);
        requestAnimationFrame(loop);
        return;
    }

    // 1. Lógica de animación
    if (jugador.moviendo) {
        jugador.frameActual++;
        // Interpolación lineal simple
        jugador.pixelX += (jugador.dirX * TILE_SIZE) / jugador.velocidadAnim;
        jugador.pixelY += (jugador.dirY * TILE_SIZE) / jugador.velocidadAnim;

        if (jugador.frameActual >= jugador.velocidadAnim) {
            jugador.gridX += jugador.dirX;
            jugador.gridY += jugador.dirY;
            jugador.pixelX = jugador.gridX * TILE_SIZE;
            jugador.pixelY = jugador.gridY * TILE_SIZE;
            jugador.moviendo = false;
            
            // Comprobaciones tras terminar el paso
            chequearEventosMapa();
			comprobarTransicionBordes();
        }
    } else {
        actualizarMovimiento();
    }

    // 2. Cálculo de Cámara
    CAMERA.x = jugador.pixelX - (canvas.width / 2) + (TILE_SIZE / 2);
    CAMERA.y = jugador.pixelY - (canvas.height / 2) + (TILE_SIZE / 2);
    let mapa = MAPAS[mapaActual];
    CAMERA.x = Math.max(0, Math.min(CAMERA.x, (mapa[0].length * TILE_SIZE) - canvas.width));
    CAMERA.y = Math.max(0, Math.min(CAMERA.y, (mapa.length * TILE_SIZE) - canvas.height));

    // 3. Dibujado
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpiamos UNA sola vez

    if (modo === 'exploracion' || modo === 'pausa' || modo === 'ordenador' || modo === 'dialogo' || modo === 'alerta') {
        ctx.save();
        ctx.translate(-CAMERA.x, -CAMERA.y); // Aplicamos cámara

        // Dibujar Mapa
        for (let r = 0; r < mapa.length; r++) {
            for (let c = 0; c < mapa[r].length; c++) {
                ctx.drawImage(assets[mapa[r][c]] || assets[02], c * TILE_SIZE, r * TILE_SIZE);
            }
        }
        // Dibujar NPCs
        (NPCS[mapaActual] || []).forEach(npc => {
            ctx.fillStyle = npc.colCabeza; ctx.fillRect(npc.gridX * TILE_SIZE + 8, npc.gridY * TILE_SIZE + 4, 16, 12);
            ctx.fillStyle = npc.colCuerpo; ctx.fillRect(npc.gridX * TILE_SIZE + 6, npc.gridY * TILE_SIZE + 16, 20, 14);
            ctx.fillStyle = '#000'; ctx.fillRect(npc.gridX * TILE_SIZE + 10, npc.gridY * TILE_SIZE + 8, 3, 3);
            ctx.fillRect(npc.gridX * TILE_SIZE + 19, npc.gridY * TILE_SIZE + 8, 3, 3);
        });
        // Dibujar Jugador
        let spriteElegido = (jugador.estadoEstilo === 'surf') ? assets.playerSurf : (jugador.estadoEstilo === 'hielo' ? assets.playerHielo : assets.player);
        ctx.drawImage(spriteElegido, jugador.pixelX, jugador.pixelY);
        
        ctx.restore(); // Quitamos la cámara para poder dibujar el HUD
    } else if (modo === 'batalla') {
        ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath(); ctx.ellipse(120, 220, 80, 20, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(380, 110, 80, 20, 0, 0, Math.PI*2); ctx.fill();
        ctx.drawImage(assets.pkmnJugador, 80, 150);
        
        // DIBUJADO DINÁMICO DEL ENEMIGO O LA BOLA
        if (animacionCaptura) {
            let bx = 372; let by = 72;
            ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(bx, by, 16, Math.PI, 0); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(bx, by, 16, 0, Math.PI); ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = '#000';
            ctx.beginPath(); ctx.arc(bx, by, 16, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx - 16, by); ctx.lineTo(bx + 16, by); ctx.stroke();
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.drawImage(assets.pkmnEnemigo, 340, 40);
        }
	
        // --- HUD REFACTORIZADO Y UNIFICADO (EVITA SOBREESCRITURA DE TEXTO) ---
        ctx.fillStyle = '#000'; ctx.font = 'bold 14px Courier New';
        
        // 1. Datos e indicadores del Rival
        let txtEnemigo = `${enemigoActual.nombre.toUpperCase()} Nvl:${enemigoActual.nivel}`;
        //if(enemigoActual.estado !== 'OK') txtEnemigo += ` [${enemigoActual.estado.substring(0,3)}]`;
        ctx.fillText(txtEnemigo, 40, 45);
		// Barra de vida (usamos Math.max para que nunca sea negativa)
		let vidaEnemigo = Math.max(0, 120 * (enemigoActual.hp / enemigoActual.hpMax));
		ctx.fillStyle = enemigoActual.hp < enemigoActual.hpMax/4 ? '#f44336' : '#4caf50';
		ctx.fillRect(40, 55, vidaEnemigo, 6);
		
        // 2. Datos e indicadores de tu Pokémon activo
        ctx.fillStyle = '#000';
        let txtJugador = `${miPokemon.nombre.toUpperCase()} Nvl:${miPokemon.nivel}`;
        //if(miPokemon.estado !== 'OK') txtJugador += ` [${miPokemon.estado.substring(0,3)}]`;
        ctx.fillText(txtJugador, 300, 165);
        ctx.fillStyle = '#ddd'; ctx.fillRect(300, 175, 120, 6);
		let vidaJugador = Math.max(0, 120 * (miPokemon.hp / miPokemon.hpMax));
		ctx.fillStyle = miPokemon.hp < miPokemon.hpMax/4 ? '#f44336' : '#4caf50';
		ctx.fillRect(300, 175, vidaJugador, 6);
		ctx.fillText(`HP: ${miPokemon.hp}/${miPokemon.hpMax}`, 300, 195);
    }
    requestAnimationFrame(loop);
}

// Bloque de carga de persistencia desde LocalStorage
const partidaExistente = localStorage.getItem('pokemon_pro_save');
if (partidaExistente) {
    const datos = JSON.parse(partidaExistente);
    jugador.gridX = Math.floor(datos.jugadorX / TILE_SIZE);
    jugador.gridY = Math.floor(datos.jugadorY / TILE_SIZE);
    jugador.pixelX = jugador.gridX * TILE_SIZE;
    jugador.pixelY = jugador.gridY * TILE_SIZE;
    mapaActual = datos.mapa;
    inventario = datos.inventario;
    especiesAvistadas = datos.especiesAvistadas || { 'Charmander': true };
    
    equipo.length = 0;
    datos.equipo.forEach(p => equipo.push(p));
    
    caja.length = 0;
    if(datos.caja) datos.caja.forEach(p => caja.push(p));
    
    miPokemon = equipo[0];
	if (datos.musicaEncendida !== undefined) musicaEncendida = datos.musicaEncendida;
    if (datos.monedero !== undefined) monedero = datos.monedero;
    if (datos.objetosRecogidos) objetosRecogidos = datos.objetosRecogidos;
	if (datos.puntoReaparicion) puntoReaparicion = datos.puntoReaparicion;

    // NUEVO: Purgar los objetos del mapa que ya fueron recogidos en partidas anteriores
    for (let clave in objetosRecogidos) {
        let partes = clave.split('_');
        let mapaObj = partes[0];
        let gX = parseInt(partes[1]);
        let gY = parseInt(partes[2]);
        // Si el mapa existe y el bloque actual es una ball, lo reemplazamos por suelo (02)
        if (MAPAS[mapaObj] && MAPAS[mapaObj][gY] && MAPAS[mapaObj][gY][gX] === 74) {
            MAPAS[mapaObj][gY][gX] = 02; 
        }
    }
    
    console.log("¡Partida cargada con éxito!");
}

// Lanzamiento inicial de subprocesos
reproducirMusica('exploracion');
loop();