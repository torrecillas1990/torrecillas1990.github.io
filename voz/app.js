let parametrosVoz = null;

// --- CAPTURA DE VOZ ---
const btnIniciar = document.getElementById('btnIniciar');
const btnParar = document.getElementById('btnParar');

btnIniciar.addEventListener('click', () => {
    btnIniciar.disabled = true;
    btnParar.disabled = false;
    // La API de Web Speech no permite "analizar" el tono físicamente 
    // sin servidores, así que capturamos los parámetros de la voz detectada.
});

btnParar.addEventListener('click', () => {
    const voces = window.speechSynthesis.getVoices();
    // Guardamos la configuración de la primera voz disponible como ejemplo
    const config = {
        name: voces[0].name,
        lang: voces[0].lang,
        timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(config)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'voz_config.json';
    a.click();
    
    btnIniciar.disabled = false;
    btnParar.disabled = true;
});

// --- CARGA Y REPRODUCCIÓN ---
document.getElementById('fileInput').addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        parametrosVoz = JSON.parse(event.target.result);
        alert("Perfil de voz cargado: " + parametrosVoz.name);
    };
    reader.readAsText(e.target.files[0]);
});

document.getElementById('btnPlay').addEventListener('click', () => {
    if (!parametrosVoz) return alert("Carga un archivo primero");
    
    const msg = new SpeechSynthesisUtterance(document.getElementById('textoInput').value);
    const voces = window.speechSynthesis.getVoices();
    msg.voice = voces.find(v => v.name === parametrosVoz.name);
    window.speechSynthesis.speak(msg);
});

let audioContext, analyser, dataArray, stream;
let graficoCanvas = document.getElementById('visualizador');
let canvasCtx = graficoCanvas.getContext('2d');
let perfilVoz = []; // Aquí guardaremos los datos

// Iniciar análisis de audio
async function iniciarGrabacion() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    
    analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    dibujar();
}

function dibujar() {
    requestAnimationFrame(dibujar);
    analyser.getByteFrequencyData(dataArray);
    
    // Dibujar gráfico
    canvasCtx.fillStyle = 'rgb(200, 200, 200)';
    canvasCtx.fillRect(0, 0, 600, 150);
    
    let barWidth = (600 / analyser.frequencyBinCount) * 2.5;
    let x = 0;
    for(let i = 0; i < analyser.frequencyBinCount; i++) {
        let barHeight = dataArray[i] / 2;
        canvasCtx.fillStyle = 'rgb(50, 100, ' + (barHeight + 100) + ')';
        canvasCtx.fillRect(x, 150 - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }
    // Guardar una muestra del perfil cada frame
    perfilVoz.push(Array.from(dataArray));
}

// Al parar, guardamos el JSON con el promedio del perfil
document.getElementById('btnParar').addEventListener('click', () => {
    stream.getTracks().forEach(track => track.stop());
    
    // Calculamos el promedio de frecuencias para tener una "huella" de la voz
    const perfilPromediado = perfilVoz.reduce((acc, curr) => acc.map((v, i) => v + curr[i]), new Array(dataArray.length).fill(0))
                                     .map(v => v / perfilVoz.length);

    const blob = new Blob([JSON.stringify({ perfil: perfilPromediado })], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mi_perfil_voz.json';
    a.click();
});