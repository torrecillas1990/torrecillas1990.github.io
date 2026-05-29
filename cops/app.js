const AIRCRAFT_SVGS = {
    plane: '<path d="M21,16v-2l-8-5V3.5c0-0.83-0.67-1.5-1.5-1.5S10,2.67,10,3.5V9l-8,5v2l8-2.5V19l-2,1.5V22l3.5-1l3.5,1v-1.5L13,19v-5.5L21,16z"/>',
    heli: '<path d="M20.2,12.1L18,11.2V10h-2.2l-1.8,1.8h-4L8.2,10H6v1.2L3.8,12.1c-0.5,0.2-0.8,0.7-0.8,1.2v0.3c0,0.8,0.7,1.4,1.5,1.4h15c0.8,0,1.5-0.6,1.5-1.4v-0.3C21,12.8,20.7,12.3,20.2,12.1z M12,2v2H2v2h20V4h-10V2H12z"/>',
    fighter: '<path d="M12,2L8,10h8L12,2z M10,12l-6,6v2l6-2v4l-2,2v2l4-1l4,1v-2l-2-2v-4l6,2v-2l-6-6H10z"/>',
    drone: '<path d="M22,10v-2h-3v2h-2.1c-0.4-1.7-1.9-3-3.7-3h-2.4c-1.8,0-3.3,1.3-3.7,3H5V8H2v2c0,1.1,0.9,2,2,2h1.2c0.5,1.8,2.2,3.1,4.1,3.1h5.4c1.9,0,3.6-1.3,4.1-3.1H20C21.1,12,22,11.1,22,10z"/>'
};
const GROUND_SVGS = {
    radar_fijo: '<path d="M4,4h16v2H4V4z M4,8h16v12H4V8z M12,10c-2.2,0-4,1.8-4,4s1.8,4,4,4s4-1.8,4-4S14.2,10,12,10z M12,16c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2S13.1,16,12,16z"/>',
    radar_movil: '<path d="M18.92,6.01C18.72,5.42,18.16,5,17.5,5h-11C5.84,5,5.28,5.42,5.08,6.01L3,12v8c0,0.55,0.45,1,1,1h1c0.55,0,1-0.45,1-1v-1h12v1c0,0.55,0.45,1,1,1h1c0.55,0,1-0.45,1-1v-8L18.92,6.01z M6.85,7h10.29l1.04,3H5.81L6.85,7z M7.5,16C6.67,16,6,15.33,6,14.5S6.67,13,7.5,13S9,13.67,9,14.5S8.33,16,7.5,16z M16.5,16c-0.83,0-1.5-0.67-1.5-1.5s0.67-1.5,1.5-1.5s1.5,0.67,1.5,1.5S17.33,16,16.5,16z M12,2L12,5 M9,3L15,3" stroke="currentColor" stroke-width="1" fill="currentColor"/>',
    police: '<path d="M12,12.5a3,3 0 1,1 3,-3a3,3 0 0,1 -3,3m0,-9a6,6 0 1,0 6,6a6,6 0 0,0 -6,-6m-9,13.5h18v3h-18z M12,1c-5,0 -9,4 -9,9c0,5 9,13 9,13s9,-8 9,-9c0,-5 -4,-9 -9,-9"/>'
};

// 1. CONFIGURACIÓN ESTRATÉGICA (Firebase REST)
// ¡ATENCIÓN: Cambia TU-PROYECTO-AQUI por tu ID real de Firebase!
const FIREBASE_PLANES_URL = "https://radar-tactico-default-rtdb.europe-west1.firebasedatabase.app/aviones.json";
const FIREBASE_TERRAIN_URL = "https://radar-tactico-default-rtdb.europe-west1.firebasedatabase.app/reportes_terrestres.json";

// 2. INICIALIZACIÓN BÁSICA DEL MAPA (View centrada en la Península)
const map = L.map('map', { zoomControl: false }).setView([40.0, -3.0], 6);
L.control.zoom({ position: 'topleft' }).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OSM'
}).addTo(map);

