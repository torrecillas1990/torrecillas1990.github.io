
class DomHudBridge {
    constructor(engine) {
        this.engine = engine;
        this.unsubscribers = [];
    }

    mount() {
        if (!this.engine) return;
        this.unmount();

        this.unsubscribers.push(
            this.engine.on('hud:state', (snap) => this.renderStats(snap)),
            this.engine.on('hud:quest', (quest) => this.renderQuest(quest)),
            this.engine.on('hud:world', (worldSnap) => this.renderWorld(worldSnap)),
            this.engine.on('hud:interaction', (interSnap) => this.renderInteraction(interSnap)),
            this.engine.on('hud:dive', (diveSnap) => this.renderDive(diveSnap)),
            this.engine.on('hud:boat', (boatSnap) => this.renderBoat(boatSnap))
        );
    }

    unmount() {
        this.unsubscribers.forEach((off) => {
            if (typeof off === 'function') off();
        });
        this.unsubscribers = [];
    }

    renderStats(p) {
        const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
        const mpPct = Math.max(0, Math.min(100, (p.mana / p.maxMana) * 100));
        const xpPct = Math.max(0, Math.min(100, (p.xp / p.xpToNext) * 100));

        const setEl = (id, fn) => {
            const el = document.getElementById(id);
            if (el) fn(el);
        };

        setEl('hudHealthBar', el => { el.style.width = `${hpPct}%`; });
        setEl('hudHealthText', el => { el.textContent = `${Math.round(p.hp)}/${p.maxHp}`; });
        setEl('hudStaminaBar', el => { el.style.width = `${p.stamina}%`; });
        setEl('hudStaminaText', el => { el.textContent = `${Math.round(p.stamina)}%`; });
        setEl('hudManaBar', el => { el.style.width = `${mpPct}%`; });
        setEl('hudManaText', el => { el.textContent = `${Math.round(p.mana)}/${p.maxMana}`; });
        setEl('hudXpBar', el => { el.style.width = `${xpPct}%`; });
        setEl('hudXpText', el => { el.textContent = `${Math.round(p.xp)}/${p.xpToNext} XP`; });

        setEl('hudLevelBadge', el => { el.textContent = `Nvl. ${p.level}`; });
        setEl('hudGold', el => { el.textContent = p.gold; });
        setEl('hudKills', el => { el.textContent = p.kills; });
        setEl('hudRelics', el => { el.textContent = `${Math.max(0, p.relicsCount - 1)}/8`; });

        setEl('qbHealthQty', el => { el.textContent = p.potions.health; });
        setEl('qbStaminaQty', el => { el.textContent = p.potions.stamina; });
        setEl('qbMagicQty', el => { el.textContent = p.potions.magic; });

        const sp = SPELLS_CATALOG.find(s => s.id === p.equippedSpellId) || SPELLS_CATALOG[0];
        const stats = getSpellEffectiveStats(sp);
        setEl('qbSpellIcon', el => { el.className = `fa-solid ${sp.icon} text-emerald-300 text-base pl-1`; });
        setEl('qbSpellName', el => { el.textContent = sp.name; });
        setEl('qbSpellMeta', el => { el.textContent = `Nvl.${stats.lvl} • ${stats.manaCost} MP`; });

        setEl('hudHeldBadge', el => {
            if (p.heldObjectName) {
                el.classList.remove('hidden');
                el.innerHTML = `<i class="fa-solid fa-hand-fist mr-1"></i>${p.heldObjectName} (Clic Izq: Lanzar)`;
            } else {
                el.classList.add('hidden');
            }
        });

        setEl('hudBuffBadge', el => {
            if (p.buffs && p.buffs.length > 0) {
                el.classList.remove('hidden');
                el.textContent = p.buffs.join(' • ');
            } else {
                el.classList.add('hidden');
            }
        });
    }

    renderQuest(q) {
        const setText = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.textContent = txt;
        };
        setText('questTitleText', q.title);
        setText('questSubText', q.subtitle);
        setText('questStepBadge', q.badge);
    }

    renderWorld(w) {
        const timeEl = document.getElementById('hudTimeText');
        const iconEl = document.getElementById('hudTimeIcon');
        if (timeEl) timeEl.textContent = w.timeFormatted;
        if (iconEl) {
            iconEl.className = w.isNight
                ? 'fa-solid fa-moon text-purple-400'
                : 'fa-solid fa-sun text-amber-400';
        }

        const biomeEl = document.getElementById('hudBiomeName');
        const coordsEl = document.getElementById('hudCoords');
        if (biomeEl) biomeEl.textContent = w.biomeName;
        if (coordsEl) {
            coordsEl.innerHTML = w.isDungeon
                ? `<i class="fa-solid fa-dungeon text-purple-400 mr-1"></i>Subsuelo`
                : `<i class="fa-solid fa-compass text-emerald-400 mr-1"></i>X: ${w.tx}, Z: ${w.ty}`;
        }
    }

    renderInteraction(inter) {
        const promptEl = document.getElementById('interactPrompt');
        const textEl = document.getElementById('interactPromptText');
        if (!promptEl || !textEl) return;
        if (inter.visible) {
            promptEl.classList.remove('hidden');
            textEl.textContent = inter.text;
        } else {
            promptEl.classList.add('hidden');
        }
    }

    renderDive(d) {
        const divePanel = document.getElementById('divingControlsPanel');
        const oxyContainer = document.getElementById('hudOxygenContainer');
        const uwOverlay = document.getElementById('underwaterOverlay');

        if (divePanel) {
            divePanel.classList.toggle('hidden', !d.showDiveUI);
            divePanel.classList.toggle('flex', d.showDiveUI);
            if (d.showDiveUI) {
                const depthEl = document.getElementById('divePanelDepth');
                const o2El = document.getElementById('divePanelO2');
                if (depthEl) depthEl.textContent = `${d.subDepth.toFixed(1)}m / ${d.waterDepth.toFixed(1)}m`;
                if (o2El) o2El.textContent = `O₂ ${Math.round(d.oxygen)}%`;
            }
        }
        if (oxyContainer) {
            oxyContainer.classList.toggle('hidden', !d.showOxygenBar);
            const bar = document.getElementById('hudOxygenBar');
            const txt = document.getElementById('hudOxygenText');
            if (bar) bar.style.width = `${d.oxygen}%`;
            if (txt) txt.textContent = `${Math.round(d.oxygen)}%`;
        }
        if (uwOverlay) {
            uwOverlay.style.opacity = d.isDiving ? '1' : '0';
            uwOverlay.classList.toggle('drowning', d.isDrowning);
        }
    }

    renderBoat(b) {
        const helmPanel = document.getElementById('boatHelmPanel');
        const helmName = document.getElementById('boatHelmName');
        const speedEl = document.getElementById('boatHelmSpeed');
        if (helmName && b.boatName) helmName.textContent = b.boatName;
        if (helmPanel) {
            helmPanel.classList.toggle('hidden', !b.piloting);
            helmPanel.classList.toggle('flex', b.piloting);
        }
        if (speedEl && b.piloting) {
            speedEl.textContent = `${b.knots} nudos • W/S Impulso • A/D Virar`;
        }
    }
}