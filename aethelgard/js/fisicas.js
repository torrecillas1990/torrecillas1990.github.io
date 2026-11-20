import {
    TILE_SIZE,
    WORLD_SCALE_3D,
    HALF_WORLD,
    WATER_SURFACE_Y,
    SWIM_START_DEPTH,
    SWIM_EXIT_DEPTH,
    DIVE_MIN_DEPTH,
    DUNGEON_Y_OFFSET,
    player,
    worldState,
    gameSettings
} from './config.js';
import { getHeightAtTile, getTileData } from './escenarios.js';

export const harborDocks = [];
export const navigableBoats = [];

export function sampleWorldHeight3D(wx, wz) {
    if (worldState.activeDungeon) return DUNGEON_Y_OFFSET;
    const tx = wx / WORLD_SCALE_3D;
    const ty = wz / WORLD_SCALE_3D;
    const ix = Math.floor(tx);
    const iy = Math.floor(ty);
    const fx = tx - ix;
    const fy = ty - iy;
    const h00 = getTileData(ix, iy).height3D;
    const h10 = getTileData(ix + 1, iy).height3D;
    const h01 = getTileData(ix, iy + 1).height3D;
    const h11 = getTileData(ix + 1, iy + 1).height3D;
    const h0 = h00 + (h10 - h00) * fx;
    const h1 = h01 + (h11 - h01) * fx;
    return h0 + (h1 - h0) * fy;
}

export function getSupportSurfaceHeight3D(wx, wz) {
    let h = sampleWorldHeight3D(wx, wz);
    if (worldState.activeDungeon) return h;
    const tx = Math.round(wx / WORLD_SCALE_3D);
    const ty = Math.round(wz / WORLD_SCALE_3D);
    const tile = getTileData(tx, ty);
    if (tile.prop && tile.prop.type === 'crag_rock') {
        const rx = tx * WORLD_SCALE_3D;
        const rz = ty * WORLD_SCALE_3D;
        const rad = 1.15 * (tile.prop.scale || 1);
        if (Math.hypot(wx - rx, wz - rz) < rad) {
            h += 1.05 * (tile.prop.scale || 1);
        }
    }
    return h;
}

export function isSolidAtWorldPos(wx, wy) {
    if (worldState.activeDungeon) {
        const w3DX = (wx / TILE_SIZE) * WORLD_SCALE_3D;
        const w3DZ = (wy / TILE_SIZE) * WORLD_SCALE_3D;
        if (Math.abs(w3DX) > 12.6) return true;
        if (Math.abs(w3DZ) > 25.6) return true;
        if (worldState.activeDungeon.columns) {
            for (const col of worldState.activeDungeon.columns) {
                if (Math.hypot(w3DX - col.x, w3DZ - col.z) < col.r) return true;
            }
        }
        return false;
    }
    const tx = Math.round(wx / TILE_SIZE);
    const ty = Math.round(wy / TILE_SIZE);
    const tile = getTileData(tx, ty);
    if (tile.prop && tile.prop.solid) {
        const propX = tx * TILE_SIZE;
        const propY = ty * TILE_SIZE;
        if (Math.hypot(wx - propX, wy - propY) < 20) {
            if (tile.prop.type === 'crag_rock') {
                const rockTop = tile.height3D + (tile.prop.scale || 1) * 0.95;
                if (player.y3D >= rockTop - 0.35) return false;
            }
            return true;
        }
    }
    return false;
}

function createSmallBoatMesh3D(hullMat, trimMat, sailMat, postMat) {
    const boat = new THREE.Group();

    const hullCenter = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 3.6), hullMat);
    hullCenter.position.y = 0.22;
    hullCenter.castShadow = true;
    hullCenter.receiveShadow = true;
    boat.add(hullCenter);

    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.48, 1.85, 4), hullMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.scale.set(1.0, 1.0, 0.48);
    bow.position.set(0, 0.24, 2.45);
    bow.castShadow = true;
    boat.add(bow);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.16, 3.72), trimMat);
    trim.position.y = 0.6;
    boat.add(trim);

    const seatFront = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.45), trimMat);
    seatFront.position.set(0, 0.48, 0.75);
    const seatHelm = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.55), trimMat);
    seatHelm.position.set(0, 0.48, -1.05);
    boat.add(seatFront, seatHelm);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 3.6, 6), postMat);
    mast.position.set(0, 2.0, 0.35);
    mast.castShadow = true;
    boat.add(mast);

    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 2.2), sailMat);
    sail.position.set(0, 2.25, 0.22);
    sail.rotation.y = 0.18;
    boat.add(sail);

    const tiller = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.95), trimMat);
    tiller.position.set(0, 0.72, -1.45);
    boat.add(tiller);

    const bowLantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0x34d399 }));
    bowLantern.position.set(0, 0.85, 2.95);
    boat.add(bowLantern);

    return boat;
}

