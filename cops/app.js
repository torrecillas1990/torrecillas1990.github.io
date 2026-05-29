const AIRCRAFT_SVGS = {
    plane: '<path d="M21,16v-2l-8-5V3.5c0-0.83-0.67-1.5-1.5-1.5S10,2.67,10,3.5V9l-8,5v2l8-2.5V19l-2,1.5V22l3.5-1l3.5,1v-1.5L13,19v-5.5L21,16z"/>',
    heli: '<path d="M20.2,12.1L18,11.2V10h-2.2l-1.8,1.8h-4L8.2,10H6v1.2L3.8,12.1c-0.5,0.2-0.8,0.7-0.8,1.2v0.3c0,0.8,0.7,1.4,1.5,1.4h15c0.8,0,1.5-0.6,1.5-1.4v-0.3C21,12.8,20.7,12.3,20.2,12.1z M12,2v2H2v2h20V4h-10V2H12z"/>',
    fighter: '<path d="M12,2L8,10h8L12,2z M10,12l-6,6v2l6-2v4l-2,2v2l4-1l4,1v-2l-2-2v-4l6,2v-2l-6-6H10z"/>',
    drone: '<path d="M22,10v-2h-3v2h-2.1c-0.4-1.7-1.9-3-3.7-3h-2.4c-1.8,0-3.3,1.3-3.7,3H5V8H2v2c0,1.1,0.9,2,2,2h1.2c0.5,1.8,2.2,3.1,4.1,3.1h5.4c1.9,0,3.6-1.3,4.1-3.1H20C21.1,12,22,11.1,22,10z"/>'
};

const map = L.map('map').setView([38.0, -1.0], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
let currentFilter = '';
let planesData = []; 

document.getElementById('filter-btn').addEventListener('click', () => {
    currentFilter = document.getElementById('filter-input').value.trim().toLowerCase();
    renderPlanes(); 
});
document.getElementById('filter-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') document.getElementById('filter-btn').click();
});
document.querySelectorAll('#type-filters input').forEach(checkbox => {
    checkbox.addEventListener('change', renderPlanes);
});

// NUEVA ARQUITECTURA: Conexión directa al nodo centralizado de Firebase
async function fetchAircraft() {
    try {
        // Añade la URL de tu Firebase y asegúrate de que termina en /aviones.json
        const firebaseDataUrl = 'https://TU-PROYECTO-AQUI.firebasedatabase.app/aviones.json';
        
        const response = await fetch(firebaseDataUrl);
        if (!response.ok) throw new Error("Fallo al contactar con el nodo central.");

        const data = await response.json();

        if (data && data.ac) {
            planesData = data.ac;
            renderPlanes();
            console.log(`📡 Telemetría recibida: ${data.ac.length} aeronaves.`);
        }
    } catch (error) {
        console.error("Error estructural:", error.message);
    }
}

function checkIsStateForce(callsign) {
    if (!callsign) return false;
    const str = callsign.trim().toLowerCase();
    return str.startsWith('dgt') || str.startsWith('ame') || str.startsWith('famet') || 
           str.startsWith('floan') || str.startsWith('cuco') || str.startsWith('pol') || str.startsWith('cme');
}

