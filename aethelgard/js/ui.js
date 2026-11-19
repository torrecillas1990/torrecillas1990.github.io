import {
    TILE_SIZE,
    WORLD_SCALE_3D,
    WORLD_TILES,
    HALF_WORLD,
    WATER_SURFACE_Y,
    SAVE_STORAGE_KEY,
    BIOMES,
    pointsOfInterest,
    DUNGEONS,
    DUNGEONS_DEF,
    WEAPONS_CATALOG,
    POTIONS_CATALOG,
    SPELLS_CATALOG,
    ART_STYLES_META,
    player,
    worldState,
    gameSettings,
    mapViewConfig
} from './config.js';
import {
    worldGrid,
    fogGrid,
    totalDiscoveredCells,
    incrementDiscoveredCells,
    getTileData,
    createToonGradientTexture
} from './escenarios.js';
import { sampleWorldHeight3D, harborDocks, navigableBoats } from './fisicas.js';
import {
    enemies3D,
    dungeonWorldGroup,
    setDungeonWorldGroup,
    applyEquippedWeaponVisuals,
    usePotion,
    cycleWeapon,
    getSpellEffectiveStats,
    castSpellById,
    cycleEquippedSpell
} from './objetos.js';

export const MODAL_IDS = ['dialogModal', 'pauseModal', 'inventoryModal', 'spellsModal', 'mapModal', 'journalModal'];

let minimapCanvas = null;
let minimapCtx = null;
let fullMapCanvas = null;
let fullMapCtx = null;
let reliefCanvas = null;
let reliefCtx = null;
let exploredCanvas = null;
let exploredCtx = null;
let cachedToonGradient = null;

export function isAnyModalOpen() {
    return MODAL_IDS.some(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
    });
}

export function closeAllModals() {
    MODAL_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); el.classList.remove('flex'); }
    });
    worldState.paused = false;
}

export function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const wasHidden = modal.classList.contains('hidden');
    closeAllModals();
    if (wasHidden) {
        if (document.pointerLockElement) {
            try { document.exitPointerLock(); } catch (_) {}
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        worldState.paused = (modalId === 'pauseModal');
        if (modalId === 'mapModal') renderFullMap();
        if (modalId === 'journalModal') renderJournalUI();
        if (modalId === 'inventoryModal') renderInventoryModalUI();
        if (modalId === 'spellsModal') renderSpellsModalUI();
        if (modalId === 'pauseModal') updateSaveStatusLabel();
    }
}