export function buildHarborsAndBoats3D(scene, pbrTex) {
    harborDocks.length = 0;
    navigableBoats.length = 0;
    if (!scene) return;

    const candidateHarbors = [];
    for (let tx = -HALF_WORLD + 8; tx <= HALF_WORLD - 8; tx += 5) {
        for (let ty = -HALF_WORLD + 8; ty <= HALF_WORLD - 8; ty += 5) {
            const hCenter = getHeightAtTile(tx, ty);
            if (hCenter < -0.15 || hCenter > 1.45) continue;

            const dirs = [
                { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
                { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
            ];
            for (const d of dirs) {
                const nearH = getHeightAtTile(tx + d.dx * 3, ty + d.dy * 3);
                const deepH = getHeightAtTile(tx + d.dx * 6, ty + d.dy * 6);
                const openH1 = getHeightAtTile(tx + d.dx * 6 - d.dy * 3, ty + d.dy * 6 + d.dx * 3);
                const openH2 = getHeightAtTile(tx + d.dx * 6 + d.dy * 3, ty + d.dy * 6 - d.dx * 3);
                if (nearH < -0.7 && deepH < -1.55 && openH1 < -1.0 && openH2 < -1.0) {
                    candidateHarbors.push({
                        tx, ty, dx: d.dx, dy: d.dy,
                        score: Math.abs(deepH) + Math.abs(openH1) + Math.abs(openH2)
                    });
                    break;
                }
            }
        }
    }

    candidateHarbors.sort((a, b) => b.score - a.score);
    const selectedHarbors = [];
    const harborNames = [
        'Muelle de Caer Dallben',
        'Puerto Bruma de Morva',
        'Atracadero del Alba',
        'Muelle de las Cumbres'
    ];

    for (const cand of candidateHarbors) {
        if (selectedHarbors.length >= 4) break;
        const tooClose = selectedHarbors.some(h => Math.hypot(h.tx - cand.tx, h.ty - cand.ty) < 24);
        if (!tooClose) selectedHarbors.push(cand);
    }

    const woodDeckMat = new THREE.MeshStandardMaterial({ map: pbrTex.wood, color: 0x6b4426, roughness: 0.85 });
    const postMat = new THREE.MeshStandardMaterial({ map: pbrTex.wood, color: 0x3b2313, roughness: 0.9 });
    const hullMat = new THREE.MeshStandardMaterial({ map: pbrTex.wood, color: 0x7c4a27, roughness: 0.72 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55, metalness: 0.25 });
    const sailMat = new THREE.MeshStandardMaterial({ map: pbrTex.linen, color: 0xe2e8f0, roughness: 0.8, side: THREE.DoubleSide });

    selectedHarbors.forEach((h, idx) => {
        const shoreWX = h.tx * WORLD_SCALE_3D;
        const shoreWZ = h.ty * WORLD_SCALE_3D;
        const seaAngle = Math.atan2(h.dx, h.dy);

        const dockGroup = new THREE.Group();
        dockGroup.position.set(shoreWX, -0.02, shoreWZ);
        dockGroup.rotation.y = seaAngle;

        const pierLen = 11.5;
        const pierWidth = 3.2;
        const deck = new THREE.Mesh(new THREE.BoxGeometry(pierWidth, 0.28, pierLen), woodDeckMat);
        deck.position.set(0, 0.14, pierLen * 0.45);
        deck.castShadow = true;
        deck.receiveShadow = true;
        dockGroup.add(deck);

        [-1.35, 1.35].forEach(sideX => {
            [1.2, 5.2, 9.4].forEach((zOff, pIdx) => {
                const postH = pIdx === 2 ? 2.6 : 1.7;
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, postH, 7), postMat);
                post.position.set(sideX, postH * 0.5 - 0.8, zOff);
                post.castShadow = true;
                dockGroup.add(post);

                if (pIdx === 2) {
                    const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
                    lantern.position.set(sideX, postH - 0.65, zOff);
                    dockGroup.add(lantern);
                }
            });
        });

        const dockLight = new THREE.PointLight(0xf59e0b, 1.9, 18);
        dockLight.position.set(0, 2.5, 9.2);
        dockGroup.add(dockLight);
        scene.add(dockGroup);

        const harborInfo = {
            id: `harbor_${idx}`,
            name: harborNames[idx] || `Puerto de Prydain ${idx + 1}`,
            tx: h.tx, ty: h.ty, wx: shoreWX, wz: shoreWZ
        };
        harborDocks.push(harborInfo);

        [-1, 1].forEach((sideSign, bIdx) => {
            const forwardDist = 6.2 + bIdx * 3.4;
            const sideDist = sideSign * 3.1;
            const boatWX = shoreWX + h.dx * forwardDist - h.dy * sideDist;
            const boatWZ = shoreWZ + h.dy * forwardDist + h.dx * sideDist;
            const boatHeading = seaAngle + (sideSign > 0 ? 0.25 : -0.25);

            const boatMesh = createSmallBoatMesh3D(hullMat, trimMat, sailMat, postMat);
            boatMesh.position.set(boatWX, WATER_SURFACE_Y, boatWZ);
            boatMesh.rotation.y = boatHeading;
            scene.add(boatMesh);

            navigableBoats.push({
                id: `boat_${idx}_${bIdx}`,
                name: bIdx === 0 ? `Esquife de ${harborInfo.name.replace('Muelle de ', '').replace('Puerto ', '')}` : `Balandro Ligero #${idx + 1}`,
                mesh: boatMesh,
                wx: boatWX, wz: boatWZ,
                heading: boatHeading,
                speed: 0, maxSpeed: 19.0, wakeTimer: 0
            });
        });
    });
}