// Capas separadas para una gestión eficiente del renderizado
const planesLayer = L.layerGroup().addTo(map);
const groundFixedLayer = L.layerGroup().addTo(map);
const groundMobileLayer = L.layerGroup().addTo(map);

// Variables de Estado
let planesData = []; 
let fixedRadarsOSM = []; // Aquí se guardarán los datos estáticos de OpenStreetMap
let mobileReportsFB = {};  // Aquí se guardarán los datos dinámicos de Firebase
let watchlistActive = false;
let targetWatchlist = [];
let currentFilter = '';
let mapMoveTimer = null;

// Variables de Estado (Alerta y GPS)
let userMarker = null;
let userPos = null; 
let alertsEnabled = false;
let alertRadiusKm = 30;
let alertCircle = null; 
const alertedAircraft = new Set(); 
const alertedFixedRadars = new Set(); 
const alertedMobileRadars = new Set();
let contextMenuCoords = null; // Guardar coordenadas donde se hizo clic derecho
const alertedAircraft = new Set(); 

// FIX: Blindaje contra "Click Propagation" y Scroll
const tacticalPanel = document.getElementById('tactical-panel');
const hamburgerBtn = document.getElementById('hamburger-btn');
const contextMenu = document.getElementById('context-menu');
[tacticalPanel, hamburgerBtn, contextMenu].forEach(el => {
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
});

// 3. EVENTOS DE INTERFAZ Y PANEL
hamburgerBtn.addEventListener('click', () => { tacticalPanel.style.right = '0'; });
document.getElementById('close-panel-btn').addEventListener('click', () => { tacticalPanel.style.right = '-320px'; });

// Eventos de Checkboxes (Renderizado Reactivo)
document.getElementById('show-fixed-radars').addEventListener('change', renderFixedGroundUnits);
document.getElementById('show-mobile-radars').addEventListener('change', renderMobileGroundUnits);
document.querySelectorAll('#type-filters input[type="checkbox"]').forEach(checkbox => {
    // Si no son los dos nuevos, son los antiguos de aviones
    if(checkbox.id !== 'show-fixed-radars' && checkbox.id !== 'show-mobile-radars') {
        checkbox.addEventListener('change', renderPlanes);
    }
});

// Alerta Táctica
document.getElementById('toggle-alerts').addEventListener('change', async (e) => {
    alertsEnabled = e.target.checked;
    if (alertsEnabled && !userPos) {
        alert("⚠️ No tienes una posición establecida. Clica en el mapa.");
        alertsEnabled = false; e.target.checked = false; return;
    }
    if (alertsEnabled && Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            alert("⚠️ Activa notificaciones."); alertsEnabled = false; e.target.checked = false;
            updateAlertCircle(); return;
        }
    }
    updateAlertCircle();
});

['input', 'change'].forEach(evt => {
    document.getElementById('alert-radius').addEventListener(evt, (e) => {
        alertRadiusKm = parseInt(e.target.value) || 30;
        updateAlertCircle();
    });
});

// Eventos de la Lista de Vigilancia
function parseWatchlist() {
    const raw = document.getElementById('watchlist-input').value;
    // Divide por comas o saltos de línea, limpia espacios, pasa a mayúsculas y quita vacíos
    targetWatchlist = raw.split(/[\n,]+/).map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
}

document.getElementById('toggle-watchlist').addEventListener('change', (e) => {
    watchlistActive = e.target.checked;
    parseWatchlist();
    renderPlanes();
});

document.getElementById('update-watchlist-btn').addEventListener('click', () => {
    parseWatchlist();
    // Si la lista tiene contenido, forzamos la activación del checkbox
    if (targetWatchlist.length > 0 && !watchlistActive) {
        watchlistActive = true;
        document.getElementById('toggle-watchlist').checked = true;
    }
    renderPlanes();
});

