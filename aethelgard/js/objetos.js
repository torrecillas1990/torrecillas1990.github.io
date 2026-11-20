
const enemies3D = [];
const grabbables3D = [];
const jumpBurstEffects = [];
const waterBubbles3D = [];
const swordSlashEffects = [];
const spellProjectiles3D = [];
const lightningEffects3D = [];

let heroGroup = null;
let heroMeshRoot = null;
let heroShadowMesh = null;
let heroAegisMesh = null;
let baubleGroup = null;
let baubleLight = null;
let heroBodyParts = {};
let heroSwordLight = null;
let heroRimLight = null;
let dungeonWorldGroup = null;

function setDungeonWorldGroup(grp) {
    dungeonWorldGroup = grp;
}

function spawnJumpBurst3D(scene, x, y, z, colorHex = 0x10b981, maxScale = 2.4) {
    const ringGeo = new THREE.RingGeometry(0.28, 0.52, 20);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(ringGeo, ringMat);
    mesh.position.set(x, y + 0.08, z);
    scene.add(mesh);
    jumpBurstEffects.push({ mesh, age: 0, duration: 0.48, maxScale });
}

function spawnWaterRipple3D(scene, x, y, z, maxScale = 2.4, colorHex = 0x67e8f9) {
    const ringGeo = new THREE.RingGeometry(0.22, 0.36, 20);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex, transparent: true, opacity: 0.72,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(ringGeo, ringMat);
    mesh.position.set(x, y + 0.04, z);
    scene.add(mesh);
    jumpBurstEffects.push({ mesh, age: 0, duration: 0.78, maxScale });
}

function spawnUnderwaterBubble3D(scene, x, y, z) {
    const bGeo = new THREE.SphereGeometry(0.07 + Math.random() * 0.09, 6, 6);
    const bMat = new THREE.MeshBasicMaterial({
        color: 0xa5f3fc, transparent: true, opacity: 0.72,
        blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(bGeo, bMat);
    mesh.position.set(x + (Math.random() - 0.5) * 0.45, y, z + (Math.random() - 0.5) * 0.45);
    scene.add(mesh);
    waterBubbles3D.push({
        mesh, vy: 1.6 + Math.random() * 1.4,
        wobblePhase: Math.random() * Math.PI * 2, age: 0, maxAge: 2.8
    });
}

function spawnLightningStrike3D(scene, x, y, z, colorHex = 0xc084fc) {
    const boltGeo = new THREE.CylinderGeometry(0.18, 0.42, 26, 6);
    const boltMat = new THREE.MeshBasicMaterial({
        color: colorHex, transparent: true, opacity: 0.92,
        blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(boltGeo, boltMat);
    mesh.position.set(x, y + 13, z);
    scene.add(mesh);
    lightningEffects3D.push({ mesh, age: 0, duration: 0.36 });
    spawnJumpBurst3D(scene, x, y, z, colorHex, 3.6);
}

function applyEquippedWeaponVisuals() {
    const w = WEAPONS_CATALOG[player.equippedWeapon] || WEAPONS_CATALOG.apprentice_sword;
    if (heroBodyParts.blade && heroBodyParts.swordBladeMat) {
        heroBodyParts.blade.scale.set(w.bladeWidth / 0.08, w.bladeLen / 1.35, w.bladeWidth / 0.08);
        heroBodyParts.swordBladeMat.color.setHex(w.bladeColor);
        heroBodyParts.swordBladeMat.emissive.setHex(w.glowColor);
        if (heroSwordLight) heroSwordLight.color.setHex(w.glowColor);
    }
    const nameEl = document.getElementById('qbWeaponName');
    const dmgEl = document.getElementById('qbWeaponDmg');
    const iconEl = document.getElementById('qbWeaponIcon');
    if (nameEl) nameEl.textContent = w.name;
    if (dmgEl) dmgEl.textContent = `Daño ${w.damage + (player.level - 1) * 4}`;
    if (iconEl) iconEl.className = `fa-solid ${w.icon} text-amber-300 text-base pl-1`;
}

function buildHeroCharacter3D(scene, pbrTex, toonOutlineMeshes) {
    heroGroup = new THREE.Group();
    heroMeshRoot = new THREE.Group();
    heroGroup.add(heroMeshRoot);

    const skinMat = new THREE.MeshPhysicalMaterial({
        map: pbrTex.skin, bumpMap: pbrTex.skin, bumpScale: 0.03,
        color: 0xf1bfa0, emissive: 0x5c1912, emissiveIntensity: 0.22,
        roughness: 0.55, clearcoat: 0.12
    });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x6b3a1e, roughness: 0.72, flatShading: true });
    const tunicMat = new THREE.MeshStandardMaterial({
        map: pbrTex.linen, bumpMap: pbrTex.linen, bumpScale: 0.06, color: 0x356950, roughness: 0.84
    });
    const leatherMat = new THREE.MeshStandardMaterial({
        map: pbrTex.leather, bumpMap: pbrTex.leather, bumpScale: 0.08, color: 0x523424, roughness: 0.78
    });
    const cloakMat = new THREE.MeshStandardMaterial({
        map: pbrTex.linen, color: 0x3b1d5e, roughness: 0.82, side: THREE.DoubleSide
    });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.05, 7), tunicMat);
    torso.position.y = 1.25; torso.castShadow = true;
    heroMeshRoot.add(torso);

    const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.41, 0.52, 7), leatherMat);
    vest.position.y = 1.15;
    heroMeshRoot.add(vest);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 2.02, 0);
    const headMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 2), skinMat);
    headMesh.scale.set(0.92, 1.12, 0.95); headMesh.castShadow = true;
    headGroup.add(headMesh);

    const torsoOutline = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.46, 1.09, 7),
        new THREE.MeshBasicMaterial({ color: 0x05030a, side: THREE.BackSide })
    );
    torsoOutline.position.y = 1.25;
    torsoOutline.visible = false;
    heroMeshRoot.add(torsoOutline);
    toonOutlineMeshes.push(torsoOutline);

    const headOutline = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.37, 2),
        new THREE.MeshBasicMaterial({ color: 0x05030a, side: THREE.BackSide })
    );
    headOutline.scale.set(0.95, 1.15, 0.98);
    headOutline.visible = false;
    headGroup.add(headOutline);
    toonOutlineMeshes.push(headOutline);

    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e1b4b });
    const lEye = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.04), eyeWhiteMat);
    lEye.position.set(-0.11, 0.04, 0.28);
    const lPupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), eyeMat);
    lPupil.position.set(-0.11, 0.04, 0.29);
    const rEye = lEye.clone(); rEye.position.x = 0.11;
    const rPupil = lPupil.clone(); rPupil.position.x = 0.11;
    headGroup.add(lEye, lPupil, rEye, rPupil);

    const hairCrown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.37, 1), hairMat);
    hairCrown.position.set(0, 0.12, -0.04); hairCrown.scale.set(1.05, 0.95, 1.1);
    headGroup.add(hairCrown);
    heroMeshRoot.add(headGroup);

    const cloakGeo = new THREE.ConeGeometry(0.62, 1.35, 6, 1, true, Math.PI * 0.65, Math.PI * 1.7);
    const cloakMesh = new THREE.Mesh(cloakGeo, cloakMat);
    cloakMesh.position.set(0, 1.15, -0.12); cloakMesh.rotation.x = 0.18; cloakMesh.castShadow = true;
    heroMeshRoot.add(cloakMesh);

    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.85, 6), leatherMat);
    leftLeg.position.set(-0.16, 0.42, 0);
    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.85, 6), leatherMat);
    rightLeg.position.set(0.16, 0.42, 0);
    heroMeshRoot.add(leftLeg, rightLeg);

    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.75, 6), tunicMat);
    leftArm.position.set(-0.44, 1.35, 0);
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.44, 1.55, 0);
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.75, 6), tunicMat);
    rightArm.position.y = -0.25;
    rightArmGroup.add(rightArm);

    const swordGroup = new THREE.Group();
    swordGroup.position.set(0, -0.55, 0.35);
    swordGroup.rotation.x = Math.PI * 0.32;
    const hilt = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.07, 0.09),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.75, roughness: 0.28 })
    );
    const swordBladeMat = new THREE.MeshStandardMaterial({
        color: 0xa7f3d0, emissive: 0x10b981, emissiveIntensity: 1.5, roughness: 0.18, metalness: 0.85
    });
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.08, 1.35, 4), swordBladeMat);
    blade.position.y = 0.7;
    swordGroup.add(hilt, blade);
    rightArmGroup.add(swordGroup);
    heroMeshRoot.add(leftArm, rightArmGroup);

    baubleGroup = new THREE.Group();
    const baubleOrb = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    baubleLight = new THREE.PointLight(0xfde047, 1.4, 11);
    baubleGroup.add(baubleOrb, baubleLight);
    heroGroup.add(baubleGroup);

    heroAegisMesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.65, 1),
        new THREE.MeshBasicMaterial({
            color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending
        })
    );
    heroAegisMesh.position.y = 1.25;
    heroAegisMesh.visible = false;
    heroGroup.add(heroAegisMesh);

    heroShadowMesh = new THREE.Mesh(
        new THREE.CircleGeometry(0.65, 16),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false })
    );
    heroShadowMesh.rotation.x = -Math.PI / 2;
    scene.add(heroShadowMesh);

    heroSwordLight = new THREE.PointLight(0x10b981, 2.5, 24, 1.7);
    heroSwordLight.position.set(0.5, 2.2, 0.8);
    heroGroup.add(heroSwordLight);

    heroRimLight = new THREE.PointLight(0x9333ea, 1.4, 12);
    heroRimLight.position.set(-1.2, 2.8, -1.2);
    heroGroup.add(heroRimLight);

    heroBodyParts = { headGroup, cloakMesh, leftLeg, rightLeg, leftArm, rightArmGroup, swordGroup, blade, swordBladeMat };
    scene.add(heroGroup);
    applyEquippedWeaponVisuals();
}

