// 1. REGISTRO DEL SERVICE WORKER
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .catch(err => console.warn('Error en Service Worker', err));
    });
}

// 2. INICIALIZAR EL MAPA
// Centramos en la Península Ibérica
const map = L.map('map').setView([40.4168, -3.7038], 6);

// Capa del mapa base (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// Grupo para los marcadores
const markersLayer = L.layerGroup().addTo(map);

// 3. VARIABLES Y EVENTOS DE FILTROS
let currentFilter = '';
let planesData = []; 

// Eventos del buscador de texto
document.getElementById('filter-btn').addEventListener('click', () => {
    currentFilter = document.getElementById('filter-input').value.trim().toLowerCase();
    renderPlanes(); 
});

document.getElementById('filter-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') document.getElementById('filter-btn').click();
});

// Evento para los checkboxes
document.querySelectorAll('#type-filters input').forEach(checkbox => {
    checkbox.addEventListener('change', renderPlanes);
});

// 4. OBTENER DATOS (API OpenSky mediante Proxy CORS)
async function fetchAircraft() {
    try {
        // La URL original de OpenSky
        const targetUrl = 'https://opensky-network.org/api/states/all?lamin=35.0&lomin=-10.0&lamax=44.0&lomax=5.0';
        
        // Usamos el proxy gratuito allorigins para saltarnos el CORS
        const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.states) {
            planesData = data.states;
            renderPlanes();
        }
    } catch (error) {
        console.error("Error obteniendo los datos:", error);
    }
}

// 5. PINTAR DATOS EN EL MAPA
function renderPlanes() {
    markersLayer.clearLayers();

    const showCommercial = document.querySelector('input[value="commercial"]').checked;
    const showLight = document.querySelector('input[value="light"]').checked;
    const showHeli = document.querySelector('input[value="heli"]').checked;
    const showOther = document.querySelector('input[value="other"]').checked;
    const showUnknown = document.querySelector('input[value="unknown"]').checked;

    planesData.forEach(plane => {
        const [icao24, callsign, country, time_pos, last_contact, lon, lat, baro_altitude, on_ground, velocity, true_track, vertical_rate, sensors, geo_altitude, squawk, spi, position_source, category] = plane;

        if (lat && lon && !on_ground) {
            
            // Filtro de Categoría
            let categoryMatch = false;
            if ((category >= 4 && category <= 7) && showCommercial) categoryMatch = true;
            else if ((category === 2 || category === 3) && showLight) categoryMatch = true;
            else if (category === 8 && showHeli) categoryMatch = true;
            else if ((category >= 9 && category <= 15) && showOther) categoryMatch = true;
            else if ((category === 0 || category === 1 || !category) && showUnknown) categoryMatch = true;

            if (!categoryMatch) return; 

            // Filtro de Texto
            if (currentFilter !== '') {
                const callsignStr = callsign ? callsign.trim().toLowerCase() : '';
                const countryStr = country ? country.trim().toLowerCase() : '';

                if (!callsignStr.includes(currentFilter) && !countryStr.includes(currentFilter)) {
                    return; 
                }
            }
            
            // Textos para el Popup
            let catText = "Desconocida";
            if (category >= 4 && category <= 7) catText = "Comercial/Pesado";
            if (category === 2 || category === 3) catText = "Ligero";
            if (category === 8) catText = "Helicóptero";

            const marker = L.marker([lat, lon]);
            marker.bindPopup(`
                <b>Vuelo:</b> ${callsign ? callsign.trim() : 'Sin indicativo'}<br>
                <b>Tipo:</b> ${catText} (Cod: ${category})<br>
                <b>Altitud:</b> ${baro_altitude} m<br>
                <b>Velocidad:</b> ${velocity} m/s
            `);

            markersLayer.addLayer(marker);
        }
    });
}

// 6. INICIO
fetchAircraft();
setInterval(fetchAircraft, 15000);