export function showToast(title, subtitle, icon = 'fa-wand-sparkles', colorClass = 'border-emerald-400 text-emerald-300') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast-anim gothic-panel px-4 py-2.5 rounded-2xl border-l-4 ${colorClass} flex items-center gap-3 shadow-2xl`;
    el.innerHTML = `
        <div class="w-8 h-8 rounded-xl bg-slate-900/90 border border-emerald-500/30 flex items-center justify-center text-base shrink-0">
            <i class="fa-solid ${icon}"></i>
        </div>
        <div class="min-w-0">
            <div class="font-gothic font-bold text-xs sm:text-sm text-white spectral-text-glow">${title}</div>
            <div class="text-[11px] text-slate-300 leading-snug">${subtitle}</div>
        </div>
    `;
    container.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 3950);
}

export function formatGameTime(hoursFloat) {
    const h = Math.floor(hoursFloat) % 24;
    const m = Math.floor((hoursFloat - Math.floor(hoursFloat)) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addLogEntry(text) {
    player.logs.unshift({ time: `Ciclo ${worldState.dayCount}, ${formatGameTime(worldState.timeOfDay)}`, text });
    if (player.logs.length > 40) player.logs.pop();
}

export function cycleWeather(silent = false) {
    worldState.weather = worldState.weather === 'CLEAR' ? 'RAIN' : 'CLEAR';
    const isStorm = worldState.weather === 'RAIN';
    document.getElementById('hudWeatherIcon').className = isStorm ? 'fa-solid fa-cloud-bolt text-purple-400' : 'fa-solid fa-smog text-emerald-300';
    document.getElementById('hudWeatherText').textContent = isStorm ? 'Tormenta' : 'Niebla';
    if (!silent) {
        showToast(isStorm ? 'Tormenta del Caldero' : 'Niebla de Prydain', isStorm ? 'Relámpagos púrpuras cubren el cielo.' : 'La tormenta amaina.', isStorm ? 'fa-cloud-bolt' : 'fa-smog');
    }
}

export function interactWithPOI(poi, { grantExperienceFn }) {
    const modal = document.getElementById('dialogModal');
    document.getElementById('dialogRole').textContent = poi.role;
    document.getElementById('dialogTitle').textContent = poi.name;
    document.getElementById('dialogText').textContent = poi.dialog;
    document.getElementById('dialogIconBox').innerHTML =
        poi.type === 'npc' ? '<i class="fa-solid fa-hat-wizard"></i>'
        : (poi.type === 'monolith' ? '<i class="fa-solid fa-fire-burner"></i>' : '<i class="fa-solid fa-gem"></i>');

    const rewardBox = document.getElementById('dialogRewardBox');
    const rewardText = document.getElementById('dialogRewardText');

    if (!poi.interacted) {
        poi.interacted = true;
        player.gold += poi.rewardGold || 35;
        player.hp = player.maxHp;
        player.mana = player.maxMana;
        player.stamina = player.maxStamina;
        grantExperienceFn(poi.rewardXp || 40);

        let msg = `+${poi.rewardGold} Oro • +${poi.rewardXp || 40} XP`;
        if (poi.relicName) {
            player.relics.push({
                name: poi.relicName,
                desc: `Hallado en ${poi.name} (${poi.tx}, ${poi.ty})`,
                icon: poi.type === 'monolith' ? 'fa-fire-flame-curved' : 'fa-wand-sparkles'
            });
            msg += ` • Reliquia: ${poi.relicName}`;
        }
        if (poi.type === 'monolith') revealFogAround(poi.tx, poi.ty, 24);

        rewardBox.classList.remove('hidden');
        rewardText.textContent = msg;
        addLogEntry(`Visitaste ${poi.name} en (${poi.tx}, ${poi.ty}).`);
        updateQuestTracker();
        updateHUDCounters();
    } else {
        rewardBox.classList.add('hidden');
    }

    const btnLocate = document.getElementById('btnDialogLocate');
    if (poi.questTargetId) {
        const targetObj = pointsOfInterest.find(p => p.id === poi.questTargetId);
        if (targetObj && !targetObj.interacted) {
            btnLocate.classList.remove('hidden');
            btnLocate.onclick = () => {
                player.waypoint = { tx: targetObj.tx, ty: targetObj.ty, label: targetObj.name };
                showToast('Visión Marcada', `Faro fijado en ${targetObj.name} (${targetObj.tx}, ${targetObj.ty})`, 'fa-location-dot');
                closeAllModals();
            };
        } else btnLocate.classList.add('hidden');
    } else btnLocate.classList.add('hidden');

    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (_) {} }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

export function updateQuestTracker() {
    const titleEl = document.getElementById('questTitleText');
    const subEl = document.getElementById('questSubText');
    const badgeEl = document.getElementById('questStepBadge');
    const dallben = pointsOfInterest.find(p => p.id === 'npc_aldric');
    const rem = pointsOfInterest.filter(p => (p.type === 'chest' || p.type === 'monolith') && !p.interacted);

    if (!dallben.interacted) {
        titleEl.textContent = 'Habla con Dallben el Vidente en Caer Dallben';
        subEl.textContent = 'Cerca de (2, -2). Laguna profunda al SO (-13, 9).';
        badgeEl.textContent = 'Prólogo';
    } else if (rem.length > 0) {
        const next = rem[0];
        const got = 8 - rem.length;
        titleEl.textContent = `Reúne las Reliquias de Prydain (${got}/8)`;
        subEl.textContent = `Explora (${next.tx}, ${next.ty}) para hallar ${next.name}.`;
        badgeEl.textContent = `${got}/8 Reliquias`;
    } else {
        titleEl.textContent = '¡El Caldero Negro ha sido Sellado!';
        subEl.textContent = 'Conquista las 4 mazmorras y las profundidades del mar.';
        badgeEl.textContent = 'Leyenda';
    }
}

export function updateHUDCounters() {
    const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    const mpPct = Math.max(0, Math.min(100, (player.mana / player.maxMana) * 100));
    const xpPct = Math.max(0, Math.min(100, (player.xp / player.xpToNext) * 100));

    document.getElementById('hudHealthBar').style.width = `${hpPct}%`;
    document.getElementById('hudHealthText').textContent = `${Math.round(player.hp)}/${player.maxHp}`;
    document.getElementById('hudManaBar').style.width = `${mpPct}%`;
    document.getElementById('hudManaText').textContent = `${Math.round(player.mana)}/${player.maxMana}`;
    document.getElementById('hudXpBar').style.width = `${xpPct}%`;
    document.getElementById('hudXpText').textContent = `${Math.round(player.xp)}/${player.xpToNext} XP`;

    document.getElementById('hudLevelBadge').textContent = `Nvl. ${player.level}`;
    document.getElementById('hudGold').textContent = player.gold;
    document.getElementById('hudKills').textContent = player.kills;
    document.getElementById('hudRelics').textContent = `${Math.max(0, player.relics.length - 1)}/8`;

    document.getElementById('qbHealthQty').textContent = player.potions.health;
    document.getElementById('qbStaminaQty').textContent = player.potions.stamina;
    document.getElementById('qbMagicQty').textContent = player.potions.magic;

    const sp = SPELLS_CATALOG.find(s => s.id === player.equippedSpellId) || SPELLS_CATALOG[0];
    const stats = getSpellEffectiveStats(sp);
    document.getElementById('qbSpellIcon').className = `fa-solid ${sp.icon} text-emerald-300 text-base pl-1`;
    document.getElementById('qbSpellName').textContent = sp.name;
    document.getElementById('qbSpellMeta').textContent = `Nvl.${stats.lvl} • ${stats.manaCost} MP`;

    const heldBadge = document.getElementById('hudHeldBadge');
    if (player.heldObject) {
        heldBadge.classList.remove('hidden');
        heldBadge.innerHTML = `<i class="fa-solid fa-hand-fist mr-1"></i>${player.heldObject.name} (Clic Izq: Lanzar)`;
    } else {
        heldBadge.classList.add('hidden');
    }

    const buffBadge = document.getElementById('hudBuffBadge');
    const buffs = [];
    if (player.aegisTimer > 0) buffs.push(`Égida ${Math.ceil(player.aegisTimer)}s`);
    if (player.magicBuffTimer > 0) buffs.push(`Arcano ${Math.ceil(player.magicBuffTimer)}s`);
    if (player.speedBuffTimer > 0) buffs.push(`Vel. ${Math.ceil(player.speedBuffTimer)}s`);
    if (player.undineBreathTimer > 0) buffs.push(`Ondinas ${Math.ceil(player.undineBreathTimer)}s`);
    if (buffs.length > 0) {
        buffBadge.classList.remove('hidden');
        buffBadge.textContent = buffs.join(' • ');
    } else {
        buffBadge.classList.add('hidden');
    }
}

export function renderInventoryModalUI(scene) {
    document.getElementById('invGoldDisplay').textContent = player.gold;
    const potList = document.getElementById('invPotionsList');
    potList.innerHTML = '';
    const cb = {
        showToast,
        updateHUDCounters,
        renderInventoryModalUI: () => renderInventoryModalUI(scene)
    };

    Object.values(POTIONS_CATALOG).forEach(pot => {
        const qty = player.potions[pot.id] || 0;
        const div = document.createElement('div');
        div.className = 'p-3 rounded-xl bg-slate-900/80 border border-purple-800/50 flex items-center justify-between gap-2';
        div.innerHTML = `
            <div class="min-w-0">
                <div class="text-xs font-bold text-white flex items-center gap-1.5">
                    <i class="fa-solid ${pot.icon} text-${pot.color}-400"></i> ${pot.name}
                    <span class="font-mono text-emerald-300 bg-slate-950 px-1.5 py-0.5 rounded text-[10px]">x${qty}</span>
                </div>
                <div class="text-[11px] text-slate-400 mt-0.5">${pot.desc}</div>
            </div>
            <div class="flex flex-col gap-1 shrink-0">
                <button data-use="${pot.id}" class="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-500/40 border border-emerald-400/50 text-[10px] font-bold text-emerald-200 cursor-pointer">Beber</button>
                <button data-buy="${pot.id}" class="px-2.5 py-1 rounded-lg bg-amber-600/25 hover:bg-amber-500/35 border border-amber-400/50 text-[10px] font-bold text-amber-200 cursor-pointer">+1 (${pot.cost}g)</button>
            </div>
        `;
        potList.appendChild(div);
    });

    potList.querySelectorAll('[data-use]').forEach(btn => {
        btn.onclick = () => usePotion(scene, btn.getAttribute('data-use'), cb);
    });
    potList.querySelectorAll('[data-buy]').forEach(btn => {
        btn.onclick = () => {
            const id = btn.getAttribute('data-buy');
            const cost = POTIONS_CATALOG[id].cost;
            if (player.gold < cost) {
                showToast('Oro Insuficiente', `Necesitas ${cost} monedas de oro.`, 'fa-coins', 'border-rose-400 text-rose-300');
                return;
            }
            player.gold -= cost;
            player.potions[id]++;
            updateHUDCounters();
            renderInventoryModalUI(scene);
        };
    });

    const weapList = document.getElementById('invWeaponsList');
    weapList.innerHTML = '';
    Object.values(WEAPONS_CATALOG).forEach(w => {
        const owned = player.ownedWeapons.includes(w.id);
        const equipped = player.equippedWeapon === w.id;
        const div = document.createElement('div');
        div.className = `p-3 rounded-xl border flex items-center justify-between gap-2 ${equipped ? 'bg-emerald-950/50 border-emerald-400' : 'bg-slate-900/80 border-purple-800/50'}`;
        div.innerHTML = `
            <div class="min-w-0">
                <div class="text-xs font-bold text-white flex items-center gap-1.5">
                    <i class="fa-solid ${w.icon} text-amber-300"></i> ${w.name}
                </div>
                <div class="text-[11px] text-slate-400 mt-0.5">${w.desc}</div>
                <div class="text-[10px] font-mono text-amber-300 mt-1">Daño Base: ${w.damage} • Alcance: ${w.range}m</div>
            </div>
            <button data-weapon="${w.id}" class="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer ${equipped ? 'bg-emerald-500 text-slate-950' : (owned ? 'bg-purple-600/35 hover:bg-purple-500/45 text-purple-100 border border-purple-400/50' : 'bg-amber-600/30 hover:bg-amber-500/40 text-amber-200 border border-amber-400/50')}">
                ${equipped ? 'Equipada' : (owned ? 'Equipar' : `Forjar (${w.cost}g)`)}
            </button>
        `;
        weapList.appendChild(div);
    });

    weapList.querySelectorAll('[data-weapon]').forEach(btn => {
        btn.onclick = () => {
            const id = btn.getAttribute('data-weapon');
            const w = WEAPONS_CATALOG[id];
            if (player.ownedWeapons.includes(id)) {
                player.equippedWeapon = id;
                applyEquippedWeaponVisuals();
                renderInventoryModalUI(scene);
            } else {
                if (player.gold < w.cost) {
                    showToast('Oro Insuficiente', `Necesitas ${w.cost} monedas para forjar ${w.name}.`, 'fa-coins', 'border-rose-400 text-rose-300');
                    return;
                }
                player.gold -= w.cost;
                player.ownedWeapons.push(id);
                player.equippedWeapon = id;
                applyEquippedWeaponVisuals();
                updateHUDCounters();
                renderInventoryModalUI(scene);
                showToast('Arma Forjada', `Has equipado ${w.name}.`, 'fa-khanda');
            }
        };
    });
}

export function renderSpellsModalUI() {
    document.getElementById('spellHeroLevel').textContent = player.level;
    document.getElementById('spellXpDisplay').textContent = `${player.spendableXp} XP`;
    document.getElementById('spellGoldDisplay').textContent = `${player.gold}g`;

    const grid = document.getElementById('spellsGrid');
    grid.innerHTML = '';

    SPELLS_CATALOG.forEach(sp => {
        const unlocked = player.unlockedSpells.includes(sp.id);
        const equipped = player.equippedSpellId === sp.id;
        const { lvl, power, manaCost } = getSpellEffectiveStats(sp);
        const upgradeCostXp = lvl * 55;
        const meetsLevel = player.level >= sp.reqLevel;

        const stars = '★'.repeat(lvl) + '☆'.repeat(5 - lvl);
        const card = document.createElement('div');
        card.className = `p-3.5 rounded-2xl border flex flex-col justify-between gap-2.5 ${equipped ? 'bg-purple-950/60 border-emerald-400' : (unlocked ? 'bg-slate-900/85 border-purple-800/60' : 'bg-slate-950/70 border-slate-800')}`;
        card.innerHTML = `
            <div>
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <div class="w-9 h-9 rounded-xl bg-slate-950 border border-purple-500/40 flex items-center justify-center text-emerald-300">
                            <i class="fa-solid ${sp.icon}"></i>
                        </div>
                        <div>
                            <div class="text-xs font-bold text-white">${sp.name}</div>
                            <div class="text-[10px] text-purple-300">${sp.type} • Req. Nvl ${sp.reqLevel}</div>
                        </div>
                    </div>
                    <span class="text-amber-300 text-xs tracking-wider">${unlocked ? stars : 'Bloqueado'}</span>
                </div>
                <p class="text-[11px] text-slate-300 mt-2">${sp.desc}</p>
                <div class="text-[10px] font-mono text-emerald-300 mt-1.5">Poder: ${power} • Coste: ${manaCost} MP • Maestría Nvl.${lvl}/5</div>
            </div>
            <div class="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                ${unlocked ? `
                    <button data-equip-spell="${sp.id}" class="flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer ${equipped ? 'bg-emerald-500 text-slate-950' : 'bg-purple-600/35 hover:bg-purple-500/45 text-purple-100 border border-purple-400/50'}">
                        ${equipped ? 'Equipado (G)' : 'Equipar'}
                    </button>
                    ${lvl < 5 ? `
                        <button data-upgrade-spell="${sp.id}" class="flex-1 py-1.5 px-2.5 rounded-lg bg-amber-600/25 hover:bg-amber-500/40 border border-amber-400/50 text-amber-200 text-[11px] font-bold cursor-pointer">
                            Mejorar (${upgradeCostXp} XP)
                        </button>
                    ` : '<span class="text-[10px] font-bold text-amber-300 px-2">MÁX</span>'}
                ` : `
                    <button data-learn-spell="${sp.id}" class="w-full py-1.5 px-3 rounded-lg text-[11px] font-bold cursor-pointer ${meetsLevel ? 'bg-emerald-600/30 hover:bg-emerald-500/40 text-emerald-200 border border-emerald-400/50' : 'bg-slate-900 text-slate-500 border border-slate-800'}">
                        ${meetsLevel ? `Aprender (${sp.learnCostGold}g)` : `Requiere Nivel de Héroe ${sp.reqLevel}`}
                    </button>
                `}
            </div>
        `;
        grid.appendChild(card);
    });

    grid.querySelectorAll('[data-equip-spell]').forEach(btn => {
        btn.onclick = () => {
            player.equippedSpellId = btn.getAttribute('data-equip-spell');
            updateHUDCounters();
            renderSpellsModalUI();
        };
    });
    grid.querySelectorAll('[data-learn-spell]').forEach(btn => {
        btn.onclick = () => {
            const id = btn.getAttribute('data-learn-spell');
            const sp = SPELLS_CATALOG.find(s => s.id === id);
            if (player.level < sp.reqLevel) {
                showToast('Nivel Insuficiente', `Alcanza el Nivel ${sp.reqLevel} para aprender ${sp.name}.`, 'fa-lock', 'border-rose-400 text-rose-300');
                return;
            }
            if (player.gold < sp.learnCostGold) {
                showToast('Oro Insuficiente', `Necesitas ${sp.learnCostGold} monedas de oro.`, 'fa-coins', 'border-rose-400 text-rose-300');
                return;
            }
            player.gold -= sp.learnCostGold;
            player.unlockedSpells.push(id);
            player.equippedSpellId = id;
            updateHUDCounters();
            renderSpellsModalUI();
            showToast('Hechizo Aprendido', `${sp.name} añadido a tu Grimorio.`, sp.icon);
        };
    });
    grid.querySelectorAll('[data-upgrade-spell]').forEach(btn => {
        btn.onclick = () => {
            const id = btn.getAttribute('data-upgrade-spell');
            const curLvl = player.spellLevels[id] || 1;
            const costXp = curLvl * 55;
            if (player.spendableXp < costXp) {
                showToast('XP Insuficiente', `Necesitas ${costXp} XP disponible. Derrota enemigos o explora para ganar XP.`, 'fa-star', 'border-amber-400 text-amber-300');
                return;
            }
            player.spendableXp -= costXp;
            player.spellLevels[id] = curLvl + 1;
            updateHUDCounters();
            renderSpellsModalUI();
            showToast('Hechizo Mejorado', `Maestría elevada a Nivel ${curLvl + 1}.`, 'fa-wand-sparkles');
        };
    });
}