function buildGrabbableObjects3D(scene, pbrTex) {
    grabbables3D.length = 0;
    const spots = [
        { tx: -3, ty: 2, type: 'orb' }, { tx: 5, ty: -4, type: 'rock' },
        { tx: -8, ty: 5, type: 'orb' }, { tx: 10, ty: 8, type: 'rock' },
        { tx: -18, ty: -14, type: 'orb' }, { tx: 20, ty: -12, type: 'rock' },
        { tx: -26, ty: 18, type: 'orb' }, { tx: 28, ty: 15, type: 'rock' }
    ];
    spots.forEach(s => {
        const wx = s.tx * WORLD_SCALE_3D;
        const wz = s.ty * WORLD_SCALE_3D;
        const wy = sampleWorldHeight3D(wx, wz) + 0.45;
        const colorHex = s.type === 'orb' ? 0x34d399 : 0x94a3b8;
        const mesh = s.type === 'orb'
            ? new THREE.Mesh(
                new THREE.OctahedronGeometry(0.44, 1),
                new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 0.9, roughness: 0.2 })
            )
            : new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.48, 0),
                new THREE.MeshStandardMaterial({ map: pbrTex.stone, roughness: 0.85, flatShading: true })
            );
        mesh.position.set(wx, wy, wz);
        mesh.castShadow = true;
        scene.add(mesh);
        grabbables3D.push({
            mesh, name: s.type === 'orb' ? 'Orbe Espectral' : 'Roca Rúnica',
            colorHex, vx: 0, vy: 0, vz: 0, thrown: false, isHeld: false
        });
    });
}

function createEnemyMesh3D(kind, isBoss = false, pbrTex = null) {
    const g = new THREE.Group();
    const scale = isBoss ? 1.65 : 1.0;
    g.scale.setScalar(scale);

    if (kind === 'gwythaint') {
        const body = new THREE.Mesh(
            new THREE.ConeGeometry(0.45, 1.3, 6),
            new THREE.MeshStandardMaterial({ color: 0x2d1838, roughness: 0.7, flatShading: true })
        );
        body.rotation.x = Math.PI / 2;
        body.position.y = 2.0;
        const wingGeo = new THREE.BoxGeometry(1.7, 0.08, 0.65);
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.65 });
        const leftWing = new THREE.Mesh(wingGeo, wingMat);
        leftWing.position.set(-0.9, 2.0, 0);
        const rightWing = new THREE.Mesh(wingGeo, wingMat);
        rightWing.position.set(0.9, 2.0, 0);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), new THREE.MeshBasicMaterial({ color: 0xf43f5e }));
        eye.position.set(0, 2.05, 0.62);
        g.add(body, leftWing, rightWing, eye);
        g.userData = { leftWing, rightWing };
    } else {
        const armorMat = new THREE.MeshStandardMaterial({
            map: pbrTex?.iron || null, color: 0x3b334f, roughness: 0.55, metalness: 0.72
        });
        const boneMat = new THREE.MeshStandardMaterial({ color: 0xd6d3c4, roughness: 0.75 });
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 1.05, 6), armorMat);
        torso.position.y = 1.25; torso.castShadow = true;
        const skull = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 1), boneMat);
        skull.position.y = 1.98;
        const lHorn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.52, 5), boneMat);
        lHorn.position.set(-0.24, 2.26, 0); lHorn.rotation.z = 0.45;
        const rHorn = lHorn.clone(); rHorn.position.x = 0.24; rHorn.rotation.z = -0.45;

        const eyeMat = new THREE.MeshBasicMaterial({ color: isBoss ? 0xf43f5e : 0x39ff14 });
        const lEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), eyeMat);
        lEye.position.set(-0.1, 2.0, 0.25);
        const rEye = lEye.clone(); rEye.position.x = 0.1;

        const axe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.35, 0.36), armorMat);
        axe.position.set(0.48, 1.25, 0.25);
        g.add(torso, skull, lHorn, rHorn, lEye, rEye, axe);
        g.userData = { axe };
    }

    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.16), new THREE.MeshBasicMaterial({ color: 0x090514, side: THREE.DoubleSide }));
    barBg.position.y = 2.85;
    const barFill = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.1), new THREE.MeshBasicMaterial({ color: isBoss ? 0xf59e0b : 0xf43f5e, side: THREE.DoubleSide }));
    barFill.position.set(0, 2.85, 0.02);
    g.add(barBg, barFill);
    g.userData.hpBar = barFill;
    return g;
}