// 4. LÓGICA DE GEOLOCALIZACIÓN Y CLIC DERECHO
function updateAlertCircle() {
    if (alertsEnabled && userPos) {
        const radiusMeters = alertRadiusKm * 1000;
        if (alertCircle) { alertCircle.setLatLng(userPos).setRadius(radiusMeters);
        } else {
            alertCircle = L.circle(userPos, {
                color: '#eab308', fillColor: '#eab308', fillOpacity: 0.25, weight: 3, dashArray: '5, 10', interactive: false 
            }).addTo(map);
			alertCircle.setLatLng(userPos).setRadius(radiusMeters);
        }
    } else if (alertCircle) { map.removeLayer(alertCircle); alertCircle = null; }
}

function setUserPosition(lat, lon, isManual = false) {
    userPos = L.latLng(lat, lon); 
    const userIcon = L.divIcon({
        html: `<div style="background-color: #3b82f6; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px #3b82f6;"></div>`,
        className: 'user-marker', iconSize: [14, 14], iconAnchor: [7, 7]
    });
    const popupText = isManual ? "<b>📍 Base (Manual)</b>" : "<b>📍 Tu ubicación GPS</b>";
    if (userMarker) { userMarker.setLatLng(userPos).getPopup().setContent(popupText);
    } else { userMarker = L.marker(userPos, { icon: userIcon }).addTo(map).bindPopup(popupText); }
    updateAlertCircle();
}

function locateUser() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(position => {
            setUserPosition(position.coords.latitude, position.coords.longitude, false);
            map.setView(userPos, 8);
        }, error => { alert("📡 GPS no detectado. Clica en el mapa para establecer base manual."); }, { enableHighAccuracy: true });
    }
}

// GESTIÓN DE CLICS EN MAPA
map.on('click', function(e) {
    // Un clic normal cierra el menú contextual y establece la base
    contextMenu.style.display = 'none';
    setUserPosition(e.latlng.lat, e.latlng.lng, true);
});

map.on('contextmenu', function(e) {
    // Clic derecho abre el menú contextual
    contextMenuCoords = e.latlng;
    contextMenu.style.display = 'block';
    contextMenu.style.left = e.containerPoint.x + 'px';
    contextMenu.style.top = e.containerPoint.y + 'px';
});


// 5. MOTOR DE REPORTE MANUAL (Firebase POST)
async function sendReportToFirebase(type, desc) {
    if (!contextMenuCoords) return;

    const reporteData = {
        type: type,
        lat: contextMenuCoords.lat,
        lon: contextMenuCoords.lng,
        desc: desc,
        timestamp: Date.now() // Importante para caducar reportes viejos
    };

    try {
        const response = await fetch(FIREBASE_TERRAIN_URL, {
            method: 'POST', // POST crea un nuevo nodo con ID única automáticamente
            body: JSON.stringify(reporteData),
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            contextMenu.style.display = 'none';
            console.log(`✅ Reporte de ${desc} enviado a Firebase.`);
            // Forzamos una recarga rápida de la capa terrestre
            fetchTerrainReports();
        } else { alert("❌ Error al conectar con Firebase."); }
    } catch (error) { console.error("Fallo crítico al reportar:", error); }
}

// Conectar botones del menú contextual
document.getElementById('btn-report-radar').addEventListener('click', () => sendReportToFirebase('movil', 'Radar Móvil / Camuflado'));
document.getElementById('btn-report-police').addEventListener('click', () => sendReportToFirebase('policial', 'Control de Seguridad / Alcohol'));


// 6. ADQUISICIÓN DE DATOS (Aire y Tierra Híbrida)

// A. AVIONES (Firebase - REST Polling 10s)
async function fetchPlanes() {
    try {
        const response = await fetch(FIREBASE_PLANES_URL);
        const data = await response.json();
        if (data && data.ac) { planesData = data.ac; renderPlanes(); }
    } catch (error) { console.error("Error extraiendo aviones:", error.message); }
}

// B. RADARES FIJOS (Por Sector Geográfico - Bounding Box)
async function fetchRealFixedRadarsBBOX() {
    // 1. Extraemos las coordenadas exactas
    const bounds = map.getBounds();
    const s = bounds.getSouth().toFixed(4);
    const w = bounds.getWest().toFixed(4);
    const n = bounds.getNorth().toFixed(4);
    const e = bounds.getEast().toFixed(4);

    console.log(`📸 Escaneando sector terrestre: [Sur:${s}, Oeste:${w}, Norte:${n}, Este:${e}]`);
    
    // Encendemos el indicador visual en la interfaz
    const loadingBadge = document.getElementById('loading-indicator');
    if (loadingBadge) loadingBadge.style.display = 'block';

    const overpassQuery = `
        [out:json][timeout:15][bbox:${s},${w},${n},${e}];
        (
            node["highway"="speed_camera"];
            way["highway"="speed_camera"];
            relation["highway"="speed_camera"];
        );
        out center;
    `;
    
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery.trim())}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const data = await response.json();
        
        fixedRadarsOSM = data.elements.map(el => {
            const lat = el.lat || (el.center && el.center.lat);
            const lon = el.lon || (el.center && el.center.lon);
            const limit = (el.tags && el.tags['maxspeed']) ? el.tags['maxspeed'] : 'N/A';
            
            if (lat && lon) return { lat, lon, limit };
            return null;
        }).filter(r => r !== null);

        console.log(`✅ ${fixedRadarsOSM.length} radares fijos localizados en el sector visual.`);
        renderFixedGroundUnits();
        
    } catch (error) { 
        console.error("❌ Fallo de escaneo en sector:", error.message); 
    } finally {
        // Apagamos el indicador visual, sin importar si hubo éxito o error
        if (loadingBadge) loadingBadge.style.display = 'none';
    }
}