export function boardOrLeaveBoat(targetBoat, { isAnyModalOpen, showToast }) {
    if (player.pilotingBoat) {
        const boat = player.pilotingBoat;
        player.pilotingBoat = null;

        const sideX = Math.cos(boat.heading) * 2.1;
        const sideZ = -Math.sin(boat.heading) * 2.1;
        const exitWX = boat.wx + sideX;
        const exitWZ = boat.wz + sideZ;

        player.x = (exitWX / WORLD_SCALE_3D) * TILE_SIZE;
        player.y = (exitWZ / WORLD_SCALE_3D) * TILE_SIZE;
        player.y3D = Math.max(sampleWorldHeight3D(exitWX, exitWZ), WATER_SURFACE_Y - 0.15);
        player.vy3D = 0;

        const helmPanel = document.getElementById('boatHelmPanel');
        if (helmPanel) {
            helmPanel.classList.add('hidden');
            helmPanel.classList.remove('flex');
        }
        showToast('Desembarque', `Has soltado el timón de ${boat.name}.`, 'fa-anchor', 'border-amber-400 text-amber-200');
        return true;
    }

    const boatToBoard = targetBoat || player.nearbyBoat;
    if (!boatToBoard) return false;

    player.pilotingBoat = boatToBoard;
    player.isDiving = false;
    player.isSwimming = false;
    player.vy3D = 0;

    const helmPanel = document.getElementById('boatHelmPanel');
    const helmName = document.getElementById('boatHelmName');
    if (helmName) helmName.textContent = boatToBoard.name;
    if (helmPanel) {
        helmPanel.classList.remove('hidden');
        helmPanel.classList.add('flex');
    }
    showToast(`¡Al Timón: ${boatToBoard.name}!`, 'Usa W/S para navegar rápido por el mar y A/D para virar.', 'fa-sailboat', 'border-amber-400 text-amber-200');
    return true;
}