function spawnEnemy(scene, pbrTex, kind, wx, wz, yBase, hp, damage, xpReward, goldReward, isBoss = false, isDungeon = false, name = '') {
    const mesh = createEnemyMesh3D(kind, isBoss, pbrTex);
    mesh.position.set(wx, yBase, wz);
    scene.add(mesh);
    const enemy = {
        kind, name: name || (kind === 'gwythaint' ? 'Gwythaint' : 'Nacido del Caldero'),
        mesh, homeX: wx, homeZ: wz, x: wx, y: yBase, z: wz,
        hp, maxHp: hp, damage, xpReward, goldReward,
        isBoss, isDungeon, dead: false, respawnTimer: 0,
        attackCd: 0, slowTimer: 0, patrolAngle: Math.random() * Math.PI * 2,
        hitFlash: 0
    };
    enemies3D.push(enemy);
    return enemy;
}

function buildOverworldEnemies3D(scene, pbrTex) {
    enemies3D.length = 0;
    const spawns = [
        { kind: 'skeleton', tx: 12, ty: -8 }, { kind: 'skeleton', tx: -12, ty: -10 },
        { kind: 'gwythaint', tx: 16, ty: 10 }, { kind: 'skeleton', tx: -20, ty: -16 },
        { kind: 'gwythaint', tx: -26, ty: 14 }, { kind: 'skeleton', tx: 26, ty: -14 },
        { kind: 'skeleton', tx: 34, ty: 24 }, { kind: 'gwythaint', tx: -34, ty: -24 },
        { kind: 'skeleton', tx: -38, ty: 18 }, { kind: 'gwythaint', tx: 36, ty: -28 },
        { kind: 'skeleton', tx: -14, ty: 38 }, { kind: 'skeleton', tx: 12, ty: -38 }
    ];
    spawns.forEach(sp => {
        const wx = sp.tx * WORLD_SCALE_3D;
        const wz = sp.ty * WORLD_SCALE_3D;
        const wy = sampleWorldHeight3D(wx, wz);
        if (wy < WATER_SURFACE_Y) return;
        const isFlyer = sp.kind === 'gwythaint';
        spawnEnemy(scene, pbrTex, sp.kind, wx, wz, wy, isFlyer ? 70 : 95, isFlyer ? 11 : 14, isFlyer ? 38 : 48, isFlyer ? 22 : 30, false, false);
    });
}

function enterDungeon(scene, pbrTex, dngDef, { showToast }) {
    if (dungeonWorldGroup) {
        scene.remove(dungeonWorldGroup);
        dungeonWorldGroup = null;
    }
    for (let i = enemies3D.length - 1; i >= 0; i--) {
        if (enemies3D[i].isDungeon) {
            scene.remove(enemies3D[i].mesh);
            enemies3D.splice(i, 1);
        }
    }

    const built = createDungeonInterior(scene, pbrTex, dngDef, (kind, wx, wz, yBase, hp, dmg, xpR, goldR, isBoss, isDng, bossName) =>
        spawnEnemy(scene, pbrTex, kind, wx, wz, yBase, hp, dmg, xpR, goldR, isBoss, isDng, bossName)
    );
    dungeonWorldGroup = built.dungeonWorldGroup;

    worldState.activeDungeon = {
        def: dngDef,
        returnX: player.x,
        returnY: player.y,
        columns: built.columns,
        chestMesh: built.chestMesh,
        chestOpened: dngDef.cleared,
        bossDefeated: dngDef.cleared,
        enemies: built.dngEnemies
    };

    player.x = 0;
    player.y = (21 / WORLD_SCALE_3D) * TILE_SIZE;
    player.y3D = DUNGEON_Y_OFFSET + 0.2;
    player.vy3D = 0;
    player.isDiving = false;
    player.isSwimming = false;
    player.oxygen = player.maxOxygen;
    player.rotationY = Math.PI;
    worldState.camYaw = 0;

    showToast(`Mazmorra: ${dngDef.name}`, `Derrota a ${dngDef.bossName} en el altar norte para romper el sello.`, 'fa-dungeon', 'border-amber-400 text-amber-300');
}

function exitDungeon(scene, { showToast }) {
    if (!worldState.activeDungeon) return;
    const retX = worldState.activeDungeon.returnX;
    const retY = worldState.activeDungeon.returnY;
    if (dungeonWorldGroup) {
        scene.remove(dungeonWorldGroup);
        dungeonWorldGroup = null;
    }
    for (let i = enemies3D.length - 1; i >= 0; i--) {
        if (enemies3D[i].isDungeon) {
            scene.remove(enemies3D[i].mesh);
            enemies3D.splice(i, 1);
        }
    }
    worldState.activeDungeon = null;
    player.x = retX;
    player.y = retY + TILE_SIZE * 1.4;
    const hx = (player.x / TILE_SIZE) * WORLD_SCALE_3D;
    const hz = (player.y / TILE_SIZE) * WORLD_SCALE_3D;
    player.y3D = Math.max(WATER_SURFACE_Y + 0.3, sampleWorldHeight3D(hx, hz));
    player.vy3D = 0;
    showToast('Regreso al Mundo Abierto', 'Sales de la mazmorra hacia las tierras de Prydain.', 'fa-door-open');
}