// C. REPORTES MANUALES (Firebase - REST Polling 20s)
async function fetchTerrainReports() {
    try {
        const response = await fetch(FIREBASE_TERRAIN_URL);
        const data = await response.json();
        
        // Firebase POST devuelve un objeto { "ID_UNICA": {datos}, ... } o null
        mobileReportsFB = data || {};
        renderMobileGroundUnits();
        
    } catch (error) { console.error("Error cargando reportes manuales:", error); }
}


// 7. MOTOR DE RENDERIZADO POLIMÓRFICO

// A. RENDER AVIONES
function checkIsStateForce(flight) {
    if (!flight) return false;
    const s = flight.trim().toLowerCase();
    return s.startsWith('dgt') || s.startsWith('ame') || s.startsWith('famet') || s.startsWith('cuco') || s.startsWith('pol') || s.startsWith('cme');
}

function getAircraftIcon(cat, track, flight) {
    let path = AIRCRAFT_SVGS.plane; let color = '#aaaaaa'; let size = 24; let isState = checkIsStateForce(flight);
    if (cat === 'A3' || cat === 'A4' || cat === 'A5') { color = '#3b82f6'; size = 28; }
    else if (cat === 'A1' || cat === 'A2' || cat === 'B1') { color = '#22c55e'; size = 20; }
    else if (cat === 'A7') { path = AIRCRAFT_SVGS.heli; color = '#f97316'; size = 26; }
    else if (cat === 'A6') { path = AIRCRAFT_SVGS.fighter; color = '#ef4444'; size = 28; }
    if (isState) { color = '#eab308'; size = 30; if (flight && (flight.toLowerCase().includes('dgt') || flight.toLowerCase().includes('cuco'))) path = AIRCRAFT_SVGS.heli; }

    const html = `<div style="transform: rotate(${track||0}deg); color: ${color}; width: ${size}px; height: ${size}px; display: flex; justify-content: center; align-items: center; ${isState ? 'filter: drop-shadow(0 0 5px #eab308);' : ''}"><svg viewBox="0 0 24 24" fill="currentColor">${path}</svg></div>`;
    return L.divIcon({ html: html, className: 'ac-icon', iconSize: [size, size], iconAnchor: [size/2, size/2] });
}

