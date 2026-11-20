
class WorldNoise {
    constructor(seed = 1985) { this.seed = seed; }
    hash(x, y) {
        const n = Math.sin(x * 127.1 + y * 311.7 + this.seed) * 43758.5453123;
        return n - Math.floor(n);
    }
    lerp(a, b, t) { return a + (b - a) * t; }
    smoothNoise(x, y) {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const fx = x - ix;
        const fy = y - iy;
        const ux = fx * fx * (3 - 2 * fx);
        const uy = fy * fy * (3 - 2 * fy);
        const a = this.hash(ix, iy);
        const b = this.hash(ix + 1, iy);
        const c = this.hash(ix, iy + 1);
        const d = this.hash(ix + 1, iy + 1);
        return this.lerp(this.lerp(a, b, ux), this.lerp(c, d, ux), uy);
    }
    fbm(x, y, octaves = 3) {
        let value = 0, amp = 0.5, freq = 1;
        for (let i = 0; i < octaves; i++) {
            value += amp * this.smoothNoise(x * freq, y * freq);
            freq *= 2.03;
            amp *= 0.5;
        }
        return value;
    }
}

const noiseElev = new WorldNoise(1985);
const noiseMoist = new WorldNoise(909);
const noiseDetail = new WorldNoise(777);

const worldGrid = new Array(WORLD_TILES);
const fogGrid = new Array(WORLD_TILES);
let totalDiscoveredCells = 0;

function incrementDiscoveredCells() {
    totalDiscoveredCells++;
    return totalDiscoveredCells;
}

function getElevationAtTile(tx, ty) {
    const distFromCenter = Math.hypot(tx, ty);
    const gx = tx + HALF_WORLD;
    const gy = ty + HALF_WORLD;
    let e = noiseElev.fbm(gx * 0.045, gy * 0.045, 3);

    const lagoonDist = Math.hypot(tx + 13, ty - 9);
    if (lagoonDist < 10.5) {
        const coveFactor = Math.max(0, 1 - lagoonDist / 10.5);
        const smoothCove = coveFactor * coveFactor * (3 - 2 * coveFactor);
        e = e * (1 - smoothCove) + 0.05 * smoothCove;
    }

    if (distFromCenter < 6.2) {
        e = 0.46;
    } else if (distFromCenter < 8.4) {
        const t = (distFromCenter - 6.2) / 2.2;
        const st = t * t * (3 - 2 * t);
        e = 0.46 * (1 - st) + e * st;
    } else if (distFromCenter > HALF_WORLD - 13) {
        const edgeT = Math.min(1, (distFromCenter - (HALF_WORLD - 13)) / 10.5);
        const smoothEdge = edgeT * edgeT * (3 - 2 * edgeT);
        e = e * (1 - smoothEdge) + 0.03 * smoothEdge;
    }
    return e;
}

function getHeightAtTile(tx, ty) {
    const e = getElevationAtTile(tx, ty);
    if (e < 0.30) {
        const depthNorm = (0.30 - e) / 0.27;
        const depthMeters = Math.pow(Math.max(0, depthNorm), 1.25) * 9.2;
        return WATER_SURFACE_Y - Math.min(9.2, depthMeters);
    }
    if (e > 0.70) return (e - 0.30) * 16.5;
    return (e - 0.30) * 7.8;
}

function getTileData(tx, ty) {
    const gx = Math.round(tx) + HALF_WORLD;
    const gy = Math.round(ty) + HALF_WORLD;
    if (gx < 0 || gx >= WORLD_TILES || gy < 0 || gy >= WORLD_TILES) {
        return { biome: BIOMES.LAKE, prop: null, elev: 0.04, detail: 0.5, height3D: -8.5 };
    }
    return worldGrid[gx][gy];
}