export function renderJournalUI() {
    document.getElementById('journalRelicCount').textContent = `${Math.max(0, player.relics.length - 1)}/8`;
    document.getElementById('journalBiomeCount').textContent = `${player.visitedBiomes.size}/6`;

    const invC = document.getElementById('inventoryList');
    invC.innerHTML = '';
    player.relics.forEach(item => {
        const div = document.createElement('div');
        div.className = 'p-2.5 rounded-xl bg-slate-900/80 border border-purple-800/50 flex items-center gap-2.5';
        div.innerHTML = `
            <div class="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0"><i class="fa-solid ${item.icon}"></i></div>
            <div class="min-w-0">
                <div class="text-xs font-bold text-white truncate">${item.name}</div>
                <div class="text-[10px] text-slate-400">${item.desc}</div>
            </div>`;
        invC.appendChild(div);
    });

    const bioC = document.getElementById('biomeList');
    bioC.innerHTML = '';
    Object.values(BIOMES).forEach(b => {
        const v = player.visitedBiomes.has(b.id);
        const div = document.createElement('div');
        div.className = `p-2.5 rounded-xl border flex items-center gap-2.5 ${v ? 'bg-slate-900/80 border-emerald-500/40' : 'bg-slate-950/50 border-slate-800 opacity-50'}`;
        div.innerHTML = `
            <span class="w-5 h-5 rounded-md shrink-0 border border-white/20" style="background:${b.mapColor}"></span>
            <div class="min-w-0">
                <div class="text-xs font-bold text-white">${v ? b.name : 'Región Inexplorada'}</div>
                <div class="text-[10px] text-slate-400">${v ? b.desc : 'Explora la niebla para descubrirla.'}</div>
            </div>`;
        bioC.appendChild(div);
    });

    const logC = document.getElementById('discoveryLogList');
    logC.innerHTML = '';
    player.logs.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'p-2 rounded-xl bg-slate-900/60 border border-purple-900/40';
        div.innerHTML = `<div class="text-[10px] text-emerald-400 font-mono">${entry.time}</div><div class="text-slate-200 mt-0.5">${entry.text}</div>`;
        logC.appendChild(div);
    });
}

export function buildSaveObject() {
    return {
        v: 4,
        savedAt: new Date().toLocaleTimeString(),
        player: {
            x: Math.round(player.x), y: Math.round(player.y),
            hp: Math.round(player.hp), maxHp: player.maxHp,
            mana: Math.round(player.mana), maxMana: player.maxMana,
            stamina: Math.round(player.stamina), oxygen: Math.round(player.oxygen),
            level: player.level, xp: player.xp, xpToNext: player.xpToNext, spendableXp: player.spendableXp,
            gold: player.gold, kills: player.kills,
            potions: player.potions, ownedWeapons: player.ownedWeapons, equippedWeapon: player.equippedWeapon,
            unlockedSpells: player.unlockedSpells, spellLevels: player.spellLevels, equippedSpellId: player.equippedSpellId,
            relics: player.relics, visitedBiomes: Array.from(player.visitedBiomes), waypoint: player.waypoint
        },
        world: {
            timeOfDay: worldState.timeOfDay, dayCount: worldState.dayCount, weather: worldState.weather,
            interactedPois: pointsOfInterest.filter(p => p.interacted).map(p => p.id),
            clearedDungeons: DUNGEONS_DEF.filter(d => d.cleared).map(d => d.id)
        },
        settings: gameSettings
    };
}

export function applySaveObject(data, scene, applyArtisticStyleFn) {
    if (!data || !data.player) return false;
    worldState.activeDungeon = null;
    if (dungeonWorldGroup) {
        scene.remove(dungeonWorldGroup);
        setDungeonWorldGroup(null);
    }

    player.x = data.player.x ?? 0;
    player.y = data.player.y ?? 0;
    const hx = (player.x / TILE_SIZE) * WORLD_SCALE_3D;
    const hz = (player.y / TILE_SIZE) * WORLD_SCALE_3D;
    player.y3D = Math.max(WATER_SURFACE_Y + 0.2, sampleWorldHeight3D(hx, hz));
    player.vy3D = 0;
    player.hp = data.player.hp ?? 100;
    player.maxHp = data.player.maxHp ?? 100;
    player.mana = data.player.mana ?? 100;
    player.maxMana = data.player.maxMana ?? 100;
    player.stamina = data.player.stamina ?? 100;
    player.oxygen = data.player.oxygen ?? 100;
    player.isDiving = false; player.isSwimming = false;
    player.level = data.player.level ?? 1;
    player.xp = data.player.xp ?? 0;
    player.xpToNext = data.player.xpToNext ?? 100;
    player.spendableXp = data.player.spendableXp ?? 0;
    player.gold = data.player.gold ?? 90;
    player.kills = data.player.kills ?? 0;
    if (data.player.potions) player.potions = { ...player.potions, ...data.player.potions };
    if (Array.isArray(data.player.ownedWeapons)) player.ownedWeapons = data.player.ownedWeapons;
    if (data.player.equippedWeapon) player.equippedWeapon = data.player.equippedWeapon;
    if (Array.isArray(data.player.unlockedSpells)) player.unlockedSpells = data.player.unlockedSpells;
    if (data.player.spellLevels) player.spellLevels = { ...player.spellLevels, ...data.player.spellLevels };
    if (data.player.equippedSpellId) player.equippedSpellId = data.player.equippedSpellId;
    if (Array.isArray(data.player.relics)) player.relics = data.player.relics;
    if (Array.isArray(data.player.visitedBiomes)) player.visitedBiomes = new Set(data.player.visitedBiomes);
    player.waypoint = data.player.waypoint || null;

    if (data.world) {
        worldState.timeOfDay = data.world.timeOfDay ?? 20.5;
        worldState.dayCount = data.world.dayCount ?? 1;
        worldState.weather = data.world.weather ?? 'CLEAR';
        const ip = new Set(data.world.interactedPois || []);
        pointsOfInterest.forEach(p => { p.interacted = ip.has(p.id); });
        const cd = new Set(data.world.clearedDungeons || []);
        DUNGEONS_DEF.forEach(d => { d.cleared = cd.has(d.id); });
    }
    if (data.settings) {
        Object.assign(gameSettings, data.settings);
        if (typeof applyArtisticStyleFn === 'function') applyArtisticStyleFn(gameSettings.artStyle, true);
        applyGraphicsSettings();
    }
    revealFogAround(Math.round(player.x / TILE_SIZE), Math.round(player.y / TILE_SIZE), 12);
    applyEquippedWeaponVisuals();
    updateQuestTracker();
    updateHUDCounters();
    return true;
}