function grantExperience(amount, { addLogEntry, showToast, updateHUDCounters }) {
    player.xp += amount;
    player.spendableXp += amount;
    while (player.xp >= player.xpToNext) {
        player.xp -= player.xpToNext;
        player.level++;
        player.xpToNext = Math.round(player.xpToNext * 1.42);
        player.maxHp += 15;
        player.hp = player.maxHp;
        player.maxMana += 15;
        player.mana = player.maxMana;
        addLogEntry(`¡Subiste a Nivel ${player.level}! Vitalidad y Maná aumentados.`);
        showToast(`¡Nivel ${player.level} Alcanzado!`, 'Vitalidad y Maná máximos +15. Nuevos hechizos disponibles en el Grimorio (B).', 'fa-star', 'border-amber-400 text-amber-300');
    }
    updateHUDCounters();
    applyEquippedWeaponVisuals();
}

function damageEnemy(scene, enemy, dmg, knockX = 0, knockZ = 0, callbacks) {
    if (enemy.dead) return;
    enemy.hp -= dmg;
    enemy.hitFlash = 0.22;
    enemy.x += knockX;
    enemy.z += knockZ;
    if (enemy.hp <= 0) {
        enemy.dead = true;
        enemy.respawnTimer = enemy.isDungeon ? 99999 : 36;
        enemy.mesh.visible = false;
        player.kills++;
        player.gold += enemy.goldReward;
        player.stamina = Math.min(player.maxStamina, player.stamina + 25);
        player.hp = Math.min(player.maxHp, player.hp + 8);
        grantExperience(enemy.xpReward, callbacks);
        spawnJumpBurst3D(scene, enemy.x, enemy.y, enemy.z, 0x10b981, 3.0);

        if (Math.random() < 0.35) {
            const pKeys = ['health', 'stamina', 'magic'];
            const pick = pKeys[Math.floor(Math.random() * pKeys.length)];
            player.potions[pick]++;
            callbacks.showToast('Botín de Combate', `+${enemy.goldReward} Oro, +${enemy.xpReward} XP y +1 ${POTIONS_CATALOG[pick].name}`, 'fa-skull');
        } else {
            callbacks.showToast(`${enemy.name} Derrotado`, `+${enemy.goldReward} Oro • +${enemy.xpReward} XP`, 'fa-skull');
        }

        if (enemy.isBoss && worldState.activeDungeon) {
            worldState.activeDungeon.bossDefeated = true;
            callbacks.showToast('¡Sello de Mazmorra Roto!', 'Abre el cofre del altar norte con Clic Derecho o E para recoger la reliquia.', 'fa-crown', 'border-amber-400 text-amber-300');
        }
        callbacks.updateHUDCounters();
    }
}