function generateWorld() {
    totalDiscoveredCells = 0;
    for (let gx = 0; gx < WORLD_TILES; gx++) {
        worldGrid[gx] = new Array(WORLD_TILES);
        fogGrid[gx] = new Uint8Array(WORLD_TILES);
        for (let gy = 0; gy < WORLD_TILES; gy++) {
            const tx = gx - HALF_WORLD;
            const ty = gy - HALF_WORLD;
            const distFromCenter = Math.hypot(tx, ty);
            const e = getElevationAtTile(tx, ty);
            let m = noiseMoist.fbm(gx * 0.045 + 50, gy * 0.045 + 50, 3);
            const detail = noiseDetail.hash(gx, gy);

            if (distFromCenter < 7) m = 0.52;

            let biome = BIOMES.MEADOW;
            if (e < 0.30) biome = BIOMES.LAKE;
            else if (e > 0.70) biome = BIOMES.SNOW;
            else if (m < 0.34 && e < 0.62) biome = BIOMES.DESERT;
            else if (e > 0.56 && m < 0.49) biome = BIOMES.RUINS;
            else if (m > 0.55) biome = BIOMES.FOREST;

            let prop = null;
            if (distFromCenter > 5 && biome !== BIOMES.LAKE) {
                if (biome === BIOMES.FOREST && detail > 0.79) {
                    prop = { type: 'twisted_tree', solid: true, scale: 0.85 + (detail - 0.79) * 3.2 };
                } else if (biome === BIOMES.MEADOW && detail > 0.91) {
                    prop = { type: 'twisted_tree', solid: true, scale: 0.9 + detail * 0.35 };
                } else if (biome === BIOMES.SNOW && detail > 0.85) {
                    prop = { type: 'dead_pine', solid: true, scale: 0.9 + (detail - 0.8) * 2.2 };
                } else if (biome === BIOMES.RUINS && detail > 0.84) {
                    prop = { type: 'gothic_spire', solid: true, scale: 0.8 + (detail - 0.8) * 2.8 };
                } else if (biome === BIOMES.DESERT && detail > 0.89) {
                    prop = { type: 'gothic_spire', solid: true, scale: 0.72 };
                } else if (detail > 0.63 && detail < 0.654) {
                    prop = { type: 'crag_rock', solid: true, scale: 0.75 + detail * 0.5 };
                }
            }

            const height3D = getHeightAtTile(tx, ty);
            worldGrid[gx][gy] = { biome, prop, elev: e, detail, height3D };
        }
    }
}

function clearTerrainAroundPOIs() {
    const clearPoints = [
        ...pointsOfInterest.map(p => ({ tx: p.tx, ty: p.ty })),
        ...DUNGEONS_DEF.map(d => ({ tx: d.tx, ty: d.ty }))
    ];
    clearPoints.forEach(pt => {
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                const gx = pt.tx + dx + HALF_WORLD;
                const gy = pt.ty + dy + HALF_WORLD;
                if (gx >= 0 && gx < WORLD_TILES && gy >= 0 && gy < WORLD_TILES) {
                    worldGrid[gx][gy].prop = null;
                    if (worldGrid[gx][gy].biome === BIOMES.LAKE) {
                        worldGrid[gx][gy].biome = BIOMES.MEADOW;
                        worldGrid[gx][gy].height3D = 0.25;
                    }
                }
            }
        }
    });
}