function renderPlanes() {
    planesLayer.clearLayers();

    // Lectura de filtros visuales del nuevo menú lateral
    const showState = document.querySelector('#type-filters input[value="state"]').checked;
    const showCommercial = document.querySelector('#type-filters input[value="commercial"]').checked;
    const showLight = document.querySelector('#type-filters input[value="light"]').checked;
    const showHeli = document.querySelector('#type-filters input[value="heli"]').checked;
    const showOther = document.querySelector('#type-filters input[value="other"]').checked;
    const showUnknown = document.querySelector('#type-filters input[value="unknown"]').checked;

    planesData.forEach(p => {
        const lat = p.lat;
        const lon = p.lon;
        const callsign = p.flight ? p.flight.trim() : 'Desconocido';
        const callsignUpper = callsign.toUpperCase();
        const hexUpper = p.hex ? p.hex.trim().toUpperCase() : '';
        const category = p.category;
        const true_track = p.track;
        const typeDesc = p.t || 'No Especificado';
        
        const alt_meters = p.alt_baro !== undefined && p.alt_baro !== 'ground' ? Math.round(p.alt_baro * 0.3048) : 0;
        const speed_kmh = p.gs !== undefined ? Math.round(p.gs * 1.852) : 0;

        if (lat && lon) {
            const isStateForce = checkIsStateForce(callsign);
            
            // --- 1. LÓGICA VISUAL MAPA ---
            let categoryMatch = false;

            // MODO TÁCTICO: ¿Está activa la lista de vigilancia?
            if (watchlistActive && targetWatchlist.length > 0) {
                // Comprobamos si el avión coincide con algún objetivo de nuestra lista
                for (let target of targetWatchlist) {
                    if (callsignUpper.includes(target) || hexUpper.includes(target)) {
                        categoryMatch = true;
                        break;
                    }
                }
            } else {
                // MODO NORMAL: Filtros estándar por tipo
                if (isStateForce && showState) categoryMatch = true;
                else if (!isStateForce) {
                    if ((category === 'A3' || category === 'A4' || category === 'A5') && showCommercial) categoryMatch = true;
                    else if ((category === 'A1' || category === 'A2' || category === 'B1') && showLight) categoryMatch = true;
                    else if (category === 'A7' && showHeli) categoryMatch = true;
                    else if (category === 'A6' && showOther) categoryMatch = true;
                    else if (!category && showUnknown) categoryMatch = true;
                }

                // Aplicar el buscador de texto rápido si hay algo escrito
                if (currentFilter !== '') {
                    const typeStr = typeDesc.toLowerCase();
                    if (!callsign.toLowerCase().includes(currentFilter) && !typeStr.includes(currentFilter)) {
                        categoryMatch = false;
                    }
                }
            }

            if (!categoryMatch) return; // Abortamos el dibujado si no pasa el filtro

            let catText = "Desconocida";
            if (isStateForce) catText = "🚨 Estado / Militar / DGT";
            else if (category === 'A3' || category === 'A4' || category === 'A5') catText = "Comercial / Pesado";
            else if (category === 'A1' || category === 'A2' || category === 'B1') catText = "Avioneta / Ligero";
            else if (category === 'A7') catText = "Helicóptero";
            else if (category === 'A6') catText = "Militar / Caza";

            // --- 2. LÓGICA DE ALARMA Y NOTIFICACIONES ---
            if (alertsEnabled && userPos) {
                const alertState = document.querySelector('#alert-filters input[value="state"]').checked;
                const alertCommercial = document.querySelector('#alert-filters input[value="commercial"]').checked;
                const alertLight = document.querySelector('#alert-filters input[value="light"]').checked;
                const alertHeli = document.querySelector('#alert-filters input[value="heli"]').checked;
                const alertOther = document.querySelector('#alert-filters input[value="other"]').checked;
                const alertUnknown = document.querySelector('#alert-filters input[value="unknown"]').checked;
                const alertWatchlist = document.getElementById('alert-watchlist').checked;

                let triggersAlert = false;

                // 1º Prioridad Táctica: Si la alerta por Watchlist está activa, ¿coincide con nuestro objetivo?
                if (alertWatchlist && targetWatchlist.length > 0) {
                    for (let target of targetWatchlist) {
                        if (callsignUpper.includes(target) || hexUpper.includes(target)) {
                            triggersAlert = true;
                            catText = "🎯 OBJETIVO FIJADO";
                            break;
                        }
                    }
                }

                // 2º Prioridad: Si no ha saltado por Watchlist, comprobamos los filtros estándar
                if (!triggersAlert) {
                    if (isStateForce && alertState) triggersAlert = true;
                    else if (!isStateForce) {
                        if ((category === 'A3' || category === 'A4' || category === 'A5') && alertCommercial) triggersAlert = true;
                        else if ((category === 'A1' || category === 'A2' || category === 'B1') && alertLight) triggersAlert = true;
                        else if (category === 'A7' && alertHeli) triggersAlert = true;
                        else if (category === 'A6' && alertOther) triggersAlert = true;
                        else if (!category && alertUnknown) triggersAlert = true;
                    }
                }

                if (triggersAlert) {
                    const planePos = L.latLng(lat, lon);
                    const distanceMeters = userPos.distanceTo(planePos); 
                    const distanceKm = (distanceMeters / 1000).toFixed(1);
                    const planeId = callsign !== 'Desconocido' ? callsign : `${lat}-${lon}`;

                    if (distanceMeters <= (alertRadiusKm * 1000)) {
                        if (!alertedAircraft.has(planeId)) {
                            triggerDesktopNotification(callsign, typeDesc, catText, distanceKm);
                            alertedAircraft.add(planeId); 
                        }
                    } else {
                        alertedAircraft.delete(planeId);
                    }
                }
            }

            // --- 3. DIBUJADO DEL MARCADOR EN EL MAPA ---
            const customMarker = L.marker([lat, lon], {
                icon: getAircraftIcon(category, true_track, callsign)
            });

            customMarker.bindPopup(`
                <b>Vuelo:</b> ${callsign}<br>
                <b>Modelo:</b> ${typeDesc}<br>
                <b>Tipo:</b> ${catText}<br>
                <b>Altitud:</b> ${alt_meters > 0 ? alt_meters + ' m' : 'En tierra'}<br>
                <b>Velocidad:</b> ${speed_kmh} km/h
            `);
            
            // Asegúrate de usar la capa correcta donde guardas los aviones
            // En tu código inicial era markersLayer, en el último planesLayer. 
            // Usa planesLayer si la cambiaste al crear el soporte para terrestres.
            planesLayer.addLayer(customMarker);
        }
    });
}