function performHeroAttack(scene, callbacks) {
    if (callbacks.isAnyModalOpen() || player.attackCooldown > 0) return;
    const hx = (player.x / TILE_SIZE) * WORLD_SCALE_3D;
    const hz = (player.y / TILE_SIZE) * WORLD_SCALE_3D;

    if (player.heldObject) {
        const obj = player.heldObject;
        obj.isHeld = false;
        obj.thrown = true;
        const fwdX = -Math.sin(worldState.camYaw);
        const fwdZ = -Math.cos(worldState.camYaw);
        player.rotationY = Math.atan2(fwdX, fwdZ);
        obj.vx = fwdX * 24;
        obj.vy = 7.5;
        obj.vz = fwdZ * 24;
        player.heldObject = null;
        player.attackCooldown = 0.25;
        spawnJumpBurst3D(scene, hx, player.y3D + 1.2, hz, 0xf59e0b, 2.0);
        callbacks.updateHUDCounters();
        return;
    }

    let fwdX = -Math.sin(worldState.camYaw);
    let fwdZ = -Math.cos(worldState.camYaw);
    let bestEnemy = null;
    let bestDist = 7.5;
    enemies3D.forEach(e => {
        if (e.dead || e.isDungeon !== !!worldState.activeDungeon) return;
        const d = Math.hypot(e.x - hx, e.z - hz);
        if (d < bestDist) {
            bestDist = d;
            bestEnemy = e;
        }
    });
    if (bestEnemy) {
        const dx = bestEnemy.x - hx;
        const dz = bestEnemy.z - hz;
        const len = Math.hypot(dx, dz) || 1;
        fwdX = dx / len;
        fwdZ = dz / len;
    }
    player.rotationY = Math.atan2(fwdX, fwdZ);

    const weapon = WEAPONS_CATALOG[player.equippedWeapon] || WEAPONS_CATALOG.apprentice_sword;
    const dmgMult = player.magicBuffTimer > 0 ? 1.6 : 1.0;
    const finalDmg = Math.round((weapon.damage + (player.level - 1) * 4) * dmgMult);

    player.attackTimer = 0.28;
    player.attackCooldown = 0.34;
    player.comboIndex = (player.comboIndex + 1) % 2;

    const arcGeo = new THREE.RingGeometry(0.9, 1.55, 16, 1, -Math.PI * 0.42, Math.PI * 0.84);
    arcGeo.rotateX(-Math.PI / 2);
    const arcMat = new THREE.MeshBasicMaterial({
        color: weapon.glowColor, transparent: true, opacity: 0.9,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const slashMesh = new THREE.Mesh(arcGeo, arcMat);
    slashMesh.position.set(hx + fwdX * 1.35, player.y3D + 1.25, hz + fwdZ * 1.35);
    slashMesh.rotation.y = Math.atan2(-fwdZ, fwdX);
    scene.add(slashMesh);
    swordSlashEffects.push({
        mesh: slashMesh, vx: fwdX * 15, vz: fwdZ * 15,
        age: 0, duration: 0.26
    });

    enemies3D.forEach(e => {
        if (e.dead || e.isDungeon !== !!worldState.activeDungeon) return;
        const dx = e.x - hx;
        const dz = e.z - hz;
        const dist = Math.hypot(dx, dz);
        if (dist <= weapon.range) {
            const dot = (dx * fwdX + dz * fwdZ) / (dist || 1);
            if (dot > 0.15 || dist < 2.2) {
                damageEnemy(scene, e, finalDmg, fwdX * 1.8, fwdZ * 1.8, callbacks);
            }
        }
    });
}

function performGrabOrInteract(scene, pbrTex, callbacks) {
    if (callbacks.isAnyModalOpen()) return;
    if (player.pilotingBoat || player.nearbyBoat) {
        callbacks.boardOrLeaveBoat();
        return;
    }
    const hx = (player.x / TILE_SIZE) * WORLD_SCALE_3D;
    const hz = (player.y / TILE_SIZE) * WORLD_SCALE_3D;

    if (worldState.activeDungeon) {
        const dng = worldState.activeDungeon;
        if (Math.hypot(hx - 0, hz - 24.5) < 4.5) {
            exitDungeon(scene, callbacks);
            return;
        }
        if (Math.hypot(hx - 0, hz + 23) < 4.5) {
            if (!dng.bossDefeated) {
                callbacks.showToast('Cofre Sellado', `Derrota primero a ${dng.def.bossName} para romper el sello oscuro.`, 'fa-lock', 'border-rose-400 text-rose-300');
            } else if (!dng.chestOpened) {
                dng.chestOpened = true;
                dng.def.cleared = true;
                player.gold += dng.def.rewardGold;
                grantExperience(dng.def.rewardXp, callbacks);
                player.relics.push({
                    name: dng.def.relicName,
                    desc: `Conquistado en ${dng.def.name}`,
                    icon: 'fa-crown'
                });
                callbacks.addLogEntry(`Conquistaste la mazmorra ${dng.def.name} y obtuviste ${dng.def.relicName}.`);
                callbacks.showToast('¡Mazmorra Conquistada!', `+${dng.def.rewardGold} Oro, +${dng.def.rewardXp} XP y Reliquia: ${dng.def.relicName}`, 'fa-crown', 'border-amber-400 text-amber-300');
                callbacks.updateHUDCounters();
            } else {
                callbacks.showToast('Cofre Vacío', 'Ya reclamaste el tesoro de esta mazmorra.', 'fa-box-open');
            }
            return;
        }
    }

    if (!worldState.activeDungeon && worldState.nearbyDungeonPortal) {
        enterDungeon(scene, pbrTex, worldState.nearbyDungeonPortal.def, callbacks);
        return;
    }

    if (!worldState.activeDungeon && worldState.nearbyPOI) {
        callbacks.interactWithPOI(worldState.nearbyPOI);
        return;
    }

    if (player.heldObject) {
        const obj = player.heldObject;
        obj.isHeld = false;
        obj.thrown = false;
        obj.vx = 0; obj.vy = 0; obj.vz = 0;
        player.heldObject = null;
        callbacks.showToast('Objeto Soltado', `Dejaste ${obj.name} en el suelo.`, 'fa-hand');
        callbacks.updateHUDCounters();
        return;
    }

    let closestObj = null, bestD = 5.2;
    grabbables3D.forEach(obj => {
        if (obj.isHeld) return;
        const d = Math.hypot(obj.mesh.position.x - hx, obj.mesh.position.z - hz);
        if (d < bestD) { bestD = d; closestObj = obj; }
    });
    if (closestObj) {
        closestObj.isHeld = true;
        closestObj.thrown = false;
        player.heldObject = closestObj;
        callbacks.showToast('Objeto Agarrado', `Llevas ${closestObj.name}. Clic Izquierdo para lanzar con fuerza arcana.`, 'fa-hand-fist');
        callbacks.updateHUDCounters();
    }
}

function usePotion(scene, type, callbacks) {
    if ((player.potions[type] || 0) <= 0) {
        callbacks.showToast('Sin Existencias', `No te quedan unidades de ${POTIONS_CATALOG[type].name}. Destila más en Inventario (I).`, 'fa-flask', 'border-rose-400 text-rose-300');
        return;
    }
    player.potions[type]--;
    const hx = (player.x / TILE_SIZE) * WORLD_SCALE_3D;
    const hz = (player.y / TILE_SIZE) * WORLD_SCALE_3D;
    if (type === 'health') {
        player.hp = Math.min(player.maxHp, player.hp + 55);
        spawnJumpBurst3D(scene, hx, player.y3D, hz, 0xf43f5e, 2.5);
        callbacks.showToast('Vitalidad Restaurada', '+55 puntos de Vitalidad.', 'fa-heart', 'border-rose-400 text-rose-300');
    } else if (type === 'stamina') {
        player.stamina = player.maxStamina;
        player.speedBuffTimer = 15;
        spawnJumpBurst3D(scene, hx, player.y3D, hz, 0x10b981, 2.5);
        callbacks.showToast('Vigor de Gurgi', 'Vigor al 100% y velocidad aumentada durante 15s.', 'fa-bolt', 'border-emerald-400 text-emerald-300');
    } else if (type === 'magic') {
        player.mana = Math.min(player.maxMana, player.mana + 50);
        player.magicBuffTimer = 25;
        spawnJumpBurst3D(scene, hx, player.y3D, hz, 0xa855f7, 3.0);
        callbacks.showToast('Magia de Eilonwy', '+50 Maná, +60% Daño y Triple Salto durante 25s.', 'fa-wand-sparkles', 'border-purple-400 text-purple-300');
    }
    callbacks.updateHUDCounters();
    if (!document.getElementById('inventoryModal').classList.contains('hidden')) callbacks.renderInventoryModalUI();
}

function cycleWeapon(callbacks) {
    if (player.ownedWeapons.length <= 1) return;
    const idx = player.ownedWeapons.indexOf(player.equippedWeapon);
    player.equippedWeapon = player.ownedWeapons[(idx + 1) % player.ownedWeapons.length];
    applyEquippedWeaponVisuals();
    callbacks.showToast('Arma Equipada', WEAPONS_CATALOG[player.equippedWeapon].name, 'fa-khanda');
}

function getSpellEffectiveStats(spell) {
    const lvl = player.spellLevels[spell.id] || 1;
    const power = Math.round(spell.basePower * (1 + (lvl - 1) * 0.28));
    const manaCost = Math.max(4, Math.round(spell.manaCost * (1 - (lvl - 1) * 0.06)));
    return { lvl, power, manaCost };
}

function castSpellById(scene, spellId, callbacks) {
    if (callbacks.isAnyModalOpen()) return;
    const spell = SPELLS_CATALOG.find(s => s.id === spellId);
    if (!spell || !player.unlockedSpells.includes(spellId)) return;

    const cd = player.spellCooldowns[spellId] || 0;
    if (cd > 0) return;

    const { lvl, power, manaCost } = getSpellEffectiveStats(spell);
    if (player.mana < manaCost) {
        callbacks.showToast('Maná Insuficiente', `Necesitas ${manaCost} MP para lanzar ${spell.name}.`, 'fa-hat-wizard', 'border-purple-400 text-purple-300');
        return;
    }

    player.mana -= manaCost;
    player.spellCooldowns[spellId] = Math.max(0.5, spell.cooldown * (1 - (lvl - 1) * 0.08));

    const hx = (player.x / TILE_SIZE) * WORLD_SCALE_3D;
    const hz = (player.y / TILE_SIZE) * WORLD_SCALE_3D;
    const fwdX = -Math.sin(worldState.camYaw);
    const fwdZ = -Math.cos(worldState.camYaw);
    const dmgMult = player.magicBuffTimer > 0 ? 1.5 : 1.0;

    if (spellId === 'arcane_light') {
        player.torchOn = !player.torchOn;
        callbacks.revealFogAround(Math.round(player.x / TILE_SIZE), Math.round(player.y / TILE_SIZE), 12 + lvl * 2);
        spawnJumpBurst3D(scene, hx, player.y3D, hz, 0xfde047, 3.6);
        callbacks.showToast(player.torchOn ? 'Luz Arcana Activada' : 'Luz Arcana Oculta', 'Pulso revelador emitido sobre el mapa.', 'fa-wand-magic-sparkles');
    } else if (spellId === 'cauldron_storm') {
        callbacks.cycleWeather(true);
        let target = null, minD = 32;
        enemies3D.forEach(e => {
            if (e.dead || e.isDungeon !== !!worldState.activeDungeon) return;
            const d = Math.hypot(e.x - hx, e.z - hz);
            if (d < minD) { minD = d; target = e; }
        });
        if (target) {
            spawnLightningStrike3D(scene, target.x, target.y, target.z, 0xa855f7);
            damageEnemy(scene, target, Math.round(power * dmgMult), 0, 0, callbacks);
        } else {
            spawnLightningStrike3D(scene, hx + fwdX * 8, player.y3D, hz + fwdZ * 8, 0xa855f7);
        }
    } else if (spellId === 'emerald_bolt') {
        const count = lvl >= 4 ? 3 : (lvl >= 2 ? 2 : 1);
        for (let i = 0; i < count; i++) {
            const spread = (i - (count - 1) / 2) * 0.22;
            const c = Math.cos(spread), s = Math.sin(spread);
            const vx = (fwdX * c - fwdZ * s) * 26;
            const vz = (fwdX * s + fwdZ * c) * 26;
            const orb = new THREE.Mesh(
                new THREE.SphereGeometry(0.32, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0x39ff14 })
            );
            orb.position.set(hx + fwdX * 1.1, player.y3D + 1.5, hz + fwdZ * 1.1);
            scene.add(orb);
            spellProjectiles3D.push({
                mesh: orb, vx, vz, damage: Math.round(power * dmgMult),
                age: 0, maxAge: 2.2, colorHex: 0x10b981
            });
        }
    } else if (spellId === 'undine_breath') {
        const restoreAmount = 30 + lvl * 10;
        player.oxygen = Math.min(player.maxOxygen, player.oxygen + restoreAmount);
        player.undineBreathTimer = 24 + lvl * 6;
        player.lowOxygenWarned = false;
        spawnJumpBurst3D(scene, hx, player.y3D + 0.6, hz, 0x22d3ee, 3.2);
        for (let b = 0; b < 8; b++) spawnUnderwaterBubble3D(scene, hx, player.y3D + 0.8, hz);
        const reductionPct = Math.min(85, 60 + lvl * 5);
        callbacks.showToast('Aliento de las Ondinas', `+${restoreAmount}% O₂ y -${reductionPct}% gasto de aire (${Math.round(player.undineBreathTimer)}s).`, 'fa-lungs', 'border-cyan-400 text-cyan-200');
    } else if (spellId === 'dallben_aegis') {
        player.aegisTimer = 10 + lvl * 2.5;
        player.hp = Math.min(player.maxHp, player.hp + 15 + lvl * 5);
        spawnJumpBurst3D(scene, hx, player.y3D, hz, 0x38bdf8, 3.8);
        callbacks.showToast('Égida de Caer Dallben', `Escudo protector activo (${Math.round(player.aegisTimer)}s).`, 'fa-shield-halved', 'border-sky-400 text-sky-300');
    } else if (spellId === 'morva_nova') {
        const rad = 9.5 + lvl * 1.6;
        spawnJumpBurst3D(scene, hx, player.y3D, hz, 0xc084fc, rad * 0.9);
        enemies3D.forEach(e => {
            if (e.dead || e.isDungeon !== !!worldState.activeDungeon) return;
            const dx = e.x - hx, dz = e.z - hz;
            const d = Math.hypot(dx, dz);
            if (d <= rad) {
                const nx = dx / (d || 1), nz = dz / (d || 1);
                damageEnemy(scene, e, Math.round(power * dmgMult), nx * 4.5, nz * 4.5, callbacks);
            }
        });
    } else if (spellId === 'frost_prison') {
        const rad = 10 + lvl * 1.5;
        spawnJumpBurst3D(scene, hx, player.y3D, hz, 0x67e8f9, rad * 0.9);
        enemies3D.forEach(e => {
            if (e.dead || e.isDungeon !== !!worldState.activeDungeon) return;
            if (Math.hypot(e.x - hx, e.z - hz) <= rad) {
                e.slowTimer = 8 + lvl;
                damageEnemy(scene, e, Math.round(power * dmgMult), 0, 0, callbacks);
            }
        });
        callbacks.showToast('Prisión de Escarcha', 'Enemigos cercanos congelados y ralentizados.', 'fa-snowflake', 'border-cyan-400 text-cyan-300');
    } else if (spellId === 'horned_judgment') {
        let hits = 0;
        enemies3D.forEach(e => {
            if (e.dead || e.isDungeon !== !!worldState.activeDungeon || hits >= 3 + lvl) return;
            if (Math.hypot(e.x - hx, e.z - hz) <= 22) {
                hits++;
                spawnLightningStrike3D(scene, e.x, e.y, e.z, 0xf43f5e);
                damageEnemy(scene, e, Math.round(power * dmgMult), 0, 0, callbacks);
                player.hp = Math.min(player.maxHp, player.hp + 14);
            }
        });
        if (hits === 0) spawnLightningStrike3D(scene, hx + fwdX * 7, player.y3D, hz + fwdZ * 7, 0xf43f5e);
    } else if (spellId === 'cauldron_cataclysm') {
        const rad = 16 + lvl * 2;
        spawnJumpBurst3D(scene, hx, player.y3D, hz, 0x39ff14, rad * 0.9);
        spawnJumpBurst3D(scene, hx, player.y3D + 0.5, hz, 0xa855f7, rad * 0.65);
        enemies3D.forEach(e => {
            if (e.dead || e.isDungeon !== !!worldState.activeDungeon) return;
            if (Math.hypot(e.x - hx, e.z - hz) <= rad) {
                spawnLightningStrike3D(scene, e.x, e.y, e.z, 0x39ff14);
                damageEnemy(scene, e, Math.round(power * dmgMult), 0, 0, callbacks);
            }
        });
    }
    callbacks.updateHUDCounters();
}

function cycleEquippedSpell(callbacks) {
    if (player.unlockedSpells.length === 0) return;
    const idx = player.unlockedSpells.indexOf(player.equippedSpellId);
    player.equippedSpellId = player.unlockedSpells[(idx + 1) % player.unlockedSpells.length];
    callbacks.updateHUDCounters();
    const sp = SPELLS_CATALOG.find(s => s.id === player.equippedSpellId);
    if (sp) callbacks.showToast('Hechizo Activo', `${sp.name} (Pulsa G para invocar)`, sp.icon, 'border-purple-400 text-purple-300');
}

function updateHeroAndCombatObjects(dt, elapsed, currentWaterY, groundY, isMoving, isSprinting, callbacks) {
    const hero3DX = (player.x / TILE_SIZE) * WORLD_SCALE_3D;
    const hero3DZ = (player.y / TILE_SIZE) * WORLD_SCALE_3D;

    player.jumpStretch = Math.max(0, player.jumpStretch - dt * 2.2);
    player.landSquash = Math.max(0, player.landSquash - dt * 3.0);
    const scaleY = 1 + player.jumpStretch - player.landSquash;
    const scaleXZ = 1 - player.jumpStretch * 0.4 + player.landSquash * 0.55;
    heroMeshRoot.scale.set(scaleXZ, scaleY, scaleXZ);

    const inWaterSwimPose = player.isSwimming || player.isDiving;
    const targetSwimPitch = inWaterSwimPose ? (isMoving ? 0.94 : 0.16) : 0;
    player.swimPitch += (targetSwimPitch - player.swimPitch) * Math.min(1, dt * 7);
    heroMeshRoot.rotation.x = player.swimPitch;
    heroBodyParts.headGroup.rotation.x = -player.swimPitch * 0.72;

    heroGroup.position.set(hero3DX, player.y3D, hero3DZ);
    heroGroup.rotation.y = player.rotationY;

    const heightAboveGround = Math.max(0, player.y3D - groundY);
    heroShadowMesh.position.set(hero3DX, groundY + 0.04, hero3DZ);
    heroShadowMesh.scale.setScalar(Math.max(0.28, 1 - heightAboveGround * 0.11));
    heroShadowMesh.material.opacity = Math.max(0.10, (inWaterSwimPose ? 0.34 : 0.55) - heightAboveGround * 0.06);

    const swing = Math.sin(player.walkFrame) * 0.55;
    if (inWaterSwimPose) {
        player.swimFrame += dt * (isMoving ? (isSprinting ? 10.5 : 7.0) : 3.5);
        const stroke = Math.sin(player.swimFrame);
        const kick = Math.sin(player.swimFrame * 1.9);
        heroBodyParts.leftArm.rotation.x = -Math.PI * 0.48 + stroke * 1.15;
        heroBodyParts.rightArmGroup.rotation.x = -Math.PI * 0.48 - stroke * 1.15;
        heroBodyParts.leftLeg.rotation.x = kick * 0.48;
        heroBodyParts.rightLeg.rotation.x = -kick * 0.48;
    } else if (!player.isGrounded && !player.pilotingBoat) {
        heroBodyParts.leftLeg.rotation.x = 0.55;
        heroBodyParts.rightLeg.rotation.x = -0.35;
        heroBodyParts.leftArm.rotation.x = -0.75;
        heroBodyParts.rightArmGroup.rotation.x = -0.55;
    } else {
        heroBodyParts.leftLeg.rotation.x = swing;
        heroBodyParts.rightLeg.rotation.x = -swing;
        heroBodyParts.leftArm.rotation.x = -swing * 0.7;
        heroBodyParts.rightArmGroup.rotation.x = swing * 0.4;
        heroBodyParts.cloakMesh.rotation.x = 0.22 + Math.abs(swing) * 0.35 + Math.sin(elapsed * 2.5) * 0.05;
    }

    if (player.attackTimer > 0) {
        player.attackTimer = Math.max(0, player.attackTimer - dt);
        const p = 1 - (player.attackTimer / 0.28);
        const slashSwing = Math.sin(p * Math.PI);
        heroBodyParts.rightArmGroup.rotation.x = -1.35 + slashSwing * 2.25;
        heroBodyParts.rightArmGroup.rotation.z = (player.comboIndex === 0 ? -0.45 : 0.45) * slashSwing;
    } else {
        heroBodyParts.rightArmGroup.rotation.z = 0;
    }
    if (player.attackCooldown > 0) player.attackCooldown = Math.max(0, player.attackCooldown - dt);

    grabbables3D.forEach(obj => {
        if (obj.isHeld) {
            const fwdX = Math.sin(player.rotationY);
            const fwdZ = Math.cos(player.rotationY);
            obj.mesh.position.set(hero3DX + fwdX * 1.15, player.y3D + 1.45 + Math.sin(elapsed * 5) * 0.08, hero3DZ + fwdZ * 1.15);
            obj.mesh.rotation.y += dt * 2.6;
        } else if (obj.thrown) {
            obj.vy += -28.0 * dt;
            obj.mesh.position.x += obj.vx * dt;
            obj.mesh.position.y += obj.vy * dt;
            obj.mesh.position.z += obj.vz * dt;
            obj.mesh.rotation.x += dt * 9;

            let hit = false;
            for (const en of enemies3D) {
                if (en.dead || en.isDungeon !== !!worldState.activeDungeon) continue;
                if (Math.hypot(obj.mesh.position.x - en.x, obj.mesh.position.z - en.z) < 2.2) {
                    damageEnemy(callbacks.scene, en, 65, obj.vx * 0.08, obj.vz * 0.08, callbacks);
                    hit = true;
                    break;
                }
            }
            const gY = sampleWorldHeight3D(obj.mesh.position.x, obj.mesh.position.z) + 0.45;
            if (hit || obj.mesh.position.y <= gY) {
                obj.mesh.position.y = gY;
                obj.thrown = false;
                spawnJumpBurst3D(callbacks.scene, obj.mesh.position.x, gY, obj.mesh.position.z, obj.colorHex, 2.2);
            }
			const baseFloorY = worldState.activeDungeon
				? DUNGEON_Y_OFFSET
				: sampleWorldHeight3D(obj.mesh.position.x, obj.mesh.position.z);
			gY = baseFloorY + 0.45;
            if (hit || obj.mesh.position.y <= gY) {
                obj.mesh.position.y = gY;
                obj.thrown = false;
                spawnJumpBurst3D(callbacks.scene, obj.mesh.position.x, gY, obj.mesh.position.z, obj.colorHex, 2.2);
            }
        }
    });

    if (baubleGroup) {
        const orbitSpeed = player.jumpCount > 1 ? 8.5 : 2.6;
        baubleGroup.position.set(Math.cos(elapsed * orbitSpeed) * 0.85, 2.15 + Math.sin(elapsed * 4.2) * 0.16, Math.sin(elapsed * orbitSpeed) * 0.85);
    }

    for (let i = jumpBurstEffects.length - 1; i >= 0; i--) {
        const fx = jumpBurstEffects[i];
        fx.age += dt;
        const t = fx.age / fx.duration;
        if (t >= 1) {
            callbacks.scene.remove(fx.mesh); fx.mesh.geometry.dispose(); fx.mesh.material.dispose();
            jumpBurstEffects.splice(i, 1);
        } else {
            const s = 1 + t * fx.maxScale;
            fx.mesh.scale.set(s, s, 1);
            fx.mesh.material.opacity = (1 - t) * 0.85;
        }
    }

    for (let i = waterBubbles3D.length - 1; i >= 0; i--) {
        const b = waterBubbles3D[i];
        b.age += dt;
        b.mesh.position.y += b.vy * dt;
        b.mesh.position.x += Math.sin(elapsed * 5 + b.wobblePhase) * 0.35 * dt;
        if (b.age >= b.maxAge || b.mesh.position.y >= currentWaterY) {
            callbacks.scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose();
            waterBubbles3D.splice(i, 1);
        }
    }

    for (let i = swordSlashEffects.length - 1; i >= 0; i--) {
        const sl = swordSlashEffects[i];
        sl.age += dt;
        const t = sl.age / sl.duration;
        if (t >= 1) {
            callbacks.scene.remove(sl.mesh); sl.mesh.geometry.dispose(); sl.mesh.material.dispose();
            swordSlashEffects.splice(i, 1);
        } else {
            sl.mesh.position.x += sl.vx * dt;
            sl.mesh.position.z += sl.vz * dt;
            sl.mesh.scale.setScalar(1 + t * 0.85);
            sl.mesh.material.opacity = (1 - t) * 0.9;
        }
    }

    for (let i = lightningEffects3D.length - 1; i >= 0; i--) {
        const lb = lightningEffects3D[i];
        lb.age += dt;
        const t = lb.age / lb.duration;
        if (t >= 1) {
            callbacks.scene.remove(lb.mesh); lb.mesh.geometry.dispose(); lb.mesh.material.dispose();
            lightningEffects3D.splice(i, 1);
        } else {
            lb.mesh.material.opacity = 1 - t;
        }
    }

    for (let i = spellProjectiles3D.length - 1; i >= 0; i--) {
        const sp = spellProjectiles3D[i];
        sp.age += dt;
        sp.mesh.position.x += sp.vx * dt;
        sp.mesh.position.z += sp.vz * dt;

        let detonated = false;
        for (const en of enemies3D) {
            if (en.dead || en.isDungeon !== !!worldState.activeDungeon) continue;
            if (Math.hypot(sp.mesh.position.x - en.x, sp.mesh.position.z - en.z) < 2.2) {
                damageEnemy(callbacks.scene, en, sp.damage, sp.vx * 0.06, sp.vz * 0.06, callbacks);
                detonated = true;
                break;
            }
        }
        if (detonated || sp.age >= sp.maxAge) {
            spawnJumpBurst3D(callbacks.scene, sp.mesh.position.x, sp.mesh.position.y - 0.5, sp.mesh.position.z, sp.colorHex, 2.8);
            callbacks.scene.remove(sp.mesh); sp.mesh.geometry.dispose(); sp.mesh.material.dispose();
            spellProjectiles3D.splice(i, 1);
        }
    }

    if (player.hurtTimer > 0) player.hurtTimer = Math.max(0, player.hurtTimer - dt);

    enemies3D.forEach((en, idx) => {
        if (en.dead) {
            en.respawnTimer -= dt;
            if (en.respawnTimer <= 0 && !en.isDungeon) {
                en.dead = false; en.hp = en.maxHp;
                en.x = en.homeX; en.z = en.homeZ;
                en.mesh.visible = true;
            }
            return;
        }
        if (en.isDungeon !== !!worldState.activeDungeon) {
            en.mesh.visible = false;
            return;
        }
        en.mesh.visible = true;

        if (en.attackCd > 0) en.attackCd = Math.max(0, en.attackCd - dt);
        if (en.slowTimer > 0) en.slowTimer = Math.max(0, en.slowTimer - dt);
        const slowMult = en.slowTimer > 0 ? 0.3 : 1.0;

        const distToHero = Math.hypot(hero3DX - en.x, hero3DZ - en.z);
        const aggroRange = en.isBoss ? 25 : 19;

        if (!callbacks.isAnyModalOpen() && distToHero < aggroRange) {
            const dx = hero3DX - en.x;
            const dz = hero3DZ - en.z;
            en.mesh.rotation.y = Math.atan2(dx, dz);
            const stopDist = en.isBoss ? 2.4 : 1.85;
            if (distToHero > stopDist) {
                const spd = (en.isBoss ? 6.2 : (en.kind === 'gwythaint' ? 7.6 : 5.6)) * slowMult;
                en.x += Math.sin(en.mesh.rotation.y) * spd * dt;
                en.z += Math.cos(en.mesh.rotation.y) * spd * dt;
            } else if (en.attackCd <= 0 && Math.abs(player.y3D - en.y) < 2.6) {
                en.attackCd = 1.35 / slowMult;
                callbacks.damagePlayer(en.damage, en.name);
            }
        } else {
            en.patrolAngle += dt * 0.55 * slowMult;
            const rad = en.isDungeon ? 3.5 : 5.5;
            const tx = en.homeX + Math.cos(en.patrolAngle + idx) * rad;
            const tz = en.homeZ + Math.sin(en.patrolAngle + idx) * rad;
            const dx = tx - en.x, dz = tz - en.z;
            if (Math.hypot(dx, dz) > 0.3) {
                en.mesh.rotation.y = Math.atan2(dx, dz);
                en.x += Math.sin(en.mesh.rotation.y) * 2.4 * slowMult * dt;
                en.z += Math.cos(en.mesh.rotation.y) * 2.4 * slowMult * dt;
            }
        }

        en.y = en.isDungeon ? DUNGEON_Y_OFFSET : Math.max(WATER_SURFACE_Y - 0.1, sampleWorldHeight3D(en.x, en.z));
        en.mesh.position.set(en.x, en.y, en.z);

        if (en.mesh.userData.hpBar) {
            const ratio = Math.max(0, en.hp / en.maxHp);
            en.mesh.userData.hpBar.scale.x = Math.max(0.01, ratio);
        }
        if (en.mesh.userData.leftWing && en.mesh.userData.rightWing) {
            const flap = Math.sin(elapsed * 13 + idx) * 0.55;
            en.mesh.userData.leftWing.rotation.z = -flap;
            en.mesh.userData.rightWing.rotation.z = flap;
        }
    });
}