function createPBRMicroTexture(type) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');

    if (type === 'skin') {
        ctx.fillStyle = '#e5b28f';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 1600; i++) {
            const x = (i * 73.1) % 256;
            const y = (i * 41.9) % 256;
            ctx.fillStyle = i % 3 === 0 ? 'rgba(130,65,45,0.16)' : 'rgba(255,225,200,0.12)';
            ctx.fillRect(x, y, 2, 2);
        }
    } else if (type === 'linen') {
        ctx.fillStyle = '#2d5843';
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 256; i += 4) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
        }
    } else if (type === 'leather') {
        ctx.fillStyle = '#472c1f';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 400; i++) {
            ctx.strokeStyle = i % 2 === 0 ? 'rgba(20,10,5,0.28)' : 'rgba(140,95,65,0.15)';
            ctx.beginPath();
            const x = (Math.sin(i * 19.3) * 0.5 + 0.5) * 256;
            const y = (Math.cos(i * 31.7) * 0.5 + 0.5) * 256;
            ctx.moveTo(x, y); ctx.lineTo(x + 12, y + (i % 7) - 3); ctx.stroke();
        }
    } else if (type === 'wood') {
        ctx.fillStyle = '#2d1c22';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 160; i++) {
            ctx.fillStyle = i % 2 === 0 ? 'rgba(12,6,10,0.45)' : 'rgba(80,55,48,0.22)';
            ctx.fillRect((i * 17) % 256, 0, 2 + (i % 4), 256);
        }
    } else if (type === 'stone') {
        ctx.fillStyle = '#39334a';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 650; i++) {
            const x = (Math.sin(i * 91.1) * 0.5 + 0.5) * 256;
            const y = (Math.cos(i * 53.7) * 0.5 + 0.5) * 256;
            ctx.fillStyle = i % 5 === 0 ? 'rgba(34,115,72,0.26)' : (i % 2 === 0 ? 'rgba(18,14,28,0.32)' : 'rgba(165,155,195,0.12)');
            ctx.fillRect(x, y, 8 + (i % 14), 6 + (i % 10));
        }
    } else if (type === 'iron') {
        ctx.fillStyle = '#1b1824';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 420; i++) {
            const x = (Math.sin(i * 67.3) * 0.5 + 0.5) * 256;
            const y = (Math.cos(i * 29.1) * 0.5 + 0.5) * 256;
            ctx.fillStyle = i % 4 === 0 ? 'rgba(138,58,28,0.35)' : 'rgba(90,95,120,0.16)';
            ctx.fillRect(x, y, 6 + (i % 10), 6 + (i % 8));
        }
    } else {
        ctx.fillStyle = '#c8c8c8';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 420; i++) {
            ctx.fillStyle = i % 3 === 0 ? '#ffffff' : (i % 2 === 0 ? '#808080' : '#b2b2b2');
            ctx.globalAlpha = 0.2;
            const x = (Math.sin(i * 73.1) * 0.5 + 0.5) * 256;
            const y = (Math.cos(i * 41.7) * 0.5 + 0.5) * 256;
            ctx.fillRect(x, y, 10 + (i % 20), 4 + (i % 8));
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (type === 'terrain') tex.repeat.set(28, 28);
    return tex;
}

function createToonGradientTexture() {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 1;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#484848'; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = '#8e8e8e'; ctx.fillRect(1, 0, 1, 1);
    ctx.fillStyle = '#d2d2d2'; ctx.fillRect(2, 0, 1, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(3, 0, 1, 1);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    return tex;
}

function buildAtmosphericSky3D(scene) {
    const skyGeo = new THREE.SphereGeometry(195, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
            topColor: { value: new THREE.Color(0x090418) },
            horizonColor: { value: new THREE.Color(0x1e1035) },
            glowColor: { value: new THREE.Color(0x0b3b2e) }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 horizonColor;
            uniform vec3 glowColor;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition).y;
                float t = clamp(h * 1.4, 0.0, 1.0);
                vec3 col = mix(horizonColor, topColor, pow(t, 0.75));
                float horizonBand = exp(-abs(h) * 8.5);
                col += glowColor * horizonBand * 0.55;
                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
    const skyDomeMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDomeMesh);

    const starCount = 450;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 0.85 + 0.1);
        const r = 182;
        starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPos[i * 3 + 1] = r * Math.cos(phi);
        starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starFieldPoints = new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xe9d5ff, size: 0.9, transparent: true, opacity: 0.85, depthWrite: false })
    );
    scene.add(starFieldPoints);

    return { skyDomeMesh, starFieldPoints };
}