export function updateSaveStatusLabel() {
    const lbl = document.getElementById('saveStatusText');
    try {
        const raw = localStorage.getItem(SAVE_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            lbl.textContent = `Guardado (${parsed.savedAt || 'OK'})`;
            lbl.className = 'text-[10px] font-mono text-emerald-300';
        } else {
            lbl.textContent = 'Sin guardado local';
            lbl.className = 'text-[10px] font-mono text-slate-400';
        }
    } catch (_) {
        lbl.textContent = 'Almacenamiento limitado';
    }
}

export function applyGraphicsSettings(renderer, camera, groundMistParticles) {
    if (!renderer || !camera) return;
    camera.fov = gameSettings.fov;
    camera.updateProjectionMatrix();
    worldState.camDist = gameSettings.camDist;
    renderer.toneMappingExposure = gameSettings.exposure;
    renderer.shadowMap.enabled = gameSettings.shadows;
    if (gameSettings.artStyle === 'ps1') {
        renderer.setPixelRatio(0.45);
    } else {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, gameSettings.highDpi ? 2 : 1));
    }
    if (groundMistParticles) groundMistParticles.visible = gameSettings.particles;
    const vig = document.getElementById('cinematicOverlay');
    if (vig) vig.style.opacity = gameSettings.vignette ? '1' : '0';

    document.getElementById('valSensitivity').textContent = `${gameSettings.mouseSensitivity.toFixed(1)}x`;
    document.getElementById('valFov').textContent = `${gameSettings.fov}°`;
    document.getElementById('valCamDist').textContent = `${gameSettings.camDist}m`;
    document.getElementById('valExposure').textContent = gameSettings.exposure.toFixed(2);
    document.getElementById('valFog').textContent = `${gameSettings.fogMultiplier.toFixed(1)}x`;
}

export function applyArtisticStyle(styleKey, silent = false, { renderer, scene, terrainMeshRef, treeCrownInstRef, ambientLight, dirLight, pbrTex }) {
    if (!ART_STYLES_META[styleKey]) styleKey = 'cgi1985';
    gameSettings.artStyle = styleKey;
    const meta = ART_STYLES_META[styleKey];

    document.body.classList.remove('style-cgi1985', 'style-toon', 'style-oil', 'style-ps1');
    document.body.classList.add(`style-${styleKey}`);

    const hudLbl = document.getElementById('hudArtStyleLabel');
    if (hudLbl) hudLbl.textContent = meta.label;

    document.querySelectorAll('.art-style-btn').forEach(btn => {
        const isSelected = btn.getAttribute('data-art-style') === styleKey;
        btn.className = isSelected
            ? 'art-style-btn py-1.5 px-2 rounded-lg border border-emerald-400 bg-emerald-500/20 text-emerald-200 font-bold text-left transition cursor-pointer'
            : 'art-style-btn py-1.5 px-2 rounded-lg border border-slate-700 bg-slate-950/70 text-slate-300 hover:border-purple-400 font-semibold text-left transition cursor-pointer';
    });

    if (!renderer || !scene) return;

    scene.traverse(obj => {
        if (obj.userData && obj.userData.isToonOutline) obj.visible = (styleKey === 'toon');
    });

    if (styleKey === 'ps1') {
        renderer.setPixelRatio(0.45);
    } else {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, gameSettings.highDpi ? 2 : 1));
    }

    if (!cachedToonGradient) cachedToonGradient = createToonGradientTexture();

    if (terrainMeshRef) {
        if (styleKey === 'toon') {
            terrainMeshRef.material = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: cachedToonGradient });
        } else if (styleKey === 'oil') {
            terrainMeshRef.material = new THREE.MeshStandardMaterial({
                vertexColors: true, map: pbrTex.terrain, bumpMap: pbrTex.terrain, bumpScale: 0.24,
                roughness: 0.94, metalness: 0.02, flatShading: false
            });
        } else if (styleKey === 'ps1') {
            terrainMeshRef.material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
        } else {
            terrainMeshRef.material = new THREE.MeshStandardMaterial({
                vertexColors: true, map: pbrTex.terrain, bumpMap: pbrTex.terrain, bumpScale: 0.14,
                roughness: 0.86, metalness: 0.08, flatShading: true
            });
        }
    }

    if (treeCrownInstRef) {
        treeCrownInstRef.material.flatShading = (styleKey === 'ps1' || styleKey === 'cgi1985');
        treeCrownInstRef.material.needsUpdate = true;
    }

    if (styleKey === 'toon') {
        ambientLight.intensity = 1.15; dirLight.intensity = 1.45; gameSettings.fogMultiplier = 0.65;
    } else if (styleKey === 'oil') {
        ambientLight.intensity = 0.95; dirLight.color.setHex(0xfde68a); dirLight.intensity = 1.38; gameSettings.fogMultiplier = 0.85;
    } else if (styleKey === 'ps1') {
        ambientLight.intensity = 0.85; dirLight.color.setHex(0xc4b5fd); dirLight.intensity = 1.1; gameSettings.fogMultiplier = 1.25;
    } else {
        ambientLight.intensity = 0.78; dirLight.color.setHex(0xa78bfa); dirLight.intensity = 1.25; gameSettings.fogMultiplier = 1.0;
    }

    const fogSlider = document.getElementById('optFog');
    const valFog = document.getElementById('valFog');
    if (fogSlider) fogSlider.value = gameSettings.fogMultiplier;
    if (valFog) valFog.textContent = `${gameSettings.fogMultiplier.toFixed(1)}x`;

    if (!silent) {
        showToast(`Estilo: ${meta.fullName}`, meta.desc, 'fa-palette', 'border-fuchsia-400 text-fuchsia-200');
    }
}

export function cycleArtisticStyle(ctx) {
    const order = ['cgi1985', 'toon', 'oil', 'ps1'];
    const nextIdx = (order.indexOf(gameSettings.artStyle) + 1) % order.length;
    applyArtisticStyle(order[nextIdx], false, ctx);
}

export function initMapCanvases() {
    minimapCanvas = document.getElementById('minimapCanvas');
    minimapCtx = minimapCanvas.getContext('2d');
    fullMapCanvas = document.getElementById('fullMapCanvas');
    fullMapCtx = fullMapCanvas.getContext('2d');

    reliefCanvas = document.createElement('canvas');
    reliefCanvas.width = WORLD_TILES; reliefCanvas.height = WORLD_TILES;
    reliefCtx = reliefCanvas.getContext('2d');

    exploredCanvas = document.createElement('canvas');
    exploredCanvas.width = WORLD_TILES; exploredCanvas.height = WORLD_TILES;
    exploredCtx = exploredCanvas.getContext('2d');
}

export function computeTopographicTileColor(gx, gy) {
    const tile = worldGrid[gx][gy];
    if (tile.height3D < WATER_SURFACE_Y) {
        const depth = WATER_SURFACE_Y - tile.height3D;
        const dt = Math.min(1, depth / 7.5);
        const r = Math.round(32 * (1 - dt) + 5 * dt);
        const g = Math.round(135 * (1 - dt) + 28 * dt);
        const b = Math.round(145 * (1 - dt) + 54 * dt);
        return `rgb(${r},${g},${b})`;
    }
    const hL = gx > 0 ? worldGrid[gx - 1][gy].height3D : tile.height3D;
    const hU = gy > 0 ? worldGrid[gx][gy - 1].height3D : tile.height3D;
    const slope = (tile.height3D - hL) + (tile.height3D - hU);
    const light = Math.max(0.62, Math.min(1.42, 1.0 + slope * 0.25));
    const r = Math.min(255, Math.round(tile.biome.rgb[0] * 1.32 * light));
    const g = Math.min(255, Math.round(tile.biome.rgb[1] * 1.32 * light));
    const b = Math.min(255, Math.round(tile.biome.rgb[2] * 1.32 * light));
    return `rgb(${r},${g},${b})`;
}

export function bakeWorldReliefMap() {
    const img = reliefCtx.createImageData(WORLD_TILES, WORLD_TILES);
    const data = img.data;
    for (let gx = 0; gx < WORLD_TILES; gx++) {
        for (let gy = 0; gy < WORLD_TILES; gy++) {
            const tile = worldGrid[gx][gy];
            const idx = (gy * WORLD_TILES + gx) * 4;
            let r, g, b;

            if (tile.height3D < WATER_SURFACE_Y) {
                const depth = WATER_SURFACE_Y - tile.height3D;
                const dt = Math.min(1, depth / 7.5);
                r = Math.round(32 * (1 - dt) + 5 * dt);
                g = Math.round(135 * (1 - dt) + 28 * dt);
                b = Math.round(145 * (1 - dt) + 54 * dt);
            } else {
                const hL = gx > 0 ? worldGrid[gx - 1][gy].height3D : tile.height3D;
                const hU = gy > 0 ? worldGrid[gx][gy - 1].height3D : tile.height3D;
                const slope = (tile.height3D - hL) + (tile.height3D - hU);
                const light = Math.max(0.62, Math.min(1.42, 1.0 + slope * 0.25));
                r = Math.min(255, Math.round(tile.biome.rgb[0] * 1.32 * light));
                g = Math.min(255, Math.round(tile.biome.rgb[1] * 1.32 * light));
                b = Math.min(255, Math.round(tile.biome.rgb[2] * 1.32 * light));
            }
            data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
        }
    }
    reliefCtx.putImageData(img, 0, 0);
    exploredCtx.fillStyle = '#070510';
    exploredCtx.fillRect(0, 0, WORLD_TILES, WORLD_TILES);
}