// B. RADARES FIJOS (Por Sector Geográfico - Bounding Box)
function renderFixedGroundUnits() {
    groundFixedLayer.clearLayers();
    if (!document.getElementById('show-fixed-radars').checked) return;

    // Comprobamos si la alerta terrestre está encendida
    const isAlertEnabled = alertsEnabled && userPos && document.getElementById('alert-fixed-radars').checked;

    fixedRadarsOSM.forEach(r => {
        const color = '#10b981'; // Verde DGT
        const html = `<div style="color: ${color}; width: 22px; height: 22px; display: flex; justify-content: center; align-items: center; filter: drop-shadow(0 0 3px ${color}); background: rgba(0,0,0,0.7); border-radius: 4px; border: 1px solid ${color};"><svg viewBox="0 0 24 24" fill="currentColor">${GROUND_SVGS.radar_fijo}</svg></div>`;
        const icon = L.divIcon({ html: html, className: 'gr-icon', iconSize: [22, 22], iconAnchor: [11, 11] });
        
        L.marker([r.lat, r.lon], { icon: icon }).addTo(groundFixedLayer).bindPopup(`<b>📸 Radar Fijo</b><br>Límite: ${r.limit} km/h`);

        // --- MOTOR DE ALERTA TERRESTRE ---
        if (isAlertEnabled) {
            const rPos = L.latLng(r.lat, r.lon);
            const distanceMeters = userPos.distanceTo(rPos); 
            const distanceKm = (distanceMeters / 1000).toFixed(1);
            const radarId = `fijo-${r.lat}-${r.lon}`;

            if (distanceMeters <= (alertRadiusKm * 1000)) {
                if (!alertedFixedRadars.has(radarId)) {
                    triggerDesktopNotification("📸 RADAR FIJO", `Límite de velocidad: ${r.limit} km/h`, "Alerta Terrestre", distanceKm);
                    alertedFixedRadars.add(radarId); 
                }
            } else {
                alertedFixedRadars.delete(radarId);
            }
        }
    });
}