function buildStylizedEnvironmentProps(scene, pbrTex) {
    const treePos = [], pinePos = [], spirePos = [], rockPos = [];
    for (let gx = 0; gx < WORLD_TILES; gx++) {
        for (let gy = 0; gy < WORLD_TILES; gy++) {
            const tile = worldGrid[gx][gy];
            if (!tile.prop) continue;
            const wx = (gx - HALF_WORLD) * WORLD_SCALE_3D;
            const wz = (gy - HALF_WORLD) * WORLD_SCALE_3D;
            const item = { x: wx, y: tile.height3D, z: wz, scale: tile.prop.scale || 1, rot: tile.detail * Math.PI * 2 };
            if (tile.prop.type === 'twisted_tree') treePos.push(item);
            else if (tile.prop.type === 'dead_pine') pinePos.push(item);
            else if (tile.prop.type === 'gothic_spire') spirePos.push(item);
            else if (tile.prop.type === 'crag_rock') rockPos.push(item);
        }
    }

    const dummy = new THREE.Object3D();
    let treeTrunkInst = null;
    let treeCrownInst = null;

    if (treePos.length > 0) {
        const trunkGeo = new THREE.CylinderGeometry(0.28, 0.58, 3.4, 6);
        trunkGeo.translate(0, 1.7, 0);
        const tPos = trunkGeo.attributes.position;
        for (let i = 0; i < tPos.count; i++) {
            const py = tPos.getY(i);
            tPos.setX(i, tPos.getX(i) + Math.sin(py * 1.4) * 0.25);
        }
        trunkGeo.computeVertexNormals();

        const trunkMat = new THREE.MeshStandardMaterial({
            map: pbrTex.wood, bumpMap: pbrTex.wood, bumpScale: 0.16, roughness: 0.92, flatShading: true
        });
        treeTrunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treePos.length);
        treeTrunkInst.castShadow = true; treeTrunkInst.receiveShadow = true;

        const crownGeo = new THREE.DodecahedronGeometry(1.95, 1);
        crownGeo.scale(1.15, 0.85, 1.15);
        crownGeo.translate(0, 3.7, 0);
        const crownMat = new THREE.MeshStandardMaterial({ color: 0x1a3a2e, emissive: 0x071712, roughness: 0.85, flatShading: true });
        treeCrownInst = new THREE.InstancedMesh(crownGeo, crownMat, treePos.length);
        treeCrownInst.castShadow = true; treeCrownInst.receiveShadow = true;

        treePos.forEach((p, idx) => {
            dummy.position.set(p.x, p.y, p.z);
            dummy.rotation.set(0, p.rot, 0);
            dummy.scale.setScalar(p.scale);
            dummy.updateMatrix();
            treeTrunkInst.setMatrixAt(idx, dummy.matrix);
            treeCrownInst.setMatrixAt(idx, dummy.matrix);
        });
        scene.add(treeTrunkInst, treeCrownInst);
    }

    if (pinePos.length > 0) {
        const pineGeo = new THREE.ConeGeometry(1.5, 4.8, 6);
        pineGeo.translate(0, 2.4, 0);
        const pineMat = new THREE.MeshStandardMaterial({ color: 0x4b6584, roughness: 0.8, flatShading: true });
        const pineInst = new THREE.InstancedMesh(pineGeo, pineMat, pinePos.length);
        pineInst.castShadow = true;
        pinePos.forEach((p, idx) => {
            dummy.position.set(p.x, p.y, p.z);
            dummy.rotation.set(0, p.rot, 0);
            dummy.scale.setScalar(p.scale);
            dummy.updateMatrix();
            pineInst.setMatrixAt(idx, dummy.matrix);
        });
        scene.add(pineInst);
    }

    if (spirePos.length > 0) {
        const spireGeo = new THREE.CylinderGeometry(0.2, 0.85, 4.6, 5);
        spireGeo.translate(0, 2.3, 0);
        const spireMat = new THREE.MeshStandardMaterial({
            map: pbrTex.stone, bumpMap: pbrTex.stone, bumpScale: 0.15, roughness: 0.72, metalness: 0.22, flatShading: true
        });
        const spireInst = new THREE.InstancedMesh(spireGeo, spireMat, spirePos.length);
        spireInst.castShadow = true;
        spirePos.forEach((p, idx) => {
            dummy.position.set(p.x, p.y, p.z);
            dummy.rotation.set((p.rot - 3) * 0.08, p.rot, 0);
            dummy.scale.setScalar(p.scale);
            dummy.updateMatrix();
            spireInst.setMatrixAt(idx, dummy.matrix);
        });
        scene.add(spireInst);
    }

    if (rockPos.length > 0) {
        const rockGeo = new THREE.DodecahedronGeometry(1.0, 0);
        rockGeo.scale(1.2, 0.85, 1.1);
        rockGeo.translate(0, 0.5, 0);
        const rockMat = new THREE.MeshStandardMaterial({
            map: pbrTex.stone, bumpMap: pbrTex.stone, bumpScale: 0.14, roughness: 0.82, flatShading: true
        });
        const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockPos.length);
        rockInst.castShadow = true;
        rockPos.forEach((p, idx) => {
            dummy.position.set(p.x, p.y, p.z);
            dummy.rotation.set(0, p.rot, 0);
            dummy.scale.setScalar(p.scale);
            dummy.updateMatrix();
            rockInst.setMatrixAt(idx, dummy.matrix);
        });
        scene.add(rockInst);
    }

    return { treeTrunkInst, treeCrownInst };
}

