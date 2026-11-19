export const AETHELGARD_THEME = {
    id: 'aethelgard',
    title: 'Aethelgard: El Caldero Negro (3D Dark Fantasy)',
    heroName: 'Taron de Prydain',
    defaultBiomeId: 'MEADOW',
    initialLog: {
        time: 'Ciclo 1, 20:30',
        text: 'Despiertas en Caer Dallben. Al suroeste (-13, 9) se extiende una laguna marina profunda con un puerto y esquifes navegables.'
    },
    initialWaypoint: { tx: 2, ty: -2, label: 'Dallben el Vidente' },
    initialRelic: {
        name: 'Talismán de Luz Espectral',
        desc: 'Ilumina las tinieblas con el Bauble de Eilonwy (F).',
        icon: 'fa-wand-magic-sparkles'
    },
    harborNames: [
        'Muelle de Caer Dallben',
        'Puerto Bruma de Morva',
        'Atracadero del Alba',
        'Muelle de las Cumbres'
    ],
    biomes: {
        LAKE: {
            id: 'LAKE', name: 'Mar y Lagunas Espectrales',
            desc: 'Aguas que descienden desde orillas someras hasta abismos marinos donde puedes bucear.',
            mapColor: '#0e5a68', rgb: [14, 55, 62], fogHex: 0x091c22, speedMult: 1.0
        },
        MEADOW: {
            id: 'MEADOW', name: 'Valle de Caer Dallben',
            desc: 'Colinas de musgo húmedo, robles nudosos y bruma otoñal.',
            mapColor: '#274e37', rgb: [36, 72, 50], fogHex: 0x110c1d, speedMult: 1.0
        },
        FOREST: {
            id: 'FOREST', name: 'Pantanos de Morva',
            desc: 'Árboles retorcidos envueltos en niebla púrpura donde moran las brujas.',
            mapColor: '#361e4e', rgb: [46, 26, 68], fogHex: 0x190b28, speedMult: 0.92
        },
        DESERT: {
            id: 'DESERT', name: 'Páramos de Ceniza Ocre',
            desc: 'Tierras cobrizas azotadas por vientos arcanos y raíces petrificadas.',
            mapColor: '#6b4226', rgb: [95, 58, 34], fogHex: 0x1f120e, speedMult: 0.94
        },
        SNOW: {
            id: 'SNOW', name: 'Cumbres de Hueso Escarchado',
            desc: 'Picos góticos cubiertos de escarcha azulada y sombras abisales.',
            mapColor: '#7c98b3', rgb: [110, 134, 160], fogHex: 0x121b2b, speedMult: 0.88
        },
        RUINS: {
            id: 'RUINS', name: 'Dominios del Rey del Mal',
            desc: 'Roca negra afilada, fortalezas en ruinas y fulgor verde del Caldero.',
            mapColor: '#221c35', rgb: [32, 26, 48], fogHex: 0x081a14, speedMult: 0.96
        }
    },
    pointsOfInterest: [
        {
            id: 'npc_aldric', type: 'npc', name: 'Dallben el Vidente', role: 'Guardián de Caer Dallben',
            tx: 2, ty: -2, interacted: false, questTargetId: 'mono_dawn',
            dialog: '¡Escucha bien, joven Taron! El Rey del Mal busca el Caldero Negro para despertar a su ejército inmortal. Reúne las 8 Reliquias de Prydain, explora las 4 mazmorras y adéntrate incluso en las aguas profundas del suroeste (-13, 9). Tu primera visión arde al noreste (22, -18).',
            rewardGold: 35, rewardXp: 40
        },
        {
            id: 'npc_kaelen', type: 'npc', name: 'Fflewddur Fflam', role: 'Bardo Errante de los Pantanos',
            tx: -24, ty: -18, interacted: false, questTargetId: 'chest_2',
            dialog: '¡Por mis cuerdas mágicas! En lo profundo del Pantano de Morva (-42, -26) las brujas ocultaron el Arpa Veraz. ¡Y cuidado con los Nacidos del Caldero que patrullan entre las raíces!',
            rewardGold: 50, rewardXp: 45
        },
        {
            id: 'npc_zahra', type: 'npc', name: 'Gurgi el Explorador', role: 'Criatura del Bosque Oscuro',
            tx: 30, ty: 22, interacted: false, questTargetId: 'chest_3',
            dialog: '¡Crujidos y manzanas para el pobre Gurgi! Gurgi vio luces verdes hacia el sureste (46, 38). Allí reposa la legendaria espada Dyrnwyn.',
            rewardGold: 60, rewardXp: 50
        },
        {
            id: 'npc_torin', type: 'npc', name: 'Doli del Pueblo Bello', role: 'Centinela de las Cumbres',
            tx: -16, ty: 34, interacted: false, questTargetId: 'mono_frost',
            dialog: 'El ejército del Rey del Mal marcha bajo las tormentas del sur (-30, 48). Activa el Obelisco del Hielo Negro para despejar la niebla.',
            rewardGold: 70, rewardXp: 55
        },
        {
            id: 'mono_dawn', type: 'monolith', name: 'Caldero Rúnico del Alba', role: 'Santuario Espectral',
            tx: 22, ty: -18, interacted: false, relicName: 'Oráculo de Hen Wen',
            dialog: 'El vapor verde esmeralda se eleva en espiral del caldero ancestral. En sus brasas contemplas una visión profética que despeja la niebla de toda la comarca.',
            rewardGold: 75, rewardXp: 65
        },
        {
            id: 'mono_frost', type: 'monolith', name: 'Obelisco del Hielo Negro', role: 'Altar de las Cumbres',
            tx: -30, ty: 48, interacted: false, relicName: 'Cuerno de Gwyn el Cazador',
            dialog: 'Un destello púrpura y esmeralda estalla hacia el cielo, revelando las cumbres heladas y restaurando toda tu vitalidad y maná.',
            rewardGold: 90, rewardXp: 70
        },
        {
            id: 'mono_void', type: 'monolith', name: 'El Caldero Negro', role: 'Reliquia Suprema del Rey del Mal',
            tx: -44, ty: 12, interacted: false, relicName: 'Fragmento del Caldero Negro',
            dialog: 'Ante ti hierve el temido Caldero Negro. Canalizas la luz de tu hoja para sellar su maldición y extraes su núcleo arcano.',
            rewardGold: 140, rewardXp: 95
        },
        {
            id: 'chest_1', type: 'chest', name: 'Relicario del Roble Viejo', role: 'Tesoro de Caer Dallben',
            tx: 14, ty: 12, interacted: false, relicName: 'Bauble de Luz de Eilonwy',
            dialog: 'Dentro del cofre forjado brilla una esfera dorada que perteneció a la princesa Eilonwy.',
            rewardGold: 55, rewardXp: 45
        },
        {
            id: 'chest_2', type: 'chest', name: 'Arca de las Brujas de Morva', role: 'Reliquia del Pantano',
            tx: -42, ty: -26, interacted: false, relicName: 'Arpa Veraz de Fflewddur',
            dialog: 'Entre raíces pantanosas y niebla púrpura recuperas el instrumento encantado.',
            rewardGold: 85, rewardXp: 60
        },
        {
            id: 'chest_3', type: 'chest', name: 'Cofre del Páramo Ceniza', role: 'Reliquia Ocre',
            tx: 46, ty: 38, interacted: false, relicName: 'Sello de Dyrnwyn',
            dialog: '¡Hallaste el antiguo Sello de Dyrnwyn! Su fuego blanco-esmeralda desbloquea poder ancestral.',
            rewardGold: 100, rewardXp: 75
        },
        {
            id: 'chest_4', type: 'chest', name: 'Sarcófago de la Cumbre Norte', role: 'Reliquia Boreal',
            tx: 8, ty: -48, interacted: false, relicName: 'Corona del Rey Astado',
            dialog: 'En la fortaleza helada del norte neutralizas la corona de hierro y hueso.',
            rewardGold: 120, rewardXp: 85
        },
        {
            id: 'chest_5', type: 'chest', name: 'Cofre de la Ciudadela Caída', role: 'Reliquia Abisal',
            tx: 42, ty: -34, interacted: false, relicName: 'Espejo de las Sombras',
            dialog: 'Entre arcos góticos derruidos aseguras el Espejo de las Sombras.',
            rewardGold: 135, rewardXp: 90
        }
    ],
    dungeons: [
        {
            id: 'dng_roots', name: 'Cripta de las Raíces', levelReq: 1, tx: 9, ty: 6,
            accentColor: 0x10b981, bossName: 'Guardián de las Raíces', bossHp: 170,
            relicName: 'Raíz de Vida Eterna', rewardGold: 110, rewardXp: 140, cleared: false
        },
        {
            id: 'dng_morva', name: 'Catacumbas de Morva', levelReq: 2, tx: -28, ty: -20,
            accentColor: 0xa855f7, bossName: 'Espectro de las Brujas', bossHp: 240,
            relicName: 'Tijeras del Destino', rewardGold: 160, rewardXp: 190, cleared: false
        },
        {
            id: 'dng_frost', name: 'Caverna del Hielo Negro', levelReq: 3, tx: -20, ty: 40,
            accentColor: 0x38bdf8, bossName: 'Señor de la Escarcha', bossHp: 310,
            relicName: 'Corazón de Hielo Eterno', rewardGold: 220, rewardXp: 250, cleared: false
        },
        {
            id: 'dng_horned', name: 'Trono del Rey del Mal', levelReq: 4, tx: -38, ty: 10,
            accentColor: 0x22c55e, bossName: 'El Rey del Mal', bossHp: 440,
            relicName: 'Cetro del Caldero Negro', rewardGold: 350, rewardXp: 380, cleared: false
        }
    ],
    weapons: {
        apprentice_sword: {
            id: 'apprentice_sword', name: 'Espada de Aprendiz', desc: 'Acero ligero forjado en Caer Dallben.',
            damage: 26, range: 5.4, bladeColor: 0xa7f3d0, glowColor: 0x10b981, bladeLen: 1.35, bladeWidth: 0.08,
            cost: 0, icon: 'fa-khanda'
        },
        morva_greatsword: {
            id: 'morva_greatsword', name: 'Mandoble de Morva', desc: 'Hoja pesada imbuida con bruma carmesí.',
            damage: 42, range: 6.4, bladeColor: 0xfda4af, glowColor: 0xf43f5e, bladeLen: 1.85, bladeWidth: 0.14,
            cost: 120, icon: 'fa-gavel'
        },
        frost_axe: {
            id: 'frost_axe', name: 'Hacha Rúnica de Escarcha', desc: 'Filo boreal que emite tajos gélidos.',
            damage: 56, range: 6.1, bladeColor: 0xbae6fd, glowColor: 0x38bdf8, bladeLen: 1.6, bladeWidth: 0.22,
            cost: 210, icon: 'fa-hammer'
        },
        dyrnwyn: {
            id: 'dyrnwyn', name: 'Espada Real Dyrnwyn', desc: 'Fuego blanco-esmeralda legendario de Prydain.',
            damage: 78, range: 7.4, bladeColor: 0xd1fae5, glowColor: 0x34d399, bladeLen: 2.0, bladeWidth: 0.12,
            cost: 340, icon: 'fa-wand-magic-sparkles'
        }
    },
    potions: {
        health: {
            id: 'health', name: 'Poción de Sangre de Roble', desc: 'Restaura +55 de Vitalidad al instante.',
            cost: 30, icon: 'fa-flask', color: 'rose'
        },
        stamina: {
            id: 'stamina', name: 'Elixir de Vigor de Gurgi', desc: 'Restaura 100% Vigor y +25% velocidad (15s).',
            cost: 25, icon: 'fa-bottle-droplet', color: 'emerald'
        },
        magic: {
            id: 'magic', name: 'Elixir de Magia de Eilonwy', desc: '+50 Maná, +60% daño y Triple Salto (25s).',
            cost: 40, icon: 'fa-vial', color: 'purple'
        }
    },
    spells: [
        {
            id: 'emerald_bolt', name: 'Fuego Esmeralda', type: 'Ataque', reqLevel: 1, learnCostGold: 0,
            manaCost: 16, cooldown: 1.1, basePower: 42, icon: 'fa-fire-flame-curved', colorHex: 0x10b981,
            desc: 'Dispara orbes ígneos verdes que persiguen y explotan contra enemigos.'
        },
        {
            id: 'undine_breath', name: 'Aliento de las Ondinas', type: 'Buceo / Agua', reqLevel: 1, learnCostGold: 0,
            manaCost: 14, cooldown: 2.0, basePower: 35, icon: 'fa-lungs', colorHex: 0x22d3ee,
            desc: 'Restaura oxígeno al instante y reduce hasta un 85% el gasto de aire al bucear.'
        },
        {
            id: 'arcane_light', name: 'Luz Arcana de Eilonwy', type: 'Utilidad', reqLevel: 1, learnCostGold: 0,
            manaCost: 6, cooldown: 0.8, basePower: 14, icon: 'fa-wand-magic-sparkles', colorHex: 0xfde047,
            desc: 'Alterna la luz del Bauble y Dyrnwyn y revela la niebla cercana.'
        },
        {
            id: 'cauldron_storm', name: 'Tempestad del Caldero', type: 'Clima', reqLevel: 1, learnCostGold: 0,
            manaCost: 22, cooldown: 3.0, basePower: 52, icon: 'fa-cloud-bolt', colorHex: 0xa855f7,
            desc: 'Alterna tormenta espectral e invoca un rayo púrpura sobre el enemigo más cercano.'
        },
        {
            id: 'dallben_aegis', name: 'Égida de Caer Dallben', type: 'Protección', reqLevel: 2, learnCostGold: 60,
            manaCost: 28, cooldown: 6.0, basePower: 12, icon: 'fa-shield-halved', colorHex: 0x38bdf8,
            desc: 'Escudo 3D rúnico: reduce 75% el daño, regenera vida y repele atacantes.'
        },
        {
            id: 'morva_nova', name: 'Nova de Morva', type: 'Área', reqLevel: 2, learnCostGold: 75,
            manaCost: 30, cooldown: 4.0, basePower: 64, icon: 'fa-burst', colorHex: 0xc084fc,
            desc: 'Onda expansiva 360° que daña y arroja lejos a todos los enemigos cercanos.'
        },
        {
            id: 'frost_prison', name: 'Prisión de Escarcha', type: 'Control', reqLevel: 3, learnCostGold: 110,
            manaCost: 26, cooldown: 5.0, basePower: 48, icon: 'fa-snowflake', colorHex: 0x67e8f9,
            desc: 'Congela el área cercana, dañando y ralentizando un 70% a los enemigos (8s).'
        },
        {
            id: 'horned_judgment', name: 'Juicio del Rey Astado', type: 'Élite', reqLevel: 4, learnCostGold: 160,
            manaCost: 38, cooldown: 5.5, basePower: 92, icon: 'fa-bolt-lightning', colorHex: 0xf43f5e,
            desc: 'Descarga múltiples rayos carmesí que drenan vitalidad para curar a Taron.'
        },
        {
            id: 'cauldron_cataclysm', name: 'Cataclismo del Caldero', type: 'Supremo', reqLevel: 5, learnCostGold: 240,
            manaCost: 52, cooldown: 8.0, basePower: 145, icon: 'fa-skull', colorHex: 0x39ff14,
            desc: 'Desata un cataclismo esmeralda y púrpura devastador en gran radio.'
        }
    ]
};