export function updateBoatsAndNavigation(dt, elapsed, currentWaterY, { keys, touchVector, touchSprint, isAnyModalOpen, spawnWaterRipple3D, revealFogAround }) {
    if (worldState.activeDungeon) {
        player.nearbyBoat = null;
        return;
    }

    for (const boat of navigableBoats) {
        if (player.pilotingBoat === boat) continue;
        boat.speed *= Math.max(0, 1 - dt * 2.5);
        const bob = Math.sin(elapsed * 2.2 + boat.wx * 0.2) * 0.06;
        boat.mesh.position.set(boat.wx, currentWaterY + 0.04 + bob, boat.wz);
        boat.mesh.rotation.y = boat.heading;
        boat.mesh.rotation.z = Math.sin(elapsed * 1.7 + boat.wz * 0.2) * 0.04;
        boat.mesh.rotation.x = Math.cos(elapsed * 1.5 + boat.wx * 0.2) * 0.03;
    }

    if (player.pilotingBoat) {
        const boat = player.pilotingBoat;
        let throttle = 0;
        let steer = 0;
        if (!isAnyModalOpen()) {
            if (keys['w'] || keys['arrowup']) throttle += 1;
            if (keys['s'] || keys['arrowdown']) throttle -= 0.65;
            if (keys['a'] || keys['arrowleft']) steer += 1;
            if (keys['d'] || keys['arrowright']) steer -= 1;
            if (touchVector.active) {
                throttle = -touchVector.y;
                steer = -touchVector.x;
            }
        }

        const boost = (!isAnyModalOpen() && (keys['shift'] || touchSprint)) ? 1.25 : 1.0;
        const targetSpeed = throttle * boat.maxSpeed * boost;
        boat.speed += (targetSpeed - boat.speed) * Math.min(1, dt * 3.2);

        const turnDirection = boat.speed >= -0.2 ? 1 : -1;
        boat.heading += steer * 1.75 * dt * turnDirection;

        const stepDist = boat.speed * dt;
        const candWX = boat.wx + Math.sin(boat.heading) * stepDist;
        const candWZ = boat.wz + Math.cos(boat.heading) * stepDist;
        const maxBound3D = (HALF_WORLD - 5) * WORLD_SCALE_3D;
		
		const knots = Math.round(Math.abs(boat.speed) * 1.4);

        if (
            Math.abs(candWX) < maxBound3D &&
            Math.abs(candWZ) < maxBound3D &&
            sampleWorldHeight3D(candWX, candWZ) < currentWaterY - 0.42
        ) {
            boat.wx = candWX;
            boat.wz = candWZ;
        } else {
            boat.speed *= -0.2;
        }

        const bob = Math.sin(elapsed * 2.8) * 0.05;
        const speedRatio = Math.min(1, Math.abs(boat.speed) / boat.maxSpeed);
        boat.mesh.position.set(boat.wx, currentWaterY + 0.05 + bob, boat.wz);
        boat.mesh.rotation.y = boat.heading;
        boat.mesh.rotation.z = -steer * 0.11 * speedRatio + Math.sin(elapsed * 2.1) * 0.025;
        boat.mesh.rotation.x = -speedRatio * 0.06;

        const helmLocalZ = -0.85;
        const heroWX = boat.wx + Math.sin(boat.heading) * helmLocalZ;
        const heroWZ = boat.wz + Math.cos(boat.heading) * helmLocalZ;
        player.x = (heroWX / WORLD_SCALE_3D) * TILE_SIZE;
        player.y = (heroWZ / WORLD_SCALE_3D) * TILE_SIZE;
        player.y3D = boat.mesh.position.y + 0.56;
        player.rotationY = boat.heading;

        boat.wakeTimer -= dt;
        if (Math.abs(boat.speed) > 1.5 && boat.wakeTimer <= 0) {
            boat.wakeTimer = 0.14;
            const sternX = boat.wx - Math.sin(boat.heading) * 2.1;
            const sternZ = boat.wz - Math.cos(boat.heading) * 2.1;
            spawnWaterRipple3D(sternX, currentWaterY + 0.03, sternZ, 1.8 + speedRatio * 1.4);
        }

        const curTx = Math.round(player.x / TILE_SIZE);
        const curTy = Math.round(player.y / TILE_SIZE);
        revealFogAround(curTx, curTy, 12);

        const speedEl = document.getElementById('boatHelmSpeed');
        if (speedEl) {
            speedEl.textContent = `${knots} nudos • W/S Impulso • A/D Virar`;
        }
        return;
    }

    const hero3DX = (player.x / TILE_SIZE) * WORLD_SCALE_3D;
    const hero3DZ = (player.y / TILE_SIZE) * WORLD_SCALE_3D;
    let closestBoat = null;
    let closestDist = 4.6;
    for (const boat of navigableBoats) {
        const d = Math.hypot(hero3DX - boat.wx, hero3DZ - boat.wz);
        if (d < closestDist) {
            closestDist = d;
            closestBoat = boat;
        }
    }
    player.nearbyBoat = closestBoat;
}