function getCustomIcon(category, true_track, callsign) {
    let svgPath = AIRCRAFT_SVGS.plane;
    let color = '#aaaaaa'; 
    let size = 24;
    let isStateForce = checkIsStateForce(callsign);

    if (category === 'A3' || category === 'A4' || category === 'A5') { color = '#3b82f6'; size = 28; }
    else if (category === 'A1' || category === 'A2' || category === 'B1') { color = '#22c55e'; size = 20; }
    else if (category === 'A7') { svgPath = AIRCRAFT_SVGS.heli; color = '#f97316'; size = 26; }
    else if (category === 'A6') { svgPath = AIRCRAFT_SVGS.fighter; color = '#ef4444'; size = 28; }

    if (isStateForce) {
        color = '#eab308';
        if (callsign && (callsign.toLowerCase().includes('dgt') || callsign.toLowerCase().includes('cuco'))) {
            svgPath = AIRCRAFT_SVGS.heli;
        }
        size = 30; 
    }

    const rotation = true_track || 0;
    const html = `
        <div style="transform: rotate(${rotation}deg); color: ${color}; width: ${size}px; height: ${size}px; display: flex; justify-content: center; align-items: center; ${isStateForce ? 'filter: drop-shadow(0 0 5px #eab308);' : ''}">
            <svg viewBox="0 0 24 24" fill="currentColor">${svgPath}</svg>
        </div>
    `;

    return L.divIcon({ html: html, className: 'aircraft-icon', iconSize: [size, size], iconAnchor: [size/2, size/2] });
}

function renderPlanes() {
    markersLayer.clearLayers();

    const showState = document.querySelector('input[value="state"]').checked;
    const showCommercial = document.querySelector('input[value="commercial"]').checked;
    const showLight = document.querySelector('input[value="light"]').checked;
    const showHeli = document.querySelector('input[value="heli"]').checked;
    const showOther = document.querySelector('input[value="other"]').checked;
    const showUnknown = document.querySelector('input[value="unknown"]').checked;

    planesData.forEach(plane => {
        const lat = plane.lat;
        const lon = plane.lon;
        const callsign = plane.flight;
        const category = plane.category;
        const true_track = plane.track;
        const typeDesc = plane.t || 'Desconocido';
        
        const alt_meters = plane.alt_baro !== undefined && plane.alt_baro !== 'ground' ? Math.round(plane.alt_baro * 0.3048) : 0;
        const speed_kmh = plane.gs !== undefined ? Math.round(plane.gs * 1.852) : 0;

        if (lat && lon) {
            const isStateForce = checkIsStateForce(callsign);
            let categoryMatch = false;

            if (isStateForce && showState) categoryMatch = true;
            else if (!isStateForce) {
                if ((category === 'A3' || category === 'A4' || category === 'A5') && showCommercial) categoryMatch = true;
                else if ((category === 'A1' || category === 'A2' || category === 'B1') && showLight) categoryMatch = true;
                else if (category === 'A7' && showHeli) categoryMatch = true;
                else if (category === 'A6' && showOther) categoryMatch = true;
                else if (!category && showUnknown) categoryMatch = true;
            }

            if (!categoryMatch) return; 

            if (currentFilter !== '') {
                const callsignStr = callsign ? callsign.trim().toLowerCase() : '';
                const typeStr = typeDesc.toLowerCase();
                if (!callsignStr.includes(currentFilter) && !typeStr.includes(currentFilter)) return; 
            }
            
            let catText = "Desconocida";
            if (isStateForce) catText = "🚨 Estado / Militar / DGT";
            else if (category === 'A3' || category === 'A4' || category === 'A5') catText = "Comercial / Pesado";
            else if (category === 'A1' || category === 'A2' || category === 'B1') catText = "Avioneta / Ligero";
            else if (category === 'A7') catText = "Helicóptero";
            else if (category === 'A6') catText = "Militar / Caza";

            const customMarker = L.marker([lat, lon], {
                icon: getCustomIcon(category, true_track, callsign)
            });

            customMarker.bindPopup(`
                <b>Vuelo:</b> ${callsign ? callsign.trim() : 'Sin indicativo'}<br>
                <b>Modelo:</b> ${typeDesc}<br>
                <b>Tipo:</b> ${catText}<br>
                <b>Altitud:</b> ${alt_meters > 0 ? alt_meters + ' m' : 'En tierra'}<br>
                <b>Velocidad:</b> ${speed_kmh} km/h
            `);

            markersLayer.addLayer(customMarker);
        }
    });
}

// Refresco frontend cada 10 segundos para alinear con la cadencia del bot Python
fetchAircraft();
setInterval(fetchAircraft, 10000);