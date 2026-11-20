
class GameEngine {
    constructor(theme = null) {
        if (theme) {
            setGameTheme(theme);
        }

        // Sistema de eventos pub/sub interno
        this.listeners = new Map();

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.ambientLight = null;
        this.dirLight = null;
        this.fillRimDirLight = null;
        this.waterMesh = null;
        this.skyDomeMesh = null;
        this.starFieldPoints = null;
        this.groundMistParticles = null;
        this.waypointBeamMesh = null;
        this.terrainMeshRef = null;
        this.treeTrunkInstRef = null;
        this.treeCrownInstRef = null;
        this.toonOutlineMeshes = [];
        this.pbrTex = {};

        this.poiMeshes3D = [];
        this.dungeonPortals3D = [];

        this.keys = {};
        this.touchVector = { x: 0, y: 0, active: false };
        this.touchSprint = false;
        this.touchAscend = false;
        this.diveDownBtnHeld = false;
        this.diveUpBtnHeld = false;
        this.lastMousePos = null;

        this.initialized = false;
        this.running = false;
        this.rafId = null;
        this.lastTime = 0;
        this.elapsed = 0;
        this.intervals = [];
        this.timeouts = [];
        this.eventListeners = [];
    }

    /**
     * Registra un listener para un evento del motor.
     * Devuelve una función de desuscripción cómoda para usar en frameworks o limpiadores.
     */
    on(eventName, handler) {
        if (!eventName || typeof handler !== 'function') return () => {};
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }
        const set = this.listeners.get(eventName);
        set.add(handler);
        return () => this.off(eventName, handler);
    }

    /**
     * Elimina un listener registrado previamente.
     */
    off(eventName, handler) {
        if (!this.listeners.has(eventName)) return;
        const set = this.listeners.get(eventName);
        set.delete(handler);
        if (set.size === 0) {
            this.listeners.delete(eventName);
        }
    }

    /**
     * Emite un evento con payload opcional a todos los suscriptores.
     */
    emit(eventName, payload = {}) {
        const set = this.listeners.get(eventName);
        if (!set || set.size === 0) return;
        const detail = {
            event: eventName,
            timestamp: Date.now(),
            elapsed: this.elapsed,
            ...payload
        };
        set.forEach((handler) => {
            try {
                handler(detail);
            } catch (_) {
                // Evita que un listener externo rompa el bucle del motor
            }
        });
    }

    _on(target, event, handler, options = undefined) {
        if (!target || typeof target.addEventListener !== 'function') return;
        target.addEventListener(event, handler, options);
        this.eventListeners.push({ target, event, handler, options });
    }

    _setInterval(fn, ms) {
        const id = window.setInterval(fn, ms);
        this.intervals.push(id);
        return id;
    }

    _setTimeout(fn, ms) {
        const id = window.setTimeout(fn, ms);
        this.timeouts.push(id);
        return id;
    }

    getEngineContext() {
        return {
            scene: this.scene,
            renderer: this.renderer,
            camera: this.camera,
            ambientLight: this.ambientLight,
            dirLight: this.dirLight,
            groundMistParticles: this.groundMistParticles,
            terrainMeshRef: this.terrainMeshRef,
            treeCrownInstRef: this.treeCrownInstRef,
            pbrTex: this.pbrTex,
            exitDungeonFn: () => {
                const prevDungeon = worldState.activeDungeon?.def || null;
                exitDungeon(this.scene, { showToast });
                this.emit('dungeon:exit', { dungeon: prevDungeon });
            },
            boardOrLeaveBoatFn: (b = null) => {
                const wasPiloting = player.pilotingBoat;
                const res = boardOrLeaveBoat(b, { isAnyModalOpen, showToast });
                if (res) {
                    this.emit(wasPiloting ? 'boat:leave' : 'boat:board', {
                        boat: wasPiloting || player.pilotingBoat
                    });
                }
                return res;
            }
        };
    }

    getActionCallbacks() {
        const prevLevelRef = { value: player.level };
        const prevKillsRef = { value: player.kills };

        const syncProgressEvents = () => {
            if (player.level > prevLevelRef.value) {
                const oldLvl = prevLevelRef.value;
                prevLevelRef.value = player.level;
                this.emit('player:levelup', {
                    previousLevel: oldLvl,
                    level: player.level,
                    maxHp: player.maxHp,
                    maxMana: player.maxMana
                });
            }
            if (player.kills > prevKillsRef.value) {
                const deltaKills = player.kills - prevKillsRef.value;
                prevKillsRef.value = player.kills;
                this.emit('enemy:killed', {
                    delta: deltaKills,
                    totalKills: player.kills,
                    gold: player.gold,
                    xp: player.xp
                });
            }
        };

        return {
            scene: this.scene,
            isAnyModalOpen,
            showToast: (title, subtitle, icon, colorClass) => {
                showToast(title, subtitle, icon, colorClass);
                this.emit('ui:toast', { title, subtitle, icon });
            },
            updateHUDCounters: () => {
                updateHUDCounters();
                syncProgressEvents();
                this.emit('hud:updated', {
                    hp: player.hp,
                    maxHp: player.maxHp,
                    mana: player.mana,
                    maxMana: player.maxMana,
                    stamina: player.stamina,
                    oxygen: player.oxygen,
                    gold: player.gold,
                    xp: player.xp,
                    level: player.level
                });
            },
            addLogEntry: (text) => {
                addLogEntry(text);
                this.emit('journal:log', { text });
            },
            revealFogAround,
            cycleWeather: (silent = false) => {
                cycleWeather(silent);
                this.emit('weather:changed', { weather: worldState.weather, silent });
            },
            boardOrLeaveBoat: (b = null) => {
                const wasPiloting = player.pilotingBoat;
                const res = boardOrLeaveBoat(b, { isAnyModalOpen, showToast });
                if (res) {
                    this.emit(wasPiloting ? 'boat:leave' : 'boat:board', {
                        boat: wasPiloting || player.pilotingBoat
                    });
                }
                return res;
            },
            interactWithPOI: (poi) => {
                const wasInteracted = poi.interacted;
                interactWithPOI(poi, {
                    grantExperienceFn: (amt) => {
                        grantExperience(amt, { addLogEntry, showToast, updateHUDCounters });
                        syncProgressEvents();
                    }
                });
                this.emit('poi:interact', {
                    poi,
                    firstTime: !wasInteracted,
                    relicsCount: Math.max(0, player.relics.length - 1)
                });
            },
            renderInventoryModalUI: () => renderInventoryModalUI(this.scene),
            damagePlayer: (dmg, attackerName) => this.damagePlayer(dmg, attackerName)
        };
    }

    damagePlayer(dmg, attackerName) {
        if (player.hurtTimer > 0) return;
        const prevHp = player.hp;
        player.hurtTimer = 0.75;
        const mitigated = player.aegisTimer > 0 ? Math.max(1, Math.round(dmg * 0.25)) : dmg;
        player.hp = Math.max(0, player.hp - mitigated);
        updateHUDCounters();

        this.emit('player:damage', {
            rawDamage: dmg,
            mitigatedDamage: mitigated,
            attackerName: attackerName || 'Desconocido',
            previousHp: prevHp,
            hp: player.hp,
            maxHp: player.maxHp
        });

        if (player.hp <= 0) {
            this.emit('player:defeated', { attackerName: attackerName || 'Desconocido' });
            if (worldState.activeDungeon) {
                const dng = worldState.activeDungeon.def;
                exitDungeon(this.scene, { showToast });
                this.emit('dungeon:exit', { dungeon: dng, reason: 'defeat' });
            }
            player.x = 0; player.y = 0; player.y3D = 0.4; player.vy3D = 0;
            player.hp = player.maxHp;
            player.oxygen = player.maxOxygen;
            player.isDiving = false; player.isSwimming = false;
            updateHUDCounters();
            showToast('Rescatado por Dallben', 'Caíste en combate y fuiste devuelto a Caer Dallben.', 'fa-heart-pulse', 'border-rose-400 text-rose-300');
        }
    }

    triggerPlayerJump() {
        if (isAnyModalOpen()) return;
        if (player.isDiving) return;

        const hx = (player.x / TILE_SIZE) * WORLD_SCALE_3D;
        const hz = (player.y / TILE_SIZE) * WORLD_SCALE_3D;
        const allowedJumps = player.magicBuffTimer > 0 ? 3 : player.maxJumps;

        if (player.isSwimming) {
            player.isSwimming = false;
            player.vy3D = player.jumpForce * 0.92;
            player.jumpCount = 1;
            player.jumpStretch = 0.25;
            spawnWaterRipple3D(this.scene, hx, WATER_SURFACE_Y, hz, 3.0, 0xa5f3fc);
            this.emit('player:jump', { mode: 'water_leap', jumpCount: player.jumpCount });
            return;
        }

        if (player.isGrounded || player.jumpCount < allowedJumps) {
            const isFirst = player.isGrounded || player.jumpCount === 0;
            player.vy3D = isFirst ? player.jumpForce : player.jumpForce * 0.9;
            player.isGrounded = false;
            player.jumpCount++;
            player.jumpStretch = isFirst ? 0.24 : 0.30;
            spawnJumpBurst3D(this.scene, hx, player.y3D, hz, isFirst ? 0x10b981 : 0xfde047, isFirst ? 2.0 : 2.8);
            this.emit('player:jump', {
                mode: isFirst ? 'ground' : 'air',
                jumpCount: player.jumpCount,
                maxJumps: allowedJumps
            });
        }
    }

    initThreeJSWorld() {
        this.pbrTex.skin = createPBRMicroTexture('skin');
        this.pbrTex.linen = createPBRMicroTexture('linen');
        this.pbrTex.leather = createPBRMicroTexture('leather');
        this.pbrTex.wood = createPBRMicroTexture('wood');
        this.pbrTex.stone = createPBRMicroTexture('stone');
        this.pbrTex.iron = createPBRMicroTexture('iron');
        this.pbrTex.terrain = createPBRMicroTexture('terrain');

        const container = document.getElementById('webglContainer');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0b0716);
        this.scene.fog = new THREE.FogExp2(0x110b22, 0.017);

        this.camera = new THREE.PerspectiveCamera(gameSettings.fov, window.innerWidth / window.innerHeight, 0.4, 230);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, gameSettings.highDpi ? 2 : 1));
        this.renderer.shadowMap.enabled = gameSettings.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = gameSettings.exposure;
        container.appendChild(this.renderer.domElement);

        this.fillRimDirLight = new THREE.DirectionalLight(0x10b981, 0.55);
        this.fillRimDirLight.position.set(-40, 22, 35);
        this.scene.add(this.fillRimDirLight);

        const skyObjs = buildAtmosphericSky3D(this.scene);
        this.skyDomeMesh = skyObjs.skyDomeMesh;
        this.starFieldPoints = skyObjs.starFieldPoints;

        this.ambientLight = new THREE.HemisphereLight(0x7c3aed, 0x0b2620, 0.72);
        this.scene.add(this.ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xa78bfa, 1.18);
        this.dirLight.position.set(35, 55, -25);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 1024;
        this.dirLight.shadow.mapSize.height = 1024;
        this.dirLight.shadow.camera.near = 5;
        this.dirLight.shadow.camera.far = 140;
        const d = 48;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target);

        const worldSize3D = WORLD_TILES * WORLD_SCALE_3D;
        const terrainGeo = new THREE.PlaneGeometry(worldSize3D, worldSize3D, WORLD_TILES - 1, WORLD_TILES - 1);
        terrainGeo.rotateX(-Math.PI / 2);

        const posAttr = terrainGeo.attributes.position;
        const colors = new Float32Array(posAttr.count * 3);

        for (let i = 0; i < posAttr.count; i++) {
            const vx = posAttr.getX(i);
            const vz = posAttr.getZ(i);
            const tx = Math.round(vx / WORLD_SCALE_3D);
            const ty = Math.round(vz / WORLD_SCALE_3D);
            const tile = getTileData(tx, ty);

            posAttr.setY(i, tile.height3D);
            const shade = 0.82 + tile.detail * 0.34;

            if (tile.height3D < WATER_SURFACE_Y) {
                const depth = WATER_SURFACE_Y - tile.height3D;
                const depthT = Math.min(1, depth / 6.5);
                const r = (78 * (1 - depthT) + 4 * depthT) * shade;
                const g = (92 * (1 - depthT) + 20 * depthT) * shade;
                const b = (68 * (1 - depthT) + 36 * depthT) * shade;
                colors[i * 3] = r / 255;
                colors[i * 3 + 1] = g / 255;
                colors[i * 3 + 2] = b / 255;
            } else {
                colors[i * 3] = (tile.biome.rgb[0] / 255) * shade;
                colors[i * 3 + 1] = (tile.biome.rgb[1] / 255) * shade;
                colors[i * 3 + 2] = (tile.biome.rgb[2] / 255) * shade;
            }
        }
        terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        terrainGeo.computeVertexNormals();

        const terrainMat = new THREE.MeshStandardMaterial({
            vertexColors: true, map: this.pbrTex.terrain, bumpMap: this.pbrTex.terrain, bumpScale: 0.12,
            roughness: 0.88, metalness: 0.08, flatShading: true
        });
        this.terrainMeshRef = new THREE.Mesh(terrainGeo, terrainMat);
        this.terrainMeshRef.receiveShadow = true;
        this.scene.add(this.terrainMeshRef);

        const waterGeo = new THREE.PlaneGeometry(worldSize3D, worldSize3D, 72, 72);
        waterGeo.rotateX(-Math.PI / 2);
        const waterMat = new THREE.MeshPhysicalMaterial({
            color: 0x0e626c, emissive: 0x063036, emissiveIntensity: 0.48,
            roughness: 0.12, metalness: 0.35, clearcoat: 0.85, clearcoatRoughness: 0.15,
            transparent: true, opacity: 0.74, side: THREE.DoubleSide
        });
        this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
        this.waterMesh.position.y = WATER_SURFACE_Y;
        this.scene.add(this.waterMesh);

        const propRefs = buildStylizedEnvironmentProps(this.scene, this.pbrTex);
        this.treeTrunkInstRef = propRefs.treeTrunkInst;
        this.treeCrownInstRef = propRefs.treeCrownInst;

        buildHeroCharacter3D(this.scene, this.pbrTex, this.toonOutlineMeshes);
        this.poiMeshes3D = buildPOIMeshes3D(this.scene, this.pbrTex, getSupportSurfaceHeight3D);
        this.dungeonPortals3D = buildDungeonPortals3D(this.scene, this.pbrTex, getSupportSurfaceHeight3D);
        buildHarborsAndBoats3D(this.scene, this.pbrTex);
        buildGrabbableObjects3D(this.scene, this.pbrTex);
        buildOverworldEnemies3D(this.scene, this.pbrTex);
        this.groundMistParticles = buildVolumetricAtmosphere(this.scene);

        const beamGeo = new THREE.CylinderGeometry(0.35, 0.8, 36, 8, 1, true);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0x10b981, transparent: true, opacity: 0.3,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
        });
        this.waypointBeamMesh = new THREE.Mesh(beamGeo, beamMat);
        this.scene.add(this.waypointBeamMesh);

        applyArtisticStyle(gameSettings.artStyle, true, this.getEngineContext());
    }

    bindInputEvents() {
        const cb = this.getActionCallbacks();

        this._on(window, 'keydown', (e) => {
            if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
            const k = e.key.toLowerCase();
            const isRepeat = this.keys[k];
            this.keys[k] = true;

            if (e.key === 'Escape') {
                e.preventDefault();
                if (isAnyModalOpen()) closeAllModals();
                else if (this.running) this.pause();
                else this.start();
                return;
            }
            if (k === 'p') {
                e.preventDefault();
                if (this.running) this.pause();
                else this.start();
                return;
            }
            if (k === 'm') { e.preventDefault(); toggleModal('mapModal'); return; }
            if (k === 'i') { e.preventDefault(); toggleModal('inventoryModal'); return; }
            if (k === 'b') { e.preventDefault(); toggleModal('spellsModal'); return; }
            if (k === 'j') { e.preventDefault(); toggleModal('journalModal'); return; }
            if (k === 't') {
                e.preventDefault();
                cycleArtisticStyle(this.getEngineContext());
                this.emit('style:changed', { artStyle: gameSettings.artStyle });
                return;
            }

            if (isAnyModalOpen()) return;

            if (e.code === 'Space' || k === ' ') {
                e.preventDefault();
                if (!isRepeat) this.triggerPlayerJump();
            } else if (k === 'e') {
                e.preventDefault();
                if (!worldState.activeDungeon && this.getNearbyDungeonPortal()) {
                    const dngDef = this.getNearbyDungeonPortal().def;
                    enterDungeon(this.scene, this.pbrTex, dngDef, cb);
                    this.emit('dungeon:enter', { dungeon: dngDef });
                    return;
                }
                performGrabOrInteract(this.scene, this.pbrTex, cb);
            } else if (k === 'x' || k === 'k') {
                e.preventDefault();
                performHeroAttack(this.scene, cb);
                this.emit('combat:attack', { weapon: player.equippedWeapon });
            } else if (k === 'g') {
                e.preventDefault();
                castSpellById(this.scene, player.equippedSpellId, cb);
                this.emit('spell:cast', { spellId: player.equippedSpellId });
            } else if (k === 'v') {
                e.preventDefault();
                cycleEquippedSpell(cb);
                this.emit('spell:cycled', { spellId: player.equippedSpellId });
            } else if (k === 'f') {
                e.preventDefault();
                castSpellById(this.scene, 'arcane_light', cb);
                this.emit('spell:cast', { spellId: 'arcane_light' });
            } else if (k === 'c') {
                e.preventDefault();
                castSpellById(this.scene, 'cauldron_storm', cb);
                this.emit('spell:cast', { spellId: 'cauldron_storm' });
            } else if (k === '1') {
                usePotion(this.scene, 'health', cb);
                this.emit('potion:used', { type: 'health' });
            } else if (k === '2') {
                usePotion(this.scene, 'stamina', cb);
                this.emit('potion:used', { type: 'stamina' });
            } else if (k === '3') {
                usePotion(this.scene, 'magic', cb);
                this.emit('potion:used', { type: 'magic' });
            } else if (k === '4') {
                cycleWeapon(cb);
                this.emit('weapon:cycled', { weapon: player.equippedWeapon });
            }
        });

        this._on(window, 'keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        this._on(document, 'pointerlockchange', () => {
            const locked = document.pointerLockElement === this.renderer?.domElement;
            const ret = document.getElementById('centerReticle');
            if (ret) ret.classList.toggle('hidden', !locked);
        });

        this._on(window, 'mousemove', (e) => {
            if (isAnyModalOpen()) return;
            const sens = 0.0032 * gameSettings.mouseSensitivity;
            const ySign = gameSettings.invertY ? -1 : 1;
            if (document.pointerLockElement === this.renderer?.domElement) {
                worldState.camYaw -= e.movementX * sens;
                worldState.camPitch = Math.max(-0.22, Math.min(1.18, worldState.camPitch + e.movementY * sens * ySign));
            } else if (e.target === this.renderer?.domElement) {
                if (this.lastMousePos) {
                    const dx = e.clientX - this.lastMousePos.x;
                    const dy = e.clientY - this.lastMousePos.y;
                    if (Math.abs(dx) < 120 && Math.abs(dy) < 120) {
                        worldState.camYaw -= dx * sens * 0.85;
                        worldState.camPitch = Math.max(-0.22, Math.min(1.18, worldState.camPitch + dy * sens * 0.85 * ySign));
                    }
                }
                this.lastMousePos = { x: e.clientX, y: e.clientY };
            }
        });

        this._on(window, 'mousedown', (e) => {
            if (isAnyModalOpen()) return;
            if (e.target && e.target.closest('button, input, textarea, #divingControlsPanel, #minimapTrigger')) return;

            if (e.button === 0) {
                if (gameSettings.pointerLock && this.renderer?.domElement && document.pointerLockElement !== this.renderer.domElement) {
                    try { this.renderer.domElement.requestPointerLock(); } catch (_) {}
                }
                performHeroAttack(this.scene, cb);
                this.emit('combat:attack', { weapon: player.equippedWeapon });
            } else if (e.button === 2) {
                e.preventDefault();
                performGrabOrInteract(this.scene, this.pbrTex, cb);
            }
        });

        this._on(window, 'contextmenu', (e) => {
            if (!isAnyModalOpen()) e.preventDefault();
        });

        this._on(window, 'wheel', (e) => {
            if (isAnyModalOpen()) return;
            worldState.camDist = Math.max(11, Math.min(38, worldState.camDist + e.deltaY * 0.015));
        }, { passive: true });

        const btnDiveDown = document.getElementById('btnDiveDown');
        const btnDiveUp = document.getElementById('btnDiveUp');

        const bindHoldDiveButton = (btn, setHeld) => {
            if (!btn) return;
            const startHold = (e) => { e.preventDefault(); e.stopPropagation(); setHeld(true); };
            const stopHold = (e) => { if (e) e.stopPropagation(); setHeld(false); };
            this._on(btn, 'mousedown', startHold);
            this._on(btn, 'mouseup', stopHold);
            this._on(btn, 'mouseleave', stopHold);
            this._on(btn, 'touchstart', startHold, { passive: false });
            this._on(btn, 'touchend', stopHold);
            this._on(btn, 'touchcancel', stopHold);
        };
        bindHoldDiveButton(btnDiveDown, (v) => { this.diveDownBtnHeld = v; });
        bindHoldDiveButton(btnDiveUp, (v) => { this.diveUpBtnHeld = v; });

        this._on(window, 'mouseup', () => { this.diveDownBtnHeld = false; this.diveUpBtnHeld = false; });
        this._on(window, 'blur', () => {
            this.diveDownBtnHeld = false; this.diveUpBtnHeld = false; this.touchAscend = false;
            Object.keys(this.keys).forEach(k => { this.keys[k] = false; });
        });

        const joystickZone = document.getElementById('touchJoystickZone');
        const joystickStick = document.getElementById('joystickStick');
        const maxJoyDist = 36;

        const handleJoystickMove = (cx, cy) => {
            const rect = joystickZone.getBoundingClientRect();
            let dx = cx - (rect.left + rect.width / 2);
            let dy = cy - (rect.top + rect.height / 2);
            const dist = Math.hypot(dx, dy);
            if (dist > maxJoyDist) { dx = (dx / dist) * maxJoyDist; dy = (dy / dist) * maxJoyDist; }
            joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
            this.touchVector.x = dx / maxJoyDist;
            this.touchVector.y = dy / maxJoyDist;
            this.touchVector.active = true;
        };
        const resetJoystick = () => {
            joystickStick.style.transform = 'translate(0px, 0px)';
            this.touchVector.x = 0; this.touchVector.y = 0; this.touchVector.active = false;
        };

        this._on(joystickZone, 'touchstart', (e) => { e.preventDefault(); handleJoystickMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
        this._on(joystickZone, 'touchmove', (e) => { e.preventDefault(); handleJoystickMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
        this._on(joystickZone, 'touchend', resetJoystick);
        this._on(joystickZone, 'touchcancel', resetJoystick);

        const btnTouchSprint = document.getElementById('btnTouchSprint');
        this._on(btnTouchSprint, 'touchstart', (e) => { e.preventDefault(); this.touchSprint = true; }, { passive: false });
        this._on(btnTouchSprint, 'touchend', () => { this.touchSprint = false; });

        const btnTouchJump = document.getElementById('btnTouchJump');
        this._on(btnTouchJump, 'touchstart', (e) => { e.preventDefault(); this.touchAscend = true; this.triggerPlayerJump(); }, { passive: false });
        this._on(btnTouchJump, 'touchend', () => { this.touchAscend = false; });
        this._on(btnTouchJump, 'click', () => this.triggerPlayerJump());

        this._on(document.getElementById('btnTouchAttack'), 'click', () => performHeroAttack(this.scene, cb));
        this._on(document.getElementById('btnTouchInteract'), 'click', () => performGrabOrInteract(this.scene, this.pbrTex, cb));
        this._on(document.getElementById('btnInteractTrigger'), 'click', () => performGrabOrInteract(this.scene, this.pbrTex, cb));

        this._on(window, 'resize', () => {
            if (!this.camera || !this.renderer) return;
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    getNearbyDungeonPortal() {
        const hero3DX = (player.x / TILE_SIZE) * WORLD_SCALE_3D;
        const hero3DZ = (player.y / TILE_SIZE) * WORLD_SCALE_3D;
        for (const dp of this.dungeonPortals3D) {
            if (Math.hypot(hero3DX - dp.wx, hero3DZ - dp.wz) < 4.8) return dp;
        }
        return null;
    }

    updateGame(dt, elapsed) {
        if (worldState.paused) return;
        const cb = this.getActionCallbacks();

        Object.keys(player.spellCooldowns).forEach(k => {
            if (player.spellCooldowns[k] > 0) player.spellCooldowns[k] = Math.max(0, player.spellCooldowns[k] - dt);
        });
        if (player.mana < player.maxMana) {
            const manaRegenRate = player.magicBuffTimer > 0 ? 18.0 : 7.5;
            player.mana = Math.min(player.maxMana, player.mana + manaRegenRate * dt);
        }

        if (player.aegisTimer > 0) {
            player.aegisTimer = Math.max(0, player.aegisTimer - dt);
            player.hp = Math.min(player.maxHp, player.hp + 2.5 * dt);
            if (player.aegisTimer === 0) {
                this.scene.traverse(obj => {
                    if (obj.geometry && obj.geometry.type === 'IcosahedronGeometry') obj.visible = false;
                });
            }
        }

        if (player.magicBuffTimer > 0) player.magicBuffTimer = Math.max(0, player.magicBuffTimer - dt);
        if (player.speedBuffTimer > 0) {
            player.speedBuffTimer = Math.max(0, player.speedBuffTimer - dt);
            player.stamina = Math.min(player.maxStamina, player.stamina + 35 * dt);
        }
        if (player.undineBreathTimer > 0) {
            player.undineBreathTimer = Math.max(0, player.undineBreathTimer - dt);
        }

        worldState.timeOfDay += dt * 0.06 * gameSettings.timeSpeedMult;
        if (worldState.timeOfDay >= 24) {
            worldState.timeOfDay -= 24;
            worldState.dayCount++;
            this.emit('world:newDay', { dayCount: worldState.dayCount });
        }

        const isNight = worldState.timeOfDay >= 18.5 || worldState.timeOfDay < 6.5;
        document.getElementById('hudTimeText').textContent = formatGameTime(worldState.timeOfDay);
        document.getElementById('hudTimeIcon').className = isNight
            ? 'fa-solid fa-moon text-purple-400'
            : 'fa-solid fa-sun text-amber-400';

        if (this.keys['q']) worldState.camYaw += 1.6 * dt;
        if (this.keys['r']) worldState.camYaw -= 1.6 * dt;

        let isMoving = false;
        let isSprinting = false;

        if (!isAnyModalOpen() && !player.pilotingBoat) {
            let inputX = 0;
            let inputZ = 0;
            if (this.keys['w'] || this.keys['arrowup']) inputZ -= 1;
            if (this.keys['s'] || this.keys['arrowdown']) inputZ += 1;
            if (this.keys['a'] || this.keys['arrowleft']) inputX -= 1;
            if (this.keys['d'] || this.keys['arrowright']) inputX += 1;

            if (this.touchVector.active) {
                inputX = this.touchVector.x;
                inputZ = this.touchVector.y;
            }

            const mag = Math.hypot(inputX, inputZ);
            if (mag > 1) {
                inputX /= mag;
                inputZ /= mag;
            }
            isMoving = mag > 0.08;

            const cosY = Math.cos(worldState.camYaw);
            const sinY = Math.sin(worldState.camYaw);
            const moveX = inputX * cosY + inputZ * sinY;
            const moveY = -inputX * sinY + inputZ * cosY;

            const wantsSprint = (this.keys['shift'] || this.touchSprint) && mag > 0.1;
            let sprinting = false;
            if (wantsSprint && player.stamina > 2) {
                sprinting = true;
                player.stamina = Math.max(0, player.stamina - (player.isSwimming ? 20 : 25) * dt);
            } else {
                player.stamina = Math.min(player.maxStamina, player.stamina + (player.isSwimming ? 12 : 18) * dt);
            }
            isSprinting = sprinting;

            document.getElementById('hudStaminaBar').style.width = `${player.stamina}%`;
            document.getElementById('hudStaminaText').textContent = `${Math.round(player.stamina)}%`;

            const curTx = Math.round(player.x / TILE_SIZE);
            const curTy = Math.round(player.y / TILE_SIZE);
            const curTile = getTileData(curTx, curTy);

            let biomeSpeedFactor = worldState.activeDungeon ? 1.0 : curTile.biome.speedMult;
            if (!worldState.activeDungeon) {
                if (player.isDiving) {
                    biomeSpeedFactor = player.undineBreathTimer > 0 ? 0.78 : 0.62;
                } else if (player.isSwimming) {
                    biomeSpeedFactor = 0.66;
                } else if (player.waterDepth > 0.12 && player.isGrounded) {
                    biomeSpeedFactor = Math.max(0.62, 1.0 - player.waterDepth * 0.30);
                }
            }
            const elixirSpeedBoost = player.speedBuffTimer > 0 ? 1.25 : 1.0;
            const effectiveSpeed = player.speed * biomeSpeedFactor * elixirSpeedBoost * (sprinting ? player.sprintMultiplier : 1);
            const nextX = player.x + moveX * effectiveSpeed * dt;
            const nextY = player.y + moveY * effectiveSpeed * dt;
            const maxBound = worldState.activeDungeon ? 999999 : (HALF_WORLD - 5) * TILE_SIZE;

            if (!isSolidAtWorldPos(nextX, player.y) && Math.abs(nextX) < maxBound) player.x = nextX;
            if (!isSolidAtWorldPos(player.x, nextY) && Math.abs(nextY) < maxBound) player.y = nextY;

            if (mag > 0.08) {
                const targetAngle = Math.atan2(moveX, moveY);
                let diff = targetAngle - player.rotationY;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                player.rotationY += diff * Math.min(1, dt * 12);

                player.walkFrame += dt * (sprinting ? 13 : 8.5);
                if (!worldState.activeDungeon) {
                    revealFogAround(curTx, curTy, 12);
                }
            } else {
                player.walkFrame = 0;
            }

            if (worldState.activeDungeon) {
                const dng = worldState.activeDungeon.def;
                document.getElementById('hudBiomeName').textContent = dng.name;
                document.getElementById('hudCoords').innerHTML = `<i class="fa-solid fa-dungeon text-purple-400 mr-1"></i>Subsuelo`;
                const dngFog = new THREE.Color(0x0b0614);
                this.scene.fog.color.lerp(dngFog, dt * 3.0);
                this.scene.background.lerp(dngFog, dt * 3.0);
                this.scene.fog.density = 0.019 * gameSettings.fogMultiplier;
            } else {
                document.getElementById('hudBiomeName').textContent = curTile.biome.name;
                document.getElementById('hudCoords').innerHTML = `<i class="fa-solid fa-compass text-emerald-400 mr-1"></i>X: ${curTx}, Z: ${curTy}`;

                const targetFogColor = player.isDiving ? new THREE.Color(0x042f3e) : new THREE.Color(curTile.biome.fogHex);
                this.scene.fog.color.lerp(targetFogColor, dt * 2.2);
                this.scene.background.lerp(targetFogColor, dt * 2.2);
                this.scene.fog.density = (player.isDiving ? 0.036 : (worldState.weather === 'RAIN' ? 0.026 : 0.017)) * gameSettings.fogMultiplier;

                if (!player.visitedBiomes.has(curTile.biome.id)) {
                    player.visitedBiomes.add(curTile.biome.id);
                    grantExperience(45, { addLogEntry, showToast, updateHUDCounters });
                    addLogEntry(`Te adentraste en ${curTile.biome.name} (+45 XP).`);
                    showToast(`Región Descubierta: ${curTile.biome.name}`, `${curTile.biome.desc} (+45 XP)`, 'fa-dungeon', 'border-purple-400 text-purple-300');
                    this.emit('biome:discovered', { biome: curTile.biome, totalVisited: player.visitedBiomes.size });
                }
            }
        }

        const currentWaterY = WATER_SURFACE_Y + Math.sin(elapsed * 1.8) * 0.05;
        updateBoatsAndNavigation(dt, elapsed, currentWaterY, {
            keys: this.keys,
            touchVector: this.touchVector,
            touchSprint: this.touchSprint,
            isAnyModalOpen,
            spawnWaterRipple3D: (x, y, z, s) => spawnWaterRipple3D(this.scene, x, y, z, s),
            revealFogAround
        });

        const hero3DX = (player.x / TILE_SIZE) * WORLD_SCALE_3D;
        const hero3DZ = (player.y / TILE_SIZE) * WORLD_SCALE_3D;
        const groundY = getSupportSurfaceHeight3D(hero3DX, hero3DZ);

        stepVerticalAndWaterPhysics(dt, elapsed, currentWaterY, groundY, isMoving, isSprinting, {
            keys: this.keys,
            diveDownBtnHeld: this.diveDownBtnHeld,
            diveUpBtnHeld: this.diveUpBtnHeld,
            touchAscend: this.touchAscend,
            isAnyModalOpen,
			spawnJumpBurst3D: (x, y, z, c, s) => spawnJumpBurst3D(this.scene, x, y, z, c, s),
            spawnWaterRipple3D: (x, y, z, s, c) => spawnWaterRipple3D(this.scene, x, y, z, s, c),
            spawnUnderwaterBubble3D: (x, y, z) => spawnUnderwaterBubble3D(this.scene, x, y, z),
            showToast,
            damagePlayer: (d, a) => this.damagePlayer(d, a)
        });

        let closestGrab = null;
        let closestGrabDist = 4.2;
        if (!player.heldObject && !worldState.activeDungeon && !player.pilotingBoat) {
            for (const g of grabbables3D) {
                if (g.isHeld) continue;
                const d3 = Math.hypot(hero3DX - g.mesh.position.x, hero3DZ - g.mesh.position.z);
                if (d3 < closestGrabDist) { closestGrabDist = d3; closestGrab = g; }
            }
        }

        const closestPortal = (!worldState.activeDungeon && !player.pilotingBoat) ? this.getNearbyDungeonPortal() : null;
        worldState.nearbyDungeonPortal = closestPortal;

        let closestPOI = null;
        let closestDist = 88;
        if (!worldState.activeDungeon && !player.pilotingBoat) {
            for (const poi of pointsOfInterest) {
                const d = Math.hypot(player.x - poi.tx * TILE_SIZE, player.y - poi.ty * TILE_SIZE);
                if (d < closestDist) { closestDist = d; closestPOI = poi; }
            }
        }
        worldState.nearbyPOI = closestPOI;

        const promptEl = document.getElementById('interactPrompt');
        if (promptEl) {
            if (player.pilotingBoat) {
                promptEl.classList.remove('hidden');
                document.getElementById('interactPromptText').textContent = `Soltar timón de ${player.pilotingBoat.name}`;
            } else if (player.nearbyBoat) {
                promptEl.classList.remove('hidden');
                document.getElementById('interactPromptText').textContent = `Subir y navegar ${player.nearbyBoat.name}`;
            } else if (player.heldObject) {
                promptEl.classList.remove('hidden');
                document.getElementById('interactPromptText').textContent = `Soltar ${player.heldObject.name} (Clic Izq: Lanzar)`;
            } else if (worldState.activeDungeon) {
                if (Math.hypot(hero3DX, hero3DZ - 24.5) < 4.5) {
                    promptEl.classList.remove('hidden');
                    document.getElementById('interactPromptText').textContent = `Salir de ${worldState.activeDungeon.def.name}`;
                } else if (Math.hypot(hero3DX, hero3DZ + 23) < 4.5) {
                    promptEl.classList.remove('hidden');
                    document.getElementById('interactPromptText').textContent = `Abrir Cofre de ${worldState.activeDungeon.def.relicName}`;
                } else {
                    promptEl.classList.add('hidden');
                }
            } else if (closestPortal) {
                promptEl.classList.remove('hidden');
                document.getElementById('interactPromptText').textContent = `Entrar a ${closestPortal.def.name}`;
            } else if (closestGrab) {
                promptEl.classList.remove('hidden');
                document.getElementById('interactPromptText').textContent = `Agarrar ${closestGrab.name}`;
            } else if (closestPOI) {
                promptEl.classList.remove('hidden');
                const verb = closestPOI.type === 'npc' ? 'Hablar con' : (closestPOI.type === 'monolith' ? 'Invocar' : 'Abrir');
                document.getElementById('interactPromptText').textContent = `${verb} ${closestPOI.name}`;
            } else {
                promptEl.classList.add('hidden');
            }
        }

        updateHeroAndCombatObjects(dt, elapsed, currentWaterY, groundY, isMoving, isSprinting, cb);

        if (heroSwordLight) heroSwordLight.intensity = player.torchOn ? (2.6 + Math.sin(elapsed * 7) * 0.4) : 0.2;
        if (heroBodyParts.swordBladeMat) heroBodyParts.swordBladeMat.emissiveIntensity = player.torchOn ? 1.8 : 0.15;

        const camTargetX = hero3DX;
        const camTargetY = player.y3D + 2.0;
        const camTargetZ = hero3DZ;

        const horizDist = worldState.camDist * Math.cos(worldState.camPitch);
        const vertDist = worldState.camDist * Math.sin(worldState.camPitch);
        const desiredCamX = camTargetX + Math.sin(worldState.camYaw) * horizDist;
        const desiredCamZ = camTargetZ + Math.cos(worldState.camYaw) * horizDist;
        const minCamY = player.isDiving ? groundY + 1.2 : (worldState.activeDungeon ? groundY + 2.5 : Math.max(groundY + 2.5, currentWaterY + 1.4));
        const desiredCamY = Math.max(minCamY, camTargetY + vertDist);

        this.camera.position.lerp(new THREE.Vector3(desiredCamX, desiredCamY, desiredCamZ), Math.min(1, dt * 8));
        this.camera.lookAt(camTargetX, camTargetY, camTargetZ);

        this.dirLight.position.set(hero3DX + 30, 55, hero3DZ - 25);
        this.dirLight.target.position.set(hero3DX, groundY, hero3DZ);
        this.dirLight.target.updateMatrixWorld();

        if (this.skyDomeMesh) {
            this.skyDomeMesh.position.set(hero3DX, player.y3D, hero3DZ);
            if (this.skyDomeMesh.material && this.skyDomeMesh.material.uniforms) {
                this.skyDomeMesh.material.uniforms.horizonColor.value.copy(this.scene.fog.color);
            }
        }
        if (this.starFieldPoints) {
            this.starFieldPoints.position.set(hero3DX, 0, hero3DZ);
            this.starFieldPoints.rotation.y = elapsed * 0.008;
            this.starFieldPoints.visible = !worldState.activeDungeon && !player.isDiving && gameSettings.artStyle !== 'toon';
        }

        this.waterMesh.position.y = currentWaterY;
        const wPos = this.waterMesh.geometry.attributes.position;
        if (wPos && !worldState.activeDungeon) {
            for (let i = 0; i < wPos.count; i++) {
                const vx = wPos.getX(i);
                const vz = wPos.getZ(i);
                const wave = Math.sin(vx * 0.25 + elapsed * 2.1) * 0.06 + Math.cos(vz * 0.25 + elapsed * 1.7) * 0.06;
                wPos.setY(i, wave);
            }
            wPos.needsUpdate = true;
        }

        this.poiMeshes3D.forEach(({ poi }) => {
            if (poi.crystalMesh) {
                poi.crystalMesh.rotation.y = elapsed * 2.2;
                poi.crystalMesh.position.y = 1.65 + Math.sin(elapsed * 3) * 0.18;
            }
        });

        this.dungeonPortals3D.forEach(({ vortex }) => {
            if (vortex) vortex.material.opacity = 0.52 + Math.sin(elapsed * 4) * 0.22;
        });

        if (player.waypoint && !worldState.activeDungeon) {
            this.waypointBeamMesh.visible = true;
            const wx = player.waypoint.tx * WORLD_SCALE_3D;
            const wz = player.waypoint.ty * WORLD_SCALE_3D;
            this.waypointBeamMesh.position.set(wx, 16, wz);
            this.waypointBeamMesh.rotation.y = elapsed * 1.5;
        } else {
            this.waypointBeamMesh.visible = false;
        }

        const mistAttr = this.groundMistParticles.geometry.attributes.position;
        for (let i = 0; i < mistAttr.count; i++) {
            let px = mistAttr.getX(i);
            let py = mistAttr.getY(i) + (worldState.weather === 'RAIN' ? -9 * dt : 0.7 * dt);
            let pz = mistAttr.getZ(i);

            px += Math.sin(elapsed + i) * 0.02;
            pz += Math.cos(elapsed + i * 0.5) * 0.02;

            if (py > 11) py = 0.3;
            if (py < 0.2) py = 10.5;

            if (px - hero3DX > 45) px -= 90;
            if (px - hero3DX < -45) px += 90;
            if (pz - hero3DZ > 45) pz -= 90;
            if (pz - hero3DZ < -45) pz += 90;

            mistAttr.setXYZ(i, px, py, pz);
        }
        mistAttr.needsUpdate = true;
        updateHUDCounters();
        void this.treeTrunkInstRef;
        void baubleGroup;
        void SAVE_STORAGE_KEY;

		const isNight = worldState.timeOfDay >= 18.5 || worldState.timeOfDay < 6.5;
		const curTx = Math.round(player.x / TILE_SIZE);
		const curTy = Math.round(player.y / TILE_SIZE);
		const curTile = getTileData(curTx, curTy);

		this.emit('hud:world', {
			timeOfDay: worldState.timeOfDay,
			timeFormatted: formatGameTime(worldState.timeOfDay),
			isNight,
			dayCount: worldState.dayCount,
			weather: worldState.weather,
			isDungeon: !!worldState.activeDungeon,
			biomeName: worldState.activeDungeon ? worldState.activeDungeon.def.name : curTile.biome.name,
			biomeId: worldState.activeDungeon ? 'DUNGEON' : curTile.biome.id,
			tx: curTx,
			ty: curTy
		});
		
		let interaction = { visible: false, text: '' };
		if (player.pilotingBoat) {
			interaction = { visible: true, text: `Soltar timón de ${player.pilotingBoat.name}` };
		} else if (player.nearbyBoat) {
			interaction = { visible: true, text: `Subir y navegar ${player.nearbyBoat.name}` };
		} else if (player.heldObject) {
			interaction = { visible: true, text: `Soltar ${player.heldObject.name} (Clic Izq: Lanzar)` };
		} else if (worldState.activeDungeon) {
			if (Math.hypot(hero3DX, hero3DZ - 24.5) < 4.5) {
				interaction = { visible: true, text: `Salir de ${worldState.activeDungeon.def.name}` };
			} else if (Math.hypot(hero3DX, hero3DZ + 23) < 4.5) {
				interaction = { visible: true, text: `Abrir Cofre de ${worldState.activeDungeon.def.relicName}` };
			}
		} else if (closestPortal) {
			interaction = { visible: true, text: `Entrar a ${closestPortal.def.name}` };
		} else if (closestGrab) {
			interaction = { visible: true, text: `Agarrar ${closestGrab.name}` };
		} else if (closestPOI) {
			const verb = closestPOI.type === 'npc' ? 'Hablar con' : (closestPOI.type === 'monolith' ? 'Invocar' : 'Abrir');
			interaction = { visible: true, text: `${verb} ${closestPOI.name}` };
		}
		this.emit('hud:interaction', interaction);
		this.emitHudState();
    }

    async initCloudSanctuary() {
		const badgeEl = document.getElementById('cloudStatusBadge');
		if (window.location.protocol === 'file:' || typeof window.__firebase_config === 'undefined' || !window.__firebase_config) {
			if (badgeEl) badgeEl.textContent = 'Modo Pergamino Activo';
			return;
		}
        try {
            if (typeof window.__firebase_config === 'undefined' || !window.__firebase_config) {
                if (badgeEl) badgeEl.textContent = 'Modo Pergamino Activo';
                return;
            }
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
            const { getAuth, signInAnonymously, signInWithCustomToken } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
            const { getFirestore, doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');

            const firebaseConfig = JSON.parse(window.__firebase_config);
            const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'aethelgard-black-cauldron';
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            if (typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
                await signInWithCustomToken(auth, window.__initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }

            const user = auth.currentUser;
            if (!user) {
                if (badgeEl) badgeEl.textContent = 'Santuario Local';
                return;
            }

            if (badgeEl) {
                badgeEl.textContent = 'Nube Arcana Conectada';
                badgeEl.className = 'text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 font-semibold';
            }

            const saveDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'saves', 'slot_1');

            window.saveToCloudSanctuary = async (payload) => {
                if (!auth.currentUser) return false;
                await setDoc(saveDocRef, payload);
                this.emit('game:save', { target: 'cloud', payload });
                return true;
            };

            window.loadFromCloudSanctuary = async () => {
                if (!auth.currentUser) return null;
                const snap = await getDoc(saveDocRef);
                const data = snap.exists() ? snap.data() : null;
                if (data) this.emit('game:load', { target: 'cloud', data });
                return data;
            };

            const existingSnap = await getDoc(saveDocRef);
            if (existingSnap.exists()) {
                const savedData = existingSnap.data();
                const stateText = document.getElementById('saveSlotStateText');
                const badgeTime = document.getElementById('lastSavedTimeBadge');
                if (stateText && savedData.player) {
                    stateText.textContent = `Partida en la Nube (Nvl. ${savedData.player.level} • ${savedData.player.gold} Oro)`;
                }
                if (badgeTime && savedData.savedAt) {
                    badgeTime.textContent = `Nube: ${savedData.savedAt}`;
                }
            }
        } catch (_) {
            if (badgeEl) badgeEl.textContent = 'Modo Pergamino Activo';
        }
    }

    start() {
        if (!this.initialized) {
            initMapCanvases();
            generateWorld();
            clearTerrainAroundPOIs();
            bakeWorldReliefMap();
            this.initThreeJSWorld();
            this.bindInputEvents();
            bindAllUIEvents(this.getEngineContext());
            revealFogAround(0, 0, 14);
            updateQuestTracker();
            updateHUDCounters();
            this.initCloudSanctuary();
            this.initialized = true;

            this._setTimeout(() => {
                showToast(
                    'Crónicas del Caldero Mágico (3D)',
                    'Mueve el ratón para mirar • Clic Izq: Ataque Dyrnwyn • Clic Der: Agarrar / Timón • P / Esc: Pausa.',
                    'fa-dungeon'
                );
            }, 600);

            this._setInterval(() => {
                const mapModalEl = document.getElementById('mapModal');
                if (this.running && mapModalEl && !mapModalEl.classList.contains('hidden')) {
                    renderFullMap();
                }
            }, 60);
			
			if (!this.hudBridge) this.hudBridge = new DomHudBridge(this);
			this.hudBridge.mount();
        }

        if (this.running) return;
        this.running = true;
        worldState.paused = false;
        this.lastTime = performance.now();
        this.emit('engine:start', { elapsed: this.elapsed });

        const loop = (now) => {
            if (!this.running) return;
            const dt = Math.min(0.05, (now - this.lastTime) / 1000);
            this.lastTime = now;
            if (!worldState.paused) {
                this.elapsed += dt;
            }

            this.updateGame(dt, this.elapsed);
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
            renderMinimap();

            this.rafId = window.requestAnimationFrame(loop);
        };

        this.rafId = window.requestAnimationFrame(loop);
    }

    pause() {
        worldState.paused = true;
        if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.running = false;
        this.emit('engine:pause', { elapsed: this.elapsed });
    }

    destroy() {
        this.pause();
        this.emit('engine:destroy', { elapsed: this.elapsed });
        this.listeners.clear();

        this.intervals.forEach(id => window.clearInterval(id));
        this.intervals = [];

        this.timeouts.forEach(id => window.clearTimeout(id));
        this.timeouts = [];

        this.eventListeners.forEach(({ target, event, handler, options }) => {
            target.removeEventListener(event, handler, options);
        });
        this.eventListeners = [];

        if (document.pointerLockElement === this.renderer?.domElement) {
            try { document.exitPointerLock(); } catch (_) {}
        }

        if (this.scene) {
            this.scene.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
        }

        Object.values(this.pbrTex).forEach(tex => {
            if (tex && typeof tex.dispose === 'function') tex.dispose();
        });
        this.pbrTex = {};

        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
            this.renderer = null;
        }

        this.scene = null;
        this.camera = null;
        this.initialized = false;

		if (this.hudBridge) {
			this.hudBridge.unmount();
			this.hudBridge = null;
		}
    }

	emitHudState() {
		const snap = buildHudSnapshot();
		this.emit('hud:state', snap);
		this.emit('hud:updated', snap); // compatibilidad con listeners anteriores
	}

	emitQuestState() {
		this.emit('hud:quest', buildQuestSnapshot());
	}
}

const engine = new GameEngine();
window.addEventListener('load', () => {
    engine.start();
});