export function revealFogAround(centerTx, centerTy, radius = 11) {
    const rSq = radius * radius;
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
            if (dx * dx + dy * dy <= rSq) {
                const gx = centerTx + dx + HALF_WORLD;
                const gy = centerTy + dy + HALF_WORLD;
                if (gx >= 0 && gx < WORLD_TILES && gy >= 0 && gy < WORLD_TILES) {
                    if (fogGrid[gx][gy] === 0) {
                        fogGrid[gx][gy] = 1;
                        incrementDiscoveredCells();
                        exploredCtx.fillStyle = computeTopographicTileColor(gx, gy);
                        exploredCtx.fillRect(gx, gy, 1, 1);
                    }
                }
            }
        }
    }
    const pct = Math.min(100, (totalDiscoveredCells / (WORLD_TILES * WORLD_TILES)) * 100).toFixed(1);
    const expText = document.getElementById('hudExploredText');
    const expBar = document.getElementById('hudExploredBar');
    if (expText) expText.textContent = `${pct}%`;
    if (expBar) expBar.style.width = `${Math.max(1, pct)}%`;
}

function drawPlayerDirectionMarker(ctx, x, y, size = 6) {
    const camForwardX = -Math.sin(worldState.camYaw);
    const camForwardZ = -Math.cos(worldState.camYaw);
    const camLookAngle = Math.atan2(camForwardZ, camForwardX);

    const heroForwardX = Math.sin(player.rotationY);
    const heroForwardZ = Math.cos(player.rotationY);
    const heroLookAngle = Math.atan2(heroForwardZ, heroForwardX);

    ctx.save();
    ctx.translate(x, y);

    const coneRadius = size * 4.8;
    const halfFov = 0.48;
    const grad = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, coneRadius);
    grad.addColorStop(0, 'rgba(52, 211, 153, 0.65)');
    grad.addColorStop(0.55, 'rgba(16, 185, 129, 0.28)');
    grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, coneRadius, camLookAngle - halfFov, camLookAngle + halfFov);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(110, 231, 183, 0.78)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(camLookAngle - halfFov) * coneRadius, Math.sin(camLookAngle - halfFov) * coneRadius);
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(camLookAngle + halfFov) * coneRadius, Math.sin(camLookAngle + halfFov) * coneRadius);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(253, 224, 71, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(camLookAngle) * (coneRadius * 0.85), Math.sin(camLookAngle) * (coneRadius * 0.85));
    ctx.stroke();

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.55, 0, Math.PI * 2);
    ctx.stroke();

    ctx.rotate(heroLookAngle);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(size * 1.65, 0);
    ctx.lineTo(-size * 1.05, -size * 0.95);
    ctx.lineTo(-size * 0.48, 0);
    ctx.lineTo(-size * 1.05, size * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

export function renderMinimap() {
    if (!minimapCtx) return;
    if (worldState.activeDungeon) {
        const dng = worldState.activeDungeon;
        minimapCtx.fillStyle = '#07040e';
        minimapCtx.fillRect(0, 0, 160, 160);

        minimapCtx.strokeStyle = '#a855f7';
        minimapCtx.lineWidth = 2;
        minimapCtx.strokeRect(26, 16, 108, 128);

        minimapCtx.fillStyle = '#34d399';
        minimapCtx.fillRect(70, 136, 20, 6);

        minimapCtx.fillStyle = dng.chestOpened ? '#64748b' : '#facc15';
        minimapCtx.fillRect(74, 22, 12, 10);

        const hero3DX = (player.x / TILE_SIZE) * WORLD_SCALE_3D;
        const hero3DZ = (player.y / TILE_SIZE) * WORLD_SCALE_3D;
        enemies3D.forEach(en => {
            if (en.dead || !en.isDungeon) return;
            const nx = 80 + (en.x / 14) * 50;
            const nz = 80 + (en.z / 27) * 60;
            minimapCtx.fillStyle = en.isBoss ? '#c084fc' : '#ef4444';
            minimapCtx.beginPath();
            minimapCtx.arc(nx, nz, en.isBoss ? 5 : 3.2, 0, Math.PI * 2);
            minimapCtx.fill();
        });

        const px = 80 + (hero3DX / 14) * 50;
        const pz = 80 + (hero3DZ / 27) * 60;
        drawPlayerDirectionMarker(minimapCtx, px, pz, 5.5);
        return;
    }

    const pTx = player.x / TILE_SIZE;
    const pTy = player.y / TILE_SIZE;
    const gx = pTx + HALF_WORLD;
    const gy = pTy + HALF_WORLD;

    minimapCtx.fillStyle = '#070510';
    minimapCtx.fillRect(0, 0, 160, 160);

    const viewSpan = 46;
    minimapCtx.imageSmoothingEnabled = false;

    minimapCtx.save();
    minimapCtx.globalAlpha = 0.26;
    minimapCtx.drawImage(
        reliefCanvas,
        gx - viewSpan / 2, gy - viewSpan / 2, viewSpan, viewSpan,
        0, 0, 160, 160
    );
    minimapCtx.restore();

    minimapCtx.drawImage(
        exploredCanvas,
        gx - viewSpan / 2, gy - viewSpan / 2, viewSpan, viewSpan,
        0, 0, 160, 160
    );

    minimapCtx.strokeStyle = 'rgba(16, 185, 129, 0.14)';
    minimapCtx.lineWidth = 1;
    minimapCtx.beginPath();
    minimapCtx.arc(80, 80, 36, 0, Math.PI * 2);
    minimapCtx.arc(80, 80, 68, 0, Math.PI * 2);
    minimapCtx.stroke();

    const scale = 160 / viewSpan;

    if (player.waypoint) {
        const wx = (player.waypoint.tx - pTx + viewSpan / 2) * scale;
        const wy = (player.waypoint.ty - pTy + viewSpan / 2) * scale;
        minimapCtx.save();
        minimapCtx.strokeStyle = 'rgba(244, 63, 94, 0.75)';
        minimapCtx.lineWidth = 1.5;
        minimapCtx.setLineDash([4, 3]);
        minimapCtx.beginPath();
        minimapCtx.moveTo(80, 80);
        minimapCtx.lineTo(wx, wy);
        minimapCtx.stroke();
        minimapCtx.restore();
    }

    pointsOfInterest.forEach(poi => {
        const pgx = poi.tx + HALF_WORLD;
        const pgy = poi.ty + HALF_WORLD;
        const isDiscovered = fogGrid[pgx] && fogGrid[pgx][pgy] === 1;
        const mx = (poi.tx - pTx + viewSpan / 2) * scale;
        const my = (poi.ty - pTy + viewSpan / 2) * scale;
        if (mx >= -4 && mx <= 164 && my >= -4 && my <= 164) {
            minimapCtx.save();
            minimapCtx.globalAlpha = isDiscovered ? 1.0 : 0.48;
            minimapCtx.fillStyle = poi.type === 'npc' ? '#38bdf8' : (poi.type === 'monolith' ? '#c084fc' : '#10b981');
            minimapCtx.strokeStyle = '#05030a';
            minimapCtx.lineWidth = 1.5;
            minimapCtx.beginPath();
            minimapCtx.arc(mx, my, poi.interacted ? 3.0 : 4.2, 0, Math.PI * 2);
            minimapCtx.fill();
            minimapCtx.stroke();
            minimapCtx.restore();
        }
    });

    DUNGEONS.forEach(dng => {
        const mx = (dng.tx - pTx + viewSpan / 2) * scale;
        const my = (dng.ty - pTy + viewSpan / 2) * scale;
        if (mx >= 4 && mx <= 156 && my >= 4 && my <= 156) {
            minimapCtx.fillStyle = dng.cleared ? '#10b981' : '#f59e0b';
            minimapCtx.strokeStyle = '#05030a';
            minimapCtx.lineWidth = 1.5;
            minimapCtx.fillRect(mx - 4, my - 4, 8, 8);
            minimapCtx.strokeRect(mx - 4, my - 4, 8, 8);
        }
    });

    if (player.waypoint) {
        const wx = (player.waypoint.tx - pTx + viewSpan / 2) * scale;
        const wy = (player.waypoint.ty - pTy + viewSpan / 2) * scale;
        const clampedX = Math.max(8, Math.min(152, wx));
        const clampedY = Math.max(8, Math.min(152, wy));
        minimapCtx.fillStyle = '#f43f5e';
        minimapCtx.strokeStyle = '#ffffff';
        minimapCtx.lineWidth = 1.5;
        minimapCtx.beginPath();
        minimapCtx.arc(clampedX, clampedY, 4.5, 0, Math.PI * 2);
        minimapCtx.fill();
        minimapCtx.stroke();
    }

    harborDocks.forEach(h => {
        const mx = (h.tx - pTx + viewSpan / 2) * scale;
        const my = (h.ty - pTy + viewSpan / 2) * scale;
        if (mx >= 4 && mx <= 156 && my >= 4 && my <= 156) {
            minimapCtx.fillStyle = '#d97706';
            minimapCtx.fillRect(mx - 3, my - 3, 6, 6);
        }
    });

    navigableBoats.forEach(b => {
        const bTx = b.wx / WORLD_SCALE_3D;
        const bTy = b.wz / WORLD_SCALE_3D;
        const mx = (bTx - pTx + viewSpan / 2) * scale;
        const my = (bTy - pTy + viewSpan / 2) * scale;
        if (mx >= 4 && mx <= 156 && my >= 4 && my <= 156) {
            minimapCtx.fillStyle = player.pilotingBoat === b ? '#fde047' : '#38bdf8';
            minimapCtx.beginPath();
            minimapCtx.arc(mx, my, 3, 0, Math.PI * 2);
            minimapCtx.fill();
        }
    });

    enemies3D.forEach(en => {
        if (en.dead || en.isDungeon) return;
        const eTx = en.x / WORLD_SCALE_3D;
        const eTy = en.z / WORLD_SCALE_3D;
        const mx = (eTx - pTx + viewSpan / 2) * scale;
        const my = (eTy - pTy + viewSpan / 2) * scale;
        if (mx >= 4 && mx <= 156 && my >= 4 && my <= 156) {
            minimapCtx.fillStyle = '#ef4444';
            minimapCtx.beginPath();
            minimapCtx.arc(mx, my, 3, 0, Math.PI * 2);
            minimapCtx.fill();
        }
    });

    drawPlayerDirectionMarker(minimapCtx, 80, 80, 5.5);
}

function mapTileToCanvasCoords(tx, ty) {
    const w = fullMapCanvas.width;
    const h = fullMapCanvas.height;
    const viewTiles = WORLD_TILES / mapViewConfig.zoom;
    const centerTx = mapViewConfig.panX;
    const centerTy = mapViewConfig.panY;
    const leftTx = centerTx - viewTiles / 2;
    const topTy = centerTy - viewTiles / 2;
    return {
        cx: ((tx - leftTx) / viewTiles) * w,
        cy: ((ty - topTy) / viewTiles) * h,
        scale: w / viewTiles
    };
}

function canvasCoordsToMapTile(normX, normY) {
    const viewTiles = WORLD_TILES / mapViewConfig.zoom;
    const leftTx = mapViewConfig.panX - viewTiles / 2;
    const topTy = mapViewConfig.panY - viewTiles / 2;
    return {
        tx: Math.max(-HALF_WORLD, Math.min(HALF_WORLD - 1, Math.round(leftTx + normX * viewTiles))),
        ty: Math.max(-HALF_WORLD, Math.min(HALF_WORLD - 1, Math.round(topTy + normY * viewTiles)))
    };
}

export function renderFullMap() {
    if (!fullMapCtx) return;
    const w = fullMapCanvas.width;
    const h = fullMapCanvas.height;
    const viewTiles = WORLD_TILES / mapViewConfig.zoom;

    const maxPan = Math.max(0, HALF_WORLD - viewTiles / 2);
    mapViewConfig.panX = Math.max(-maxPan, Math.min(maxPan, mapViewConfig.panX));
    mapViewConfig.panY = Math.max(-maxPan, Math.min(maxPan, mapViewConfig.panY));

    const srcX = (mapViewConfig.panX + HALF_WORLD) - viewTiles / 2;
    const srcY = (mapViewConfig.panY + HALF_WORLD) - viewTiles / 2;

    fullMapCtx.fillStyle = '#070510';
    fullMapCtx.fillRect(0, 0, w, h);
    fullMapCtx.imageSmoothingEnabled = false;

    if (mapViewConfig.oracleVision) {
        fullMapCtx.save();
        fullMapCtx.globalAlpha = 0.34;
        fullMapCtx.drawImage(reliefCanvas, srcX, srcY, viewTiles, viewTiles, 0, 0, w, h);
        fullMapCtx.restore();
    }

    fullMapCtx.drawImage(exploredCanvas, srcX, srcY, viewTiles, viewTiles, 0, 0, w, h);

    fullMapCtx.strokeStyle = 'rgba(167, 139, 250, 0.14)';
    fullMapCtx.lineWidth = 1;
    const gridStep = 20;
    for (let t = -60; t <= 60; t += gridStep) {
        const { cx } = mapTileToCanvasCoords(t, 0);
        const { cy } = mapTileToCanvasCoords(0, t);
        fullMapCtx.beginPath(); fullMapCtx.moveTo(cx, 0); fullMapCtx.lineTo(cx, h); fullMapCtx.stroke();
        fullMapCtx.beginPath(); fullMapCtx.moveTo(0, cy); fullMapCtx.lineTo(w, cy); fullMapCtx.stroke();
    }

    const pTx = player.x / TILE_SIZE;
    const pTy = player.y / TILE_SIZE;
    const heroPt = mapTileToCanvasCoords(pTx, pTy);

    if (player.waypoint) {
        const wpPt = mapTileToCanvasCoords(player.waypoint.tx, player.waypoint.ty);
        fullMapCtx.save();
        fullMapCtx.strokeStyle = 'rgba(244, 63, 94, 0.85)';
        fullMapCtx.lineWidth = 2;
        fullMapCtx.setLineDash([6, 4]);
        fullMapCtx.beginPath();
        fullMapCtx.moveTo(heroPt.cx, heroPt.cy);
        fullMapCtx.lineTo(wpPt.cx, wpPt.cy);
        fullMapCtx.stroke();
        fullMapCtx.restore();
    }

    enemies3D.forEach(en => {
        if (en.dead || en.isDungeon) return;
        const eTx = en.x / WORLD_SCALE_3D;
        const eTy = en.z / WORLD_SCALE_3D;
        const gx = Math.round(eTx) + HALF_WORLD;
        const gy = Math.round(eTy) + HALF_WORLD;
        const isDiscovered = fogGrid[gx] && fogGrid[gx][gy] === 1;
        if (isDiscovered || mapViewConfig.oracleVision) {
            const pt = mapTileToCanvasCoords(eTx, eTy);
            fullMapCtx.save();
            fullMapCtx.globalAlpha = isDiscovered ? 0.95 : 0.45;
            fullMapCtx.fillStyle = '#ef4444';
            fullMapCtx.strokeStyle = '#090514';
            fullMapCtx.lineWidth = 1.5;
            fullMapCtx.beginPath();
            fullMapCtx.arc(pt.cx, pt.cy, 4, 0, Math.PI * 2);
            fullMapCtx.fill();
            fullMapCtx.stroke();
            fullMapCtx.restore();
        }
    });

    pointsOfInterest.forEach(poi => {
        const gx = poi.tx + HALF_WORLD;
        const gy = poi.ty + HALF_WORLD;
        const isDiscovered = fogGrid[gx] && fogGrid[gx][gy] === 1;
        if (isDiscovered || mapViewConfig.oracleVision) {
            const pt = mapTileToCanvasCoords(poi.tx, poi.ty);
            fullMapCtx.save();
            fullMapCtx.globalAlpha = isDiscovered ? 1.0 : 0.58;

            if (!poi.interacted) {
                fullMapCtx.strokeStyle = poi.type === 'npc' ? 'rgba(56,189,248,0.45)' : (poi.type === 'monolith' ? 'rgba(192,132,252,0.45)' : 'rgba(16,185,129,0.45)');
                fullMapCtx.lineWidth = 2;
                fullMapCtx.beginPath();
                fullMapCtx.arc(pt.cx, pt.cy, 9.5, 0, Math.PI * 2);
                fullMapCtx.stroke();
            }

            fullMapCtx.fillStyle = poi.type === 'npc' ? '#38bdf8' : (poi.type === 'monolith' ? '#c084fc' : '#10b981');
            fullMapCtx.strokeStyle = poi.interacted ? '#94a3b8' : '#ffffff';
            fullMapCtx.lineWidth = 2;
            fullMapCtx.beginPath();
            fullMapCtx.arc(pt.cx, pt.cy, 6, 0, Math.PI * 2);
            fullMapCtx.fill();
            fullMapCtx.stroke();

            if (mapViewConfig.showLabels) {
                fullMapCtx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
                fullMapCtx.textAlign = 'center';
                const label = poi.name;
                const textW = fullMapCtx.measureText(label).width;
                fullMapCtx.fillStyle = 'rgba(6, 4, 12, 0.82)';
                fullMapCtx.fillRect(pt.cx - textW / 2 - 4, pt.cy - 20, textW + 8, 12);
                fullMapCtx.fillStyle = poi.interacted ? '#94a3b8' : '#f8fafc';
                fullMapCtx.fillText(label, pt.cx, pt.cy - 11);
            }
            fullMapCtx.restore();
        }
    });

    harborDocks.forEach(h => {
        const pt = mapTileToCanvasCoords(h.tx, h.ty);
        fullMapCtx.save();
        fullMapCtx.fillStyle = '#d97706';
        fullMapCtx.strokeStyle = '#fef3c7';
        fullMapCtx.lineWidth = 1.5;
        fullMapCtx.fillRect(pt.cx - 4.5, pt.cy - 4.5, 9, 9);
        fullMapCtx.strokeRect(pt.cx - 4.5, pt.cy - 4.5, 9, 9);
        fullMapCtx.restore();
    });

    DUNGEONS.forEach(dng => {
        const pt = mapTileToCanvasCoords(dng.tx, dng.ty);
        fullMapCtx.save();
        fullMapCtx.fillStyle = dng.cleared ? '#10b981' : '#f59e0b';
        fullMapCtx.strokeStyle = '#ffffff';
        fullMapCtx.lineWidth = 2;
        fullMapCtx.fillRect(pt.cx - 6, pt.cy - 6, 12, 12);
        fullMapCtx.strokeRect(pt.cx - 6, pt.cy - 6, 12, 12);

        if (mapViewConfig.showLabels) {
            fullMapCtx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
            fullMapCtx.textAlign = 'center';
            const shortLabel = dng.name.replace('Mazmorra del ', '').replace('Cripta de las ', 'Cripta ');
            const textW = fullMapCtx.measureText(shortLabel).width;
            fullMapCtx.fillStyle = 'rgba(6, 4, 12, 0.86)';
            fullMapCtx.fillRect(pt.cx - textW / 2 - 4, pt.cy + 9, textW + 8, 12);
            fullMapCtx.fillStyle = dng.cleared ? '#6ee7b7' : '#fde047';
            fullMapCtx.fillText(shortLabel, pt.cx, pt.cy + 18);
        }
        fullMapCtx.restore();
    });

    if (player.waypoint) {
        const wpPt = mapTileToCanvasCoords(player.waypoint.tx, player.waypoint.ty);
        fullMapCtx.fillStyle = '#f43f5e';
        fullMapCtx.strokeStyle = '#ffffff';
        fullMapCtx.lineWidth = 2.5;
        fullMapCtx.beginPath();
        fullMapCtx.arc(wpPt.cx, wpPt.cy, 7, 0, Math.PI * 2);
        fullMapCtx.fill();
        fullMapCtx.stroke();
    }

    drawPlayerDirectionMarker(fullMapCtx, heroPt.cx, heroPt.cy, 8.5);

    fullMapCtx.save();
    fullMapCtx.font = 'bold 11px "Cinzel", serif';
    fullMapCtx.textAlign = 'center';
    fullMapCtx.fillStyle = '#34d399';
    fullMapCtx.fillText('▲ N', w / 2, 16);
    fullMapCtx.fillStyle = '#94a3b8';
    fullMapCtx.fillText('S ▼', w / 2, h - 8);
    fullMapCtx.fillText('◄ O', 18, h / 2 + 4);
    fullMapCtx.fillText('E ►', w - 18, h / 2 + 4);
    fullMapCtx.restore();
}

export function bindAllUIEvents(engineCtx) {
    const { scene, renderer, camera, groundMistParticles, exitDungeonFn, boardOrLeaveBoatFn } = engineCtx;
    const gfxSync = () => applyGraphicsSettings(renderer, camera, groundMistParticles);
    const styleCtx = () => ({
        renderer: engineCtx.renderer,
        scene: engineCtx.scene,
        terrainMeshRef: engineCtx.terrainMeshRef,
        treeCrownInstRef: engineCtx.treeCrownInstRef,
        ambientLight: engineCtx.ambientLight,
        dirLight: engineCtx.dirLight,
        pbrTex: engineCtx.pbrTex
    });

    document.getElementById('btnOpenInventory').onclick = () => toggleModal('inventoryModal');
    document.getElementById('btnOpenSpells').onclick = () => toggleModal('spellsModal');
    document.getElementById('btnOpenMap').onclick = () => toggleModal('mapModal');
    document.getElementById('minimapTrigger').onclick = () => toggleModal('mapModal');
    document.getElementById('btnOpenJournal').onclick = () => toggleModal('journalModal');
    document.getElementById('btnOpenPause').onclick = () => toggleModal('pauseModal');

    document.getElementById('btnCycleArtStyle').onclick = () => cycleArtisticStyle(styleCtx());
    document.querySelectorAll('.art-style-btn').forEach(btn => {
        btn.onclick = () => applyArtisticStyle(btn.getAttribute('data-art-style'), false, styleCtx());
    });

    document.getElementById('btnCloseDialog').onclick = closeAllModals;
    document.getElementById('btnDialogAccept').onclick = closeAllModals;
    document.getElementById('btnResumeGame').onclick = closeAllModals;
    document.getElementById('btnCloseInventory').onclick = closeAllModals;
    document.getElementById('btnCloseSpells').onclick = closeAllModals;
    document.getElementById('btnCloseMap').onclick = closeAllModals;
    document.getElementById('btnCloseJournal').onclick = closeAllModals;

    document.getElementById('btnPauseOpenInventory').onclick = () => toggleModal('inventoryModal');
    document.getElementById('btnPauseOpenSpells').onclick = () => toggleModal('spellsModal');
    document.getElementById('btnPauseOpenMap').onclick = () => toggleModal('mapModal');
    document.getElementById('btnPauseOpenJournal').onclick = () => toggleModal('journalModal');

    document.getElementById('btnInvBackPause').onclick = () => toggleModal('pauseModal');
    document.getElementById('btnSpellsBackPause').onclick = () => toggleModal('pauseModal');
    document.getElementById('btnMapBackPause').onclick = () => toggleModal('pauseModal');
    document.getElementById('btnJournalBackPause').onclick = () => toggleModal('pauseModal');

    const spellCb = { isAnyModalOpen, showToast, updateHUDCounters, revealFogAround, cycleWeather };
    document.getElementById('qbHealth').onclick = () => usePotion(scene, 'health', { showToast, updateHUDCounters, renderInventoryModalUI: () => renderInventoryModalUI(scene) });
    document.getElementById('qbStamina').onclick = () => usePotion(scene, 'stamina', { showToast, updateHUDCounters, renderInventoryModalUI: () => renderInventoryModalUI(scene) });
    document.getElementById('qbMagic').onclick = () => usePotion(scene, 'magic', { showToast, updateHUDCounters, renderInventoryModalUI: () => renderInventoryModalUI(scene) });
    document.getElementById('qbWeapon').onclick = () => cycleWeapon({ showToast });
    document.getElementById('qbSpellCast').onclick = () => castSpellById(scene, player.equippedSpellId, spellCb);
    document.getElementById('qbSpellCycle').onclick = () => cycleEquippedSpell(spellCb);

    document.getElementById('btnSaveGame').onclick = () => {
        try {
            const payload = buildSaveObject();
            localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
            if (typeof window.saveToCloudSanctuary === 'function') {
                window.saveToCloudSanctuary(payload).catch(() => {});
            }
            updateSaveStatusLabel();
            showToast('Partida Guardada', 'Tu progreso ha sido guardado con éxito.', 'fa-floppy-disk');
        } catch (_) {
            showToast('Error al Guardar', 'Usa el botón Exportar Código como respaldo.', 'fa-triangle-exclamation', 'border-rose-400 text-rose-300');
        }
    };
    document.getElementById('btnLoadGame').onclick = () => {
        try {
            const raw = localStorage.getItem(SAVE_STORAGE_KEY);
            if (!raw) {
                showToast('Sin Partida Guardada', 'Primero guarda tu partida o importa un código.', 'fa-folder-open', 'border-amber-400 text-amber-300');
                return;
            }
            if (applySaveObject(JSON.parse(raw), scene, (st, sil) => applyArtisticStyle(st, sil, styleCtx()))) {
                closeAllModals();
                showToast('Partida Cargada', '¡Bienvenido de nuevo a Prydain!', 'fa-folder-open');
            }
        } catch (_) {
            showToast('Error al Cargar', 'El archivo guardado no es válido.', 'fa-triangle-exclamation', 'border-rose-400 text-rose-300');
        }
    };
    document.getElementById('btnExportSave').onclick = () => {
        const box = document.getElementById('saveCodeBox');
        box.value = btoa(unescape(encodeURIComponent(JSON.stringify(buildSaveObject()))));
        box.select();
        try { document.execCommand('copy'); } catch (_) {}
        showToast('Código Exportado', 'Código de partida generado y copiado al portapapeles.', 'fa-copy');
    };
    document.getElementById('btnImportSave').onclick = () => {
        const raw = document.getElementById('saveCodeBox').value.trim();
        if (!raw) return;
        try {
            const parsed = JSON.parse(decodeURIComponent(escape(atob(raw))));
            if (applySaveObject(parsed, scene, (st, sil) => applyArtisticStyle(st, sil, styleCtx()))) {
                closeAllModals();
                showToast('Partida Importada', 'Progreso restaurado desde el código.', 'fa-file-import');
            }
        } catch (_) {
            showToast('Código Inválido', 'Revisa que el código pegado esté completo.', 'fa-triangle-exclamation', 'border-rose-400 text-rose-300');
        }
    };

    const teleportHome = () => {
        if (worldState.activeDungeon) exitDungeonFn();
        player.x = 0; player.y = 0; player.y3D = 0.4; player.vy3D = 0;
        player.isDiving = false; player.isSwimming = false; player.oxygen = player.maxOxygen;
        closeAllModals();
        showToast('Regreso a Caer Dallben', 'Te has teletransportado al valle inicial (0, 0).', 'fa-wand-sparkles');
    };
    document.getElementById('btnPauseTeleportHome').onclick = teleportHome;
    document.getElementById('btnTeleportOrigin').onclick = teleportHome;

    document.getElementById('btnResetGame').onclick = () => {
        try { localStorage.removeItem(SAVE_STORAGE_KEY); } catch (_) {}
        window.location.reload();
    };

    document.getElementById('optSensitivity').oninput = (e) => { gameSettings.mouseSensitivity = parseFloat(e.target.value); gfxSync(); };
    document.getElementById('optFov').oninput = (e) => { gameSettings.fov = parseInt(e.target.value, 10); gfxSync(); };
    document.getElementById('optCamDist').oninput = (e) => { gameSettings.camDist = parseInt(e.target.value, 10); gfxSync(); };
    document.getElementById('optExposure').oninput = (e) => { gameSettings.exposure = parseFloat(e.target.value); gfxSync(); };
    document.getElementById('optFog').oninput = (e) => { gameSettings.fogMultiplier = parseFloat(e.target.value); gfxSync(); };
    document.getElementById('optPointerLock').onchange = (e) => { gameSettings.pointerLock = e.target.checked; };
    document.getElementById('optInvertY').onchange = (e) => { gameSettings.invertY = e.target.checked; };
    document.getElementById('optShadows').onchange = (e) => { gameSettings.shadows = e.target.checked; gfxSync(); };
    document.getElementById('optParticles').onchange = (e) => { gameSettings.particles = e.target.checked; gfxSync(); };
    document.getElementById('optVignette').onchange = (e) => { gameSettings.vignette = e.target.checked; gfxSync(); };
    document.getElementById('optHighDpi').onchange = (e) => { gameSettings.highDpi = e.target.checked; gfxSync(); };

    document.getElementById('btnClearWaypoint').onclick = () => { player.waypoint = null; renderFullMap(); };
    document.getElementById('btnMapZoomIn').onclick = () => {
        mapViewConfig.zoom = Math.min(3.5, Number((mapViewConfig.zoom + 0.5).toFixed(1)));
        const lbl = document.getElementById('mapZoomText');
        if (lbl) lbl.textContent = `${mapViewConfig.zoom.toFixed(1)}x`;
        renderFullMap();
    };
    document.getElementById('btnMapZoomOut').onclick = () => {
        mapViewConfig.zoom = Math.max(1.0, Number((mapViewConfig.zoom - 0.5).toFixed(1)));
        if (mapViewConfig.zoom === 1) { mapViewConfig.panX = 0; mapViewConfig.panY = 0; }
        const lbl = document.getElementById('mapZoomText');
        if (lbl) lbl.textContent = `${mapViewConfig.zoom.toFixed(1)}x`;
        renderFullMap();
    };
    document.getElementById('btnMapCenterHero').onclick = () => {
        if (mapViewConfig.zoom < 1.8) {
            mapViewConfig.zoom = 2.0;
            const lbl = document.getElementById('mapZoomText');
            if (lbl) lbl.textContent = '2.0x';
        }
        mapViewConfig.panX = player.x / TILE_SIZE;
        mapViewConfig.panY = player.y / TILE_SIZE;
        renderFullMap();
    };
    document.getElementById('btnMapToggleOracle').onclick = (e) => {
        mapViewConfig.oracleVision = !mapViewConfig.oracleVision;
        e.currentTarget.innerHTML = `<i class="fa-solid fa-eye mr-1"></i>Oráculo: ${mapViewConfig.oracleVision ? 'ON' : 'OFF'}`;
        renderFullMap();
    };
    document.getElementById('btnMapToggleLabels').onclick = () => {
        mapViewConfig.showLabels = !mapViewConfig.showLabels;
        renderFullMap();
    };

    const btnLeaveBoatHelm = document.getElementById('btnLeaveBoatHelm');
    if (btnLeaveBoatHelm) {
        btnLeaveBoatHelm.onclick = () => { if (player.pilotingBoat) boardOrLeaveBoatFn(); };
    }

    const btnDiveBreathSpell = document.getElementById('btnDiveBreathSpell');
    if (btnDiveBreathSpell) {
        btnDiveBreathSpell.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            player.equippedSpellId = 'undine_breath';
            castSpellById(scene, 'undine_breath', spellCb);
        };
    }

    fullMapCanvas.addEventListener('mousedown', (e) => {
        mapViewConfig.dragging = true;
        mapViewConfig.movedDuringDrag = false;
        mapViewConfig.dragStartX = e.clientX;
        mapViewConfig.dragStartY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
        mapViewConfig.dragging = false;
    });

    fullMapCanvas.addEventListener('mousemove', (e) => {
        const rect = fullMapCanvas.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width;
        const normY = (e.clientY - rect.top) / rect.height;

        if (mapViewConfig.dragging && mapViewConfig.zoom > 1.0) {
            const dx = e.clientX - mapViewConfig.dragStartX;
            const dy = e.clientY - mapViewConfig.dragStartY;
            if (Math.hypot(dx, dy) > 4) {
                mapViewConfig.movedDuringDrag = true;
            }
            const viewTiles = WORLD_TILES / mapViewConfig.zoom;
            mapViewConfig.panX -= (dx / rect.width) * viewTiles;
            mapViewConfig.panY -= (dy / rect.height) * viewTiles;
            mapViewConfig.dragStartX = e.clientX;
            mapViewConfig.dragStartY = e.clientY;
            renderFullMap();
        }

        const { tx, ty } = canvasCoordsToMapTile(normX, normY);
        const tile = getTileData(tx, ty);
        const hoverCoordsEl = document.getElementById('mapHoverCoords');
        const hoverTitleEl = document.getElementById('mapHoverTitle');
        if (hoverCoordsEl) hoverCoordsEl.textContent = `X: ${tx}, Z: ${ty}`;

        let hoveredEntity = null;
        for (const dng of DUNGEONS) {
            if (Math.hypot(dng.tx - tx, dng.ty - ty) <= 3.2) {
                hoveredEntity = `Mazmorra: ${dng.name} (${dng.cleared ? 'Conquistada' : 'Activa'})`;
                break;
            }
        }
        if (!hoveredEntity) {
            for (const poi of pointsOfInterest) {
                if (Math.hypot(poi.tx - tx, poi.ty - ty) <= 3.2) {
                    hoveredEntity = `${poi.name} — ${poi.role}`;
                    break;
                }
            }
        }
        if (hoverTitleEl) {
            hoverTitleEl.innerHTML = hoveredEntity
                ? `<i class="fa-solid fa-location-dot text-amber-400 mr-1.5"></i>${hoveredEntity}`
                : `<i class="fa-solid fa-mountain-sun text-emerald-400 mr-1.5"></i>${tile.biome.name}`;
        }
    });

    fullMapCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.25 : -0.25;
        mapViewConfig.zoom = Math.max(1.0, Math.min(3.5, Number((mapViewConfig.zoom + delta).toFixed(2))));
        if (mapViewConfig.zoom === 1.0) {
            mapViewConfig.panX = 0;
            mapViewConfig.panY = 0;
        }
        const lbl = document.getElementById('mapZoomText');
        if (lbl) lbl.textContent = `${mapViewConfig.zoom.toFixed(1)}x`;
        renderFullMap();
    }, { passive: false });

    fullMapCanvas.addEventListener('click', (e) => {
        if (mapViewConfig.movedDuringDrag) return;
        const rect = fullMapCanvas.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width;
        const normY = (e.clientY - rect.top) / rect.height;
        const { tx, ty } = canvasCoordsToMapTile(normX, normY);
        player.waypoint = { tx, ty, label: `Faro (${tx}, ${ty})` };
        renderFullMap();
        showToast('Faro Espectral Invocado', `Columna de luz fijada en X: ${tx}, Z: ${ty}`, 'fa-location-pin');
    });
}

