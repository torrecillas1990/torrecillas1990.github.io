// 1. REGISTRO DEL SERVICE WORKER
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .catch(err => console.warn('Error en Service Worker', err));
    });
}

// 2. INICIALIZAR EL MAPA (Vista por defecto provisional)
const map = L.map('map').setView([40.4168, -3.7038], 6);

// Capa del mapa base (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// Grupos independientes para los marcadores
const markersLayer = L.layerGroup().addTo(map);
const userLayer = L.layerGroup().addTo(map); // Capa exclusiva para el usuario

// 3. VARIABLES Y EVENTOS DE FILTROS
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

// 4. NUEVO: GEOLOCALIZACIÓN DEL USUARIO
function initUserLocation() {
    if (!navigator.geolocation) {
        console.warn("Tu navegador no soporta geolocalización.");
        return;
    }

    // watchPosition actualiza la ubicación si el usuario se mueve
    navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            // Limpiamos la posición anterior del usuario antes de poner la nueva
            userLayer.clearLayers();

            // Creamos un icono personalizado (punto azul) usando el CSS que definimos
            const userIcon = L.divIcon({
                className: 'user-location-marker',
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            });

            // Añadimos el marcador de tu posición
            const userMarker = L.marker([lat, lon], { icon: userIcon });
            userMarker.bindPopup("<b>Estás aquí</b>").addTo(userLayer);

            // La primera vez que obtiene la ubicación, centra la cámara del mapa en ti
            if (!map.getBounds().contains([lat, lon])) {
                map.setView([lat, lon], 8); // Zoom medio para ver los aviones de tu zona
            }
        },
        (error) => {
            console.warn("Error al obtener la ubicación o permiso denegado:", error.message);
        },
        {
            enableHighAccuracy: true, // Intenta usar GPS si está disponible en el móvil
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// 5. OBTENER DATOS (API OpenSky mediante Proxy CORS)
async function fetchAircraft() {
    try {
        const targetUrl = 'https://opensky-network.org/api/states/all?lamin=35.0&lomin=-10.0&lamax=44.0&lomax=5.0';
        const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        
        const response = await fetch(url);
        
        // 1. Leemos la respuesta como texto puro primero
        const text = await response.text();
        
        // 2. Si el servidor nos ha bloqueado por exceso de peticiones, salimos sin romper la app
        if (text === "Too many requests" || text.includes("429")) {
            console.warn("Límite de OpenSky alcanzado. Esperando al siguiente ciclo...");
            return; 
        }

        // 3. Si no hay error, convertimos el texto a JSON
        const data = JSON.parse(text);

        if (data && data.states) {
            planesData = data.states;
            renderPlanes();
        }
    } catch (error) {
        console.warn("Error temporal de red, reintentando en breve...", error.message);
    }
}

// 6. PINTAR DATOS EN EL MAPA
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
            let catText = "Sin clasificar";
            if (category >= 4 && category <= 7) catText = "Comercial/Pesado";
            if (category === 2 || category === 3) catText = "Ligero";
            if (category === 8) catText = "Helicóptero";

            const marker = L.marker([lat, lon]);
            marker.bindPopup(`
                <b>Vuelo:</b> ${callsign ? callsign.trim() : 'Sin indicativo'}<br>
                <b>Tipo:</b> ${catText}<br>
                <b>Altitud:</b> ${baro_altitude} m<br>
                <b>Velocidad:</b> ${velocity} m/s
            `);

            markersLayer.addLayer(marker);
        }
    });
}

// 7. INICIO
initUserLocation(); // Pedir ubicación e iniciar tracking del usuario
fetchAircraft();    // Descargar aviones
setInterval(fetchAircraft, 15000);