export function stepVerticalAndWaterPhysics(dt, elapsed, currentWaterY, groundY, isMoving, isSprinting, {
    keys, diveDownBtnHeld, diveUpBtnHeld, touchAscend, isAnyModalOpen,
    spawnJumpBurst3D, spawnWaterRipple3D, spawnUnderwaterBubble3D, showToast, damagePlayer
}) {
    const hero3DX = (player.x / TILE_SIZE) * WORLD_SCALE_3D;
    const hero3DZ = (player.y / TILE_SIZE) * WORLD_SCALE_3D;

    player.waterDepth = worldState.activeDungeon ? 0 : Math.max(0, currentWaterY - groundY);
    const targetSwimY = currentWaterY - (isMoving ? 1.04 : 1.44);

    const wantsDiveDown = !isAnyModalOpen() && !player.pilotingBoat && (keys['z'] || keys['control'] || diveDownBtnHeld);
    const wantsDiveUp = !isAnyModalOpen() && !player.pilotingBoat && (keys[' '] || keys['space'] || diveUpBtnHeld || touchAscend);

    const btnDiveDown = document.getElementById('btnDiveDown');
    const btnDiveUp = document.getElementById('btnDiveUp');
    if (btnDiveDown) btnDiveDown.classList.toggle('dive-btn-active', wantsDiveDown);
    if (btnDiveUp) btnDiveUp.classList.toggle('dive-btn-active', wantsDiveUp);

    if (player.pilotingBoat) {
        player.isSwimming = false;
        player.isDiving = false;
        player.isGrounded = true;
    } else {
        if (!worldState.activeDungeon && player.waterDepth >= DIVE_MIN_DEPTH && wantsDiveDown && (player.isSwimming || player.isDiving)) {
            player.isDiving = true;
            player.isSwimming = false;
        }
        if (player.isDiving && (worldState.activeDungeon || player.waterDepth < 1.35)) {
            player.isDiving = false;
        }

        if (player.isDiving) {
            const diveVertSpeed = 5.4;
            if (wantsDiveDown) player.y3D -= diveVertSpeed * dt;
            if (wantsDiveUp) player.y3D += diveVertSpeed * dt;

            const minFloorY = groundY + 0.35;
            if (player.y3D < minFloorY) player.y3D = minFloorY;
            if (player.y3D >= targetSwimY) {
                player.y3D = targetSwimY;
                player.isDiving = false;
                player.isSwimming = true;
            }
            player.vy3D = 0;
            player.isGrounded = false;
        } else if (!worldState.activeDungeon && player.waterDepth >= SWIM_START_DEPTH && player.y3D <= targetSwimY + 0.28 && player.vy3D <= 2.5) {
            if (!player.isSwimming) {
                player.isSwimming = true;
                player.isGrounded = false;
                player.jumpCount = 0;
                spawnWaterRipple3D(hero3DX, currentWaterY, hero3DZ, 3.0, 0x67e8f9);
            }
        } else if (player.isSwimming && (worldState.activeDungeon || player.waterDepth < SWIM_EXIT_DEPTH)) {
            player.isSwimming = false;
        }

        if (!player.isDiving) {
            if (player.isSwimming) {
                const swimBobY = targetSwimY + Math.sin(elapsed * 3.1) * 0.06;
                player.vy3D += (swimBobY - player.y3D) * 20 * dt;
                player.vy3D *= Math.pow(0.05, dt);
                player.y3D += player.vy3D * dt;
                if (player.y3D < groundY) {
                    player.y3D = groundY;
                    player.vy3D = Math.max(0, player.vy3D);
                }
                player.isGrounded = false;
                player.jumpCount = 0;
            } else if (!player.isGrounded || player.y3D > groundY + 0.04) {
                player.vy3D += player.gravity * dt;
                player.y3D += player.vy3D * dt;
                if (player.y3D <= groundY) {
                    const impactSpeed = Math.abs(player.vy3D);
                    player.y3D = groundY;
                    player.vy3D = 0;
                    player.isGrounded = true;
                    player.jumpCount = 0;
                    if (impactSpeed > 6) {
                        player.landSquash = Math.min(0.38, impactSpeed * 0.018);
                        spawnJumpBurst3D(hero3DX, groundY, hero3DZ, 0x10b981, 1.9);
                    }
                } else {
                    player.isGrounded = false;
                }
            } else {
                player.y3D = groundY;
                player.vy3D = 0;
                player.isGrounded = true;
                player.jumpCount = 0;
            }
        }
    }

    if (player.isDiving) {
        const spellLvl = player.spellLevels['undine_breath'] || 1;
        const breathSaverMult = player.undineBreathTimer > 0 ? Math.max(0.15, 0.40 - spellLvl * 0.05) : 1.0;
        player.oxygen = Math.max(0, player.oxygen - 7.5 * breathSaverMult * dt);

        player.bubbleCooldown -= dt;
        if (player.bubbleCooldown <= 0) {
            player.bubbleCooldown = player.undineBreathTimer > 0 ? 0.25 : 0.48;
            spawnUnderwaterBubble3D(hero3DX, player.y3D + 1.6, hero3DZ);
        }

        if (player.oxygen <= 25 && !player.lowOxygenWarned) {
            player.lowOxygenWarned = true;
            showToast('¡Oxígeno Bajo!', 'Pulsa Subir (Espacio) o lanza Aliento de las Ondinas (G).', 'fa-lungs', 'border-cyan-400 text-cyan-200');
        }
        if (player.oxygen <= 0) {
            player.hp = Math.max(0, player.hp - 12 * dt);
            if (player.hp <= 0) damagePlayer(999, 'Ahogamiento');
        }
    } else {
        player.lowOxygenWarned = false;
        if (player.oxygen < player.maxOxygen) {
            player.oxygen = Math.min(player.maxOxygen, player.oxygen + 26 * dt);
        }
    }

    const divePanel = document.getElementById('divingControlsPanel');
    const oxyContainer = document.getElementById('hudOxygenContainer');
    const uwOverlay = document.getElementById('underwaterOverlay');
    const showDiveUI = !worldState.activeDungeon && !player.pilotingBoat && player.waterDepth >= DIVE_MIN_DEPTH && (player.isSwimming || player.isDiving);

    if (divePanel) {
        divePanel.classList.toggle('hidden', !showDiveUI);
        divePanel.classList.toggle('flex', showDiveUI);
        if (showDiveUI) {
            const subDepth = Math.max(0, currentWaterY - (player.y3D + 1.4));
            document.getElementById('divePanelDepth').textContent = `${subDepth.toFixed(1)}m / ${player.waterDepth.toFixed(1)}m`;
            document.getElementById('divePanelO2').textContent = `O₂ ${Math.round(player.oxygen)}%`;
        }
    }
    if (oxyContainer) {
        oxyContainer.classList.toggle('hidden', !(player.isDiving || player.oxygen < player.maxOxygen - 0.5));
        document.getElementById('hudOxygenBar').style.width = `${player.oxygen}%`;
        document.getElementById('hudOxygenText').textContent = `${Math.round(player.oxygen)}%`;
    }
    if (uwOverlay) {
        uwOverlay.style.opacity = player.isDiving ? '1' : '0';
        uwOverlay.classList.toggle('drowning', player.isDiving && player.oxygen <= 0);
    }

    void isSprinting;
    void gameSettings;
}