function buildPOIMeshes3D(scene, pbrTex, sampleWorldHeight3D) {
    const poiMeshes3D = [];
    pointsOfInterest.forEach(poi => {
        const wx = poi.tx * WORLD_SCALE_3D;
        const wz = poi.ty * WORLD_SCALE_3D;
        const wy = sampleWorldHeight3D(wx, wz);
        const group = new THREE.Group();
        group.position.set(wx, wy, wz);

        if (poi.type === 'monolith') {
            const dais = new THREE.Mesh(
                new THREE.CylinderGeometry(1.9, 2.3, 0.45, 8),
                new THREE.MeshStandardMaterial({ map: pbrTex.stone, roughness: 0.85, flatShading: true })
            );
            dais.position.y = 0.22; group.add(dais);

            const cauldron = new THREE.Mesh(
                new THREE.SphereGeometry(1.05, 10, 8, 0, Math.PI * 2, 0.35, Math.PI * 0.72),
                new THREE.MeshStandardMaterial({ map: pbrTex.iron, bumpMap: pbrTex.iron, bumpScale: 0.1, roughness: 0.45, metalness: 0.78, side: THREE.DoubleSide })
            );
            cauldron.position.y = 1.15; cauldron.castShadow = true; group.add(cauldron);

            const rim = new THREE.Mesh(
                new THREE.TorusGeometry(0.92, 0.13, 6, 12),
                new THREE.MeshStandardMaterial({ map: pbrTex.iron, roughness: 0.4, metalness: 0.82 })
            );
            rim.rotation.x = Math.PI / 2; rim.position.y = 1.68; group.add(rim);

            const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.88, 10), new THREE.MeshBasicMaterial({ color: 0x39ff14 }));
            liquid.rotation.x = -Math.PI / 2; liquid.position.y = 1.62; group.add(liquid);

            const light = new THREE.PointLight(0x10b981, 3.0, 22);
            light.position.y = 2.4; group.add(light);
        } else if (poi.type === 'npc') {
            const robe = new THREE.Mesh(
                new THREE.ConeGeometry(0.65, 1.9, 7),
                new THREE.MeshStandardMaterial({ map: pbrTex.linen, color: 0x6d28d9, roughness: 0.75 })
            );
            robe.position.y = 0.95; robe.castShadow = true;
            const head = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.34, 1),
                new THREE.MeshPhysicalMaterial({ map: pbrTex.skin, color: 0xebb894, emissive: 0x5c1912, emissiveIntensity: 0.18, roughness: 0.6 })
            );
            head.position.y = 2.05;
            const hat = new THREE.Mesh(
                new THREE.ConeGeometry(0.55, 0.95, 6),
                new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.7 })
            );
            hat.position.y = 2.55;
            group.add(robe, head, hat);

            const fire = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 5), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
            fire.position.set(1.5, 0.45, 0.8);
            const fireLight = new THREE.PointLight(0xf59e0b, 2.0, 15);
            fireLight.position.set(1.5, 1.35, 0.8);
            group.add(fire, fireLight);
        } else {
            const chest = new THREE.Mesh(
                new THREE.BoxGeometry(1.3, 0.9, 0.95),
                new THREE.MeshStandardMaterial({ map: pbrTex.wood, bumpMap: pbrTex.wood, bumpScale: 0.12, roughness: 0.75 })
            );
            chest.position.y = 0.45; chest.castShadow = true;
            const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), new THREE.MeshBasicMaterial({ color: 0xa855f7 }));
            crystal.position.y = 1.65;
            const light = new THREE.PointLight(0xa855f7, 2.0, 14);
            light.position.y = 1.8;
            group.add(chest, crystal, light);
            poi.crystalMesh = crystal;
        }

        scene.add(group);
        poiMeshes3D.push({ poi, group });
    });
    return poiMeshes3D;
}