export function buildHudSnapshot() {
    const buffs = [];
    if (player.aegisTimer > 0) buffs.push(`Égida ${Math.ceil(player.aegisTimer)}s`);
    if (player.magicBuffTimer > 0) buffs.push(`Arcano ${Math.ceil(player.magicBuffTimer)}s`);
    if (player.speedBuffTimer > 0) buffs.push(`Vel. ${Math.ceil(player.speedBuffTimer)}s`);
    if (player.undineBreathTimer > 0) buffs.push(`Ondinas ${Math.ceil(player.undineBreathTimer)}s`);

    return {
        hp: player.hp,
        maxHp: player.maxHp,
        mana: player.mana,
        maxMana: player.maxMana,
        stamina: player.stamina,
        maxStamina: player.maxStamina,
        oxygen: player.oxygen,
        maxOxygen: player.maxOxygen,
        xp: player.xp,
        xpToNext: player.xpToNext,
        spendableXp: player.spendableXp,
        level: player.level,
        gold: player.gold,
        kills: player.kills,
        relicsCount: player.relics.length,
        potions: { ...player.potions },
        equippedWeapon: player.equippedWeapon,
        equippedSpellId: player.equippedSpellId,
        heldObjectName: player.heldObject ? player.heldObject.name : null,
        isSwimming: player.isSwimming,
        isDiving: player.isDiving,
        pilotingBoatName: player.pilotingBoat ? player.pilotingBoat.name : null,
        buffs
    };
}

export function buildQuestSnapshot() {
    const dallben = pointsOfInterest.find(p => p.id === 'npc_aldric');
    const rem = pointsOfInterest.filter(p => (p.type === 'chest' || p.type === 'monolith') && !p.interacted);

    if (!dallben || !dallben.interacted) {
        return {
            title: 'Habla con Dallben el Vidente en Caer Dallben',
            subtitle: 'Cerca de (2, -2). Laguna profunda al SO (-13, 9).',
            badge: 'Prólogo'
        };
    }
    if (rem.length > 0) {
        const next = rem[0];
        const got = 8 - rem.length;
        return {
            title: `Reúne las Reliquias de Prydain (${got}/8)`,
            subtitle: `Explora (${next.tx}, ${next.ty}) para hallar ${next.name}.`,
            badge: `${got}/8 Reliquias`
        };
    }
    return {
        title: '¡El Caldero Negro ha sido Sellado!',
        subtitle: 'Conquista las 4 mazmorras y las profundidades del mar.',
        badge: 'Leyenda'
    };
}