// C. RENDER TERRESTRE MÓVIL (Firebase)
function renderMobileGroundUnits() {
    groundMobileLayer.clearLayers();
    if (!document.getElementById('show-mobile-radars').checked) return;

    const ahora = Date.now();
    const caducidadMs = 2 * 60 * 60 * 1000; // 2 horas de vida para un reporte móvil
    const isAlertEnabled = alertsEnabled && userPos && document.getElementById('alert-mobile-radars').checked;

    Object.keys(mobileReportsFB).forEach(id => {
        const unit = mobileReportsFB[id];
        if (ahora - unit.timestamp > caducidadMs) return;

        let path = unit.type === 'movil' ? GROUND_SVGS.radar_movil : GROUND_SVGS.police;
        let color = unit.type === 'movil' ? '#ef4444' : '#3b82f6';
        let size = 28;

        const html = `<div style="color: ${color}; width: ${size}px; height: ${size}px; display: flex; justify-content: center; align-items: center; filter: drop-shadow(0 0 4px ${color}); background: rgba(0,0,0,0.7); border-radius: 50%; border: 2px solid ${color};"><svg viewBox="0 0 24 24" fill="currentColor">${path}</svg></div>`;
        const icon = L.divIcon({ html: html, className: 'gr-icon', iconSize: [size, size], iconAnchor: [size/2, size/2] });
        const tiempoPasado = Math.round((ahora - unit.timestamp) / 60000);

        L.marker([unit.lat, unit.lon], { icon: icon }).addTo(groundMobileLayer)
         .bindPopup(`<b>${color==='#ef4444'?'🚓 Radar Móvil':'🛂 Control'}</b><br>${unit.desc}<br><span style="color: #aaa; font-size: 11px;">Reportado hace ${tiempoPasado} min</span>`);

        // --- MOTOR DE ALERTA TERRESTRE ---
        if (isAlertEnabled) {
            const rPos = L.latLng(unit.lat, unit.lon);
            const distanceMeters = userPos.distanceTo(rPos); 
            const distanceKm = (distanceMeters / 1000).toFixed(1);

            if (distanceMeters <= (alertRadiusKm * 1000)) {
                if (!alertedMobileRadars.has(id)) {
                    const title = color === '#ef4444' ? '🚓 RADAR MÓVIL' : '🛂 CONTROL POLICIAL';
                    triggerDesktopNotification(title, unit.desc, "Alerta Táctica Terrestre", distanceKm);
                    alertedMobileRadars.add(id); 
                }
            } else {
                alertedMobileRadars.delete(id);
            }
        }
    });
}

// 8. BUCLÉ INICIAL Y TEMPORIZADORES
locateUser();
fetchPlanes();
fetchTerrainReports();

// EVENTO TÁCTICO: Rastrear radares fijos al mover el mapa (con seguro anti-baneo)
map.on('moveend', () => {
    // Si el usuario tiene apagada la capa de radares, no gastamos peticiones
    if (!document.getElementById('show-fixed-radars').checked) return;

    // Si el mapa se sigue moviendo, cancelamos el disparo anterior
    clearTimeout(mapMoveTimer);
    
    // Armamos el temporizador: dispara 1.5 segundos después de detener el movimiento
    mapMoveTimer = setTimeout(() => {
        fetchRealFixedRadarsBBOX();
    }, 1500); 
});

// Forzamos un disparo inicial al cargar la web por primera vez
if (document.getElementById('show-fixed-radars').checked) {
    fetchRealFixedRadarsBBOX();
}

// Intervalos de refresco asíncronos
setInterval(fetchPlanes, 10000); // Aviones cada 10s
setInterval(fetchTerrainReports, 20000); // Reportes manuales cada 20s