function buildDungeonPortals3D(scene, pbrTex, sampleWorldHeight3D) {
    const dungeonPortals3D = [];
    DUNGEONS_DEF.forEach(dng => {
        const wx = dng.tx * WORLD_SCALE_3D;
        const wz = dng.ty * WORLD_SCALE_3D;
        const wy = sampleWorldHeight3D(wx, wz);

        const group = new THREE.Group();
        group.position.set(wx, wy, wz);

        const archMat = new THREE.MeshStandardMaterial({ map: pbrTex.stone, roughness: 0.78, flatShading: true });
        const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.2, 0.9), archMat);
        leftPillar.position.set(-1.6, 2.1, 0); leftPillar.castShadow = true;
        const rightPillar = leftPillar.clone(); rightPillar.position.x = 1.6;
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.9, 1.1), archMat);
        lintel.position.set(0, 4.4, 0); lintel.castShadow = true;

        const vortex = new THREE.Mesh(
            new THREE.PlaneGeometry(2.5, 3.8),
            new THREE.MeshBasicMaterial({
                color: dng.accentColor, transparent: true, opacity: 0.55,
                side: THREE.DoubleSide, blending: THREE.AdditiveBlending
            })
        );
        vortex.position.set(0, 2.0, 0);

        const pLight = new THREE.PointLight(dng.accentColor, 2.8, 18);
        pLight.position.set(0, 2.5, 0.6);

        group.add(leftPillar, rightPillar, lintel, vortex, pLight);
        scene.add(group);
        dungeonPortals3D.push({ def: dng, group, vortex, wx, wz });
    });
    return dungeonPortals3D;
}

function buildVolumetricAtmosphere(scene) {
    const mistCount = 300;
    const mistGeo = new THREE.BufferGeometry();
    const mistPos = new Float32Array(mistCount * 3);
    const mistColors = new Float32Array(mistCount * 3);
    for (let i = 0; i < mistCount; i++) {
        mistPos[i * 3] = (Math.random() - 0.5) * 90;
        mistPos[i * 3 + 1] = 0.4 + Math.random() * 10;
        mistPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
        const isGreen = i % 2 === 0;
        mistColors[i * 3] = isGreen ? 0.06 : 0.58;
        mistColors[i * 3 + 1] = isGreen ? 0.95 : 0.2;
        mistColors[i * 3 + 2] = isGreen ? 0.45 : 0.92;
    }
    mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
    mistGeo.setAttribute('color', new THREE.BufferAttribute(mistColors, 3));
    const groundMistParticles = new THREE.Points(mistGeo, new THREE.PointsMaterial({
        size: 0.52, vertexColors: true, transparent: true, opacity: 0.76, blending: THREE.AdditiveBlending
    }));
    scene.add(groundMistParticles);
    return groundMistParticles;
}

function createDungeonInterior(scene, pbrTex, dngDef, spawnEnemyFn) {
    const dungeonWorldGroup = new THREE.Group();
    const floorMat = new THREE.MeshStandardMaterial({ map: pbrTex.stone, roughness: 0.88 });
    const wallMat = new THREE.MeshStandardMaterial({ map: pbrTex.stone, color: 0x262036, roughness: 0.85 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 54), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, DUNGEON_Y_OFFSET, 0);
    floor.receiveShadow = true;
    dungeonWorldGroup.add(floor);

    const wallGeoSide = new THREE.BoxGeometry(1.5, 10, 56);
    const leftWall = new THREE.Mesh(wallGeoSide, wallMat);
    leftWall.position.set(-14.5, DUNGEON_Y_OFFSET + 5, 0);
    const rightWall = leftWall.clone(); rightWall.position.x = 14.5;

    const wallGeoEnd = new THREE.BoxGeometry(30, 10, 1.5);
    const northWall = new THREE.Mesh(wallGeoEnd, wallMat);
    northWall.position.set(0, DUNGEON_Y_OFFSET + 5, -27.5);
    const southWall = northWall.clone(); southWall.position.z = 27.5;
    dungeonWorldGroup.add(leftWall, rightWall, northWall, southWall);

    const columns = [];
    for (let cz = -16; cz <= 16; cz += 8) {
        [-7.5, 7.5].forEach(cx => {
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 9.5, 7), wallMat);
            col.position.set(cx, DUNGEON_Y_OFFSET + 4.75, cz);
            dungeonWorldGroup.add(col);
            columns.push({ x: cx, z: cz, r: 1.25 });

            const brazier = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ color: dngDef.accentColor }));
            brazier.position.set(cx * 0.72, DUNGEON_Y_OFFSET + 2.4, cz);
            dungeonWorldGroup.add(brazier);
        });
    }

    const dngLight1 = new THREE.PointLight(dngDef.accentColor, 2.8, 38);
    dngLight1.position.set(0, DUNGEON_Y_OFFSET + 7, 12);
    const dngLight2 = new THREE.PointLight(0x9333ea, 2.6, 40);
    dngLight2.position.set(0, DUNGEON_Y_OFFSET + 7, -14);
    dungeonWorldGroup.add(dngLight1, dngLight2);

    const exitPortal = new THREE.Mesh(
        new THREE.TorusGeometry(1.7, 0.22, 8, 18),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    exitPortal.position.set(0, DUNGEON_Y_OFFSET + 2.1, 24.5);
    dungeonWorldGroup.add(exitPortal);

    const chestMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.1, 1.2),
        new THREE.MeshStandardMaterial({ map: pbrTex.wood, emissive: dngDef.accentColor, emissiveIntensity: 0.35 })
    );
    chestMesh.position.set(0, DUNGEON_Y_OFFSET + 0.55, -23);
    dungeonWorldGroup.add(chestMesh);

    scene.add(dungeonWorldGroup);

    const dngEnemies = [];
    if (!dngDef.cleared && typeof spawnEnemyFn === 'function') {
        dngEnemies.push(spawnEnemyFn('skeleton', -4.5, 4, DUNGEON_Y_OFFSET, 95 + dngDef.levelReq * 25, 13 + dngDef.levelReq * 2, 55, 35, false, true));
        dngEnemies.push(spawnEnemyFn('skeleton', 4.5, -4, DUNGEON_Y_OFFSET, 95 + dngDef.levelReq * 25, 13 + dngDef.levelReq * 2, 55, 35, false, true));
        dngEnemies.push(spawnEnemyFn('skeleton', 0, -16, DUNGEON_Y_OFFSET, dngDef.bossHp, 18 + dngDef.levelReq * 4, dngDef.rewardXp, dngDef.rewardGold, true, true, dngDef.bossName));
    }

    return { dungeonWorldGroup, columns, chestMesh, dngEnemies };
}