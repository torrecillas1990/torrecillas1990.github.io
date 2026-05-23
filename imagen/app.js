// ==========================================
// 1. CONFIGURACIÓN BASE Y PANELES COLAPSABLES
// ==========================================
if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.error(e))); }
const panelTools = document.getElementById('panel-tools'); 
const panelLayers = document.getElementById('panel-layers');
document.getElementById('btnToggleTools').addEventListener('click', () => { panelTools.classList.toggle('open'); panelLayers.classList.remove('open'); });
document.getElementById('btnCloseTools').addEventListener('click', () => panelTools.classList.remove('open'));
document.getElementById('btnToggleLayers').addEventListener('click', () => { panelLayers.classList.toggle('open'); panelTools.classList.remove('open'); });
document.getElementById('btnCloseLayers').addEventListener('click', () => panelLayers.classList.remove('open'));

// ==========================================
// 2. INICIALIZACIÓN DEL LIENZO
// ==========================================
const container = document.getElementById('workspace-container');
const canvas = new fabric.Canvas('mainCanvas', {
    width: window.innerWidth < 800 ? window.innerWidth * 0.9 : 800, 
    height: window.innerHeight < 600 ? window.innerHeight * 0.7 : 600,
    backgroundColor: 'transparent', preserveObjectStacking: true
});

// ==========================================
// 3. SISTEMA DE HISTORIAL
// ==========================================
let canvasHistory = []; let historyStep = -1; let isHistoryProcessing = false; let isMaskProcessing = false; 
function saveHistory() {
    if (isHistoryProcessing || isMaskProcessing) return;
    if (historyStep < canvasHistory.length - 1) canvasHistory = canvasHistory.slice(0, historyStep + 1);
    canvasHistory.push(JSON.stringify({ width: canvas.width, height: canvas.height, json: canvas.toJSON(['name']) }));
    historyStep++;
}
function undo() {
    if (historyStep > 0) {
        isHistoryProcessing = true; historyStep--; const state = JSON.parse(canvasHistory[historyStep]);
        canvas.setWidth(state.width); canvas.setHeight(state.height);
        canvas.loadFromJSON(state.json, function() { canvas.renderAll(); updateLayersPanel(); isHistoryProcessing = false; });
    }
}
function redo() {
    if (historyStep < canvasHistory.length - 1) {
        isHistoryProcessing = true; historyStep++; const state = JSON.parse(canvasHistory[historyStep]);
        canvas.setWidth(state.width); canvas.setHeight(state.height);
        canvas.loadFromJSON(state.json, function() { canvas.renderAll(); updateLayersPanel(); isHistoryProcessing = false; });
    }
}

// ==========================================
// 4. SISTEMA DE CAPAS
// ==========================================
const layersList = document.getElementById('layers-list');
function updateLayersPanel() {
    layersList.innerHTML = ''; const objects = canvas.getObjects(); const activeObject = canvas.getActiveObject();
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i]; if (obj.name === 'CropOverlay') continue;
        const li = document.createElement('li'); li.className = 'layer-item'; if (obj === activeObject) li.classList.add('active');
        li.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') { canvas.setActiveObject(obj); canvas.renderAll(); if (window.innerWidth < 600) panelLayers.classList.remove('open'); }
        });
        const nameSpan = document.createElement('span'); nameSpan.className = 'layer-name'; nameSpan.textContent = obj.name || `${obj.type.charAt(0).toUpperCase() + obj.type.slice(1)} ${i + 1}`;
        const actionsDiv = document.createElement('div'); actionsDiv.className = 'layer-actions';
        const btnVisibility = document.createElement('button'); btnVisibility.textContent = obj.visible ? '👁️' : '🙈'; btnVisibility.onclick = () => { obj.set('visible', !obj.visible); canvas.renderAll(); updateLayersPanel(); saveHistory(); };
        const btnUp = document.createElement('button'); btnUp.innerHTML = '↑'; btnUp.onclick = () => { canvas.bringForward(obj); canvas.renderAll(); updateLayersPanel(); saveHistory(); };
        const btnDown = document.createElement('button'); btnDown.innerHTML = '↓'; btnDown.onclick = () => { canvas.sendBackwards(obj); canvas.renderAll(); updateLayersPanel(); saveHistory(); };
        const btnDelete = document.createElement('button'); btnDelete.innerHTML = '🗑️'; btnDelete.onclick = () => { canvas.remove(obj); canvas.discardActiveObject(); };
        actionsDiv.appendChild(btnVisibility); actionsDiv.appendChild(btnUp); actionsDiv.appendChild(btnDown); actionsDiv.appendChild(btnDelete);
        li.appendChild(nameSpan); li.appendChild(actionsDiv); layersList.appendChild(li);
    }
}

// ==========================================
// 5. IMPORTAR, EXPORTAR Y EVENTOS GLOBALES
// ==========================================
function addImageToCanvas(file) {
    if (!file.type.match('image.*')) return alert('Imagen no válida.');
    const reader = new FileReader();
    reader.onload = function(event) {
        const imgObj = new Image(); imgObj.src = event.target.result;
        imgObj.onload = function() {
            const fabricImg = new fabric.Image(imgObj);
            const scale = Math.min((canvas.width * 0.9) / fabricImg.width, (canvas.height * 0.9) / fabricImg.height, 1);
            fabricImg.scale(scale); fabricImg.set({ left: canvas.width / 2, top: canvas.height / 2, originX: 'center', originY: 'center', name: 'Foto' });
            canvas.add(fabricImg); canvas.setActiveObject(fabricImg); canvas.renderAll();
        }
    }; reader.readAsDataURL(file);
}
document.getElementById('btnUpload').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('btnUndo').addEventListener('click', undo); document.getElementById('btnRedo').addEventListener('click', redo);
document.getElementById('fileInput').addEventListener('change', function(e) { if (e.target.files[0]) { addImageToCanvas(e.target.files[0]); this.value = ''; } });

function exportCanvas(format) {
    const originalVpt = canvas.viewportTransform; const originalZoom = canvas.getZoom(); canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    const link = document.createElement('a'); link.download = `proyecto-foto-${new Date().getTime()}.${format}`;
    link.href = canvas.toDataURL({ format: format, quality: 1.0, multiplier: 2 });
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    canvas.setViewportTransform(originalVpt); canvas.setZoom(originalZoom); canvas.renderAll();
}
document.getElementById('btnExportPNG').addEventListener('click', () => exportCanvas('png'));
document.getElementById('btnExportJPG').addEventListener('click', () => exportCanvas('jpeg'));

const workspace = document.getElementById('workspace');
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => workspace.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }));
['dragenter', 'dragover'].forEach(eventName => workspace.addEventListener(eventName, () => workspace.style.boxShadow = '0 0 20px #00bfff'));
['dragleave', 'drop'].forEach(eventName => workspace.addEventListener(eventName, () => workspace.style.boxShadow = '0 0 20px rgba(0,0,0,0.8)'));
workspace.addEventListener('drop', function(e) { if (e.dataTransfer.files.length > 0) addImageToCanvas(e.dataTransfer.files[0]); });

window.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') { e.shiftKey ? redo() : undo(); e.preventDefault(); }
        else if (e.key === 'y' || e.key === 'Y') { redo(); e.preventDefault(); }
    }
});
canvas.on('object:added', (e) => { if (e.target && e.target.name === 'CropOverlay') return; updateLayersPanel(); saveHistory(); });
canvas.on('object:removed', (e) => { if (e.target && e.target.name === 'CropOverlay') return; updateLayersPanel(); saveHistory(); });
canvas.on('object:modified', (e) => { if (e.target && e.target.name === 'CropOverlay') return; updateLayersPanel(); saveHistory(); });
canvas.on('selection:created', updateLayersPanel); canvas.on('selection:updated', updateLayersPanel); canvas.on('selection:cleared', updateLayersPanel);


// ==========================================
// 6. CONTROLADORES DE UI Y HERRAMIENTAS ACTIVAS
// ==========================================
// ==========================================
// 6. CONTROLADORES DE UI Y HERRAMIENTAS ACTIVAS
// ==========================================
let isPanMode = false, isCloneMode = false, isCropMode = false, isLassoMode = false, isEyedropperMode = false, isEraserMode = false;
let cloneSource = { x: 0, y: 0 }, cloneImageSnapshot = null, cloneDeltaX = 0, cloneDeltaY = 0, isCloneDeltaSet = false, isSettingCloneSource = false, myCloneBrush = null;
let cropRect = null, cropOrigX = 0, cropOrigY = 0, isDrawingCrop = false, lassoTarget = null, eraserTarget = null;

const toolBars = [
    document.getElementById('tool-options-bar'), document.getElementById('tool-crop-bar'),
    document.getElementById('tool-lasso-bar'), document.getElementById('tool-filters-bar'),
    document.getElementById('tool-shapes-bar'), document.getElementById('tool-text-bar'),
    document.getElementById('tool-color-bar'), document.getElementById('tool-eraser-bar')
];

function setActiveUI(id) { document.querySelectorAll('.tool-item').forEach(el => el.classList.remove('active')); if(id) document.getElementById(id).classList.add('active'); }
function closeAllTools() {
    isPanMode = isCloneMode = isCropMode = isLassoMode = isEyedropperMode = isEraserMode = false;
    canvas.isDrawingMode = false; canvas.selection = true; canvas.defaultCursor = 'default';
    toolBars.forEach(b => { if(b) b.style.display = 'none'; });
    if(cropRect) { canvas.remove(cropRect); cropRect = null; }
    canvas.getObjects().forEach(o => { o.selectable = true; o.evented = true; });
    document.getElementById('panel-tools').classList.remove('open');
    canvas.renderAll();
}

document.getElementById('tool-select').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('tool-pan').addEventListener('click', () => { closeAllTools(); isPanMode = true; canvas.selection = false; canvas.defaultCursor = 'grab'; setActiveUI('tool-pan'); });
document.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', () => {
    if(btn.id !== 'btnCloseTools' && btn.id !== 'btnCloseLayers') { closeAllTools(); setActiveUI('tool-select'); }
}));

// ==========================================
// 7. HERRAMIENTAS: CLONAR, CROP, LAZO, BORRADOR
// ==========================================
document.getElementById('tool-clone').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-clone'); canvas.discardActiveObject(); isCloneMode = true; isSettingCloneSource = true; isCloneDeltaSet = false; document.getElementById('tool-options-bar').style.display = 'flex'; document.getElementById('clone-status').innerText = '🎯 Fija el Origen'; canvas.defaultCursor = 'crosshair'; });
document.getElementById('btn-reset-clone').addEventListener('click', () => { isSettingCloneSource = true; isCloneDeltaSet = false; canvas.isDrawingMode = false; canvas.defaultCursor = 'crosshair'; document.getElementById('clone-status').innerText = '🎯 Fija el Origen'; });
document.getElementById('btn-close-tool').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('clone-size').addEventListener('input', e => { if (myCloneBrush) myCloneBrush.width = parseInt(e.target.value, 10); });

document.getElementById('tool-crop').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-crop'); canvas.discardActiveObject(); isCropMode = true; canvas.selection = false; canvas.defaultCursor = 'crosshair'; canvas.getObjects().forEach(o => { o.selectable = false; o.evented = false; }); document.getElementById('tool-crop-bar').style.display = 'flex'; document.getElementById('btn-apply-crop').style.display = 'none'; });
document.getElementById('btn-cancel-crop').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('btn-apply-crop').addEventListener('click', () => { if (!cropRect) return; const bound = cropRect.getBoundingRect(); canvas.remove(cropRect); canvas.getObjects().forEach(obj => { obj.set({ left: obj.left - bound.left, top: obj.top - bound.top }); obj.setCoords(); }); canvas.setWidth(bound.width); canvas.setHeight(bound.height); cropRect = null; closeAllTools(); setActiveUI('tool-select'); updateLayersPanel(); saveHistory(); });

document.getElementById('tool-lasso').addEventListener('click', () => { lassoTarget = canvas.getActiveObject(); if (!lassoTarget) return alert('Selecciona primero la capa a recortar.'); closeAllTools(); setActiveUI('tool-lasso'); isLassoMode = true; canvas.isDrawingMode = true; canvas.freeDrawingBrush = new fabric.PencilBrush(canvas); canvas.freeDrawingBrush.color = 'rgba(0,191,255,0.7)'; canvas.freeDrawingBrush.width = 4; document.getElementById('tool-lasso-bar').style.display = 'flex'; });
document.getElementById('btn-cancel-lasso').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });

// --- HERRAMIENTA BORRADOR ---
document.getElementById('tool-eraser').addEventListener('click', () => { 
    eraserTarget = canvas.getActiveObject();
    if (!eraserTarget) return alert('Por favor, selecciona primero la capa que quieres borrar.');
    
    closeAllTools(); 
    setActiveUI('tool-eraser'); 
    isEraserMode = true; 
    canvas.isDrawingMode = true; 
    
    // Configuramos un pincel rojo semitransparente para ver lo que borramos
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas); 
    canvas.freeDrawingBrush.color = 'rgba(255, 0, 0, 0.4)'; 
    canvas.freeDrawingBrush.width = parseInt(document.getElementById('eraser-size').value, 10); 
    
    document.getElementById('tool-eraser-bar').style.display = 'flex'; 
});

document.getElementById('btn-cancel-eraser').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('eraser-size').addEventListener('input', e => { if (isEraserMode) canvas.freeDrawingBrush.width = parseInt(e.target.value, 10); });

// ==========================================
// 8. PANEL DE COLOR Y PIPETA
// ==========================================
const globalColorPicker = document.getElementById('global-color-picker');
const colorTargetType = document.getElementById('color-apply-target');

document.getElementById('tool-color').addEventListener('click', () => { 
    closeAllTools(); setActiveUI('tool-color'); 
    const obj = canvas.getActiveObject();
    if (obj && (obj.type === 'i-text' || ['rect', 'circle', 'triangle', 'ellipse', 'path', 'polygon'].includes(obj.type))) {
        const currentColor = colorTargetType.value === 'fill' ? obj.fill : obj.stroke;
        if (currentColor && currentColor !== 'transparent') globalColorPicker.value = currentColor;
    }
    document.getElementById('tool-color-bar').style.display = 'flex'; 
});

function applyGlobalColor(hexColor) {
    if(hexColor !== 'transparent') globalColorPicker.value = hexColor;
    const obj = canvas.getActiveObject();
    if (obj && (obj.type === 'i-text' || ['rect', 'circle', 'triangle', 'ellipse', 'path', 'polygon'].includes(obj.type))) {
        if (colorTargetType.value === 'fill') obj.set('fill', hexColor);
        else { obj.set('stroke', hexColor); if (hexColor !== 'transparent' && obj.strokeWidth === 0) obj.set('strokeWidth', 3); }
        canvas.renderAll(); saveHistory();
    }
}

globalColorPicker.addEventListener('input', (e) => applyGlobalColor(e.target.value));
colorTargetType.addEventListener('change', () => {
    const obj = canvas.getActiveObject();
    if (obj) { const col = colorTargetType.value === 'fill' ? obj.fill : obj.stroke; if (col && col !== 'transparent') globalColorPicker.value = col; }
});
document.querySelectorAll('.color-swatch').forEach(swatch => { swatch.addEventListener('click', (e) => applyGlobalColor(e.target.dataset.color)); });

document.getElementById('btn-eyedropper').addEventListener('click', async () => {
    if (window.EyeDropper) {
        try { const dropper = new EyeDropper(); const result = await dropper.open(); applyGlobalColor(result.sRGBHex); } catch (e) {}
    } else {
        isEyedropperMode = true; canvas.defaultCursor = 'crosshair';
        document.getElementById('color-status').innerText = '🎯 Haz clic para capturar'; document.getElementById('color-status').style.color = '#ff0000';
    }
});

// ==========================================
// 9. FORMAS Y TEXTO (VECTORIAL)
// ==========================================
document.getElementById('tool-shapes').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-shapes'); document.getElementById('tool-shapes-bar').style.display = 'flex'; });
document.getElementById('shape-fill-type').addEventListener('change', (e) => { document.getElementById('shape-stroke-container').style.display = e.target.value === 'outline' ? 'flex' : 'none'; });
document.getElementById('btn-add-shape').addEventListener('click', () => {
    const type = document.getElementById('shape-type').value; const isOutline = document.getElementById('shape-fill-type').value === 'outline'; const strokeW = parseInt(document.getElementById('shape-stroke-width').value, 10); const color = globalColorPicker.value;
    const options = { left: canvas.width / 2, top: canvas.height / 2, originX: 'center', originY: 'center', fill: isOutline ? 'transparent' : color, stroke: isOutline ? color : null, strokeWidth: isOutline ? strokeW : 0, transparentCorners: false, cornerColor: 'white', cornerStrokeColor: 'black', borderColor: 'white' };
    let shape;
    switch(type) {
        case 'square': shape = new fabric.Rect({ ...options, width: 100, height: 100 }); break;
        case 'rectangle': shape = new fabric.Rect({ ...options, width: 150, height: 100 }); break;
        case 'circle': shape = new fabric.Circle({ ...options, radius: 50 }); break;
        case 'triangle': shape = new fabric.Triangle({ ...options, width: 100, height: 100 }); break;
        case 'star': shape = new fabric.Polygon([{x:50,y:0},{x:61,y:35},{x:98,y:35},{x:68,y:57},{x:79,y:91},{x:50,y:70},{x:21,y:91},{x:32,y:57},{x:2,y:35},{x:39,y:35}], options); break;
    }
    shape.name = 'Forma Vectorial'; canvas.add(shape); canvas.setActiveObject(shape); canvas.renderAll();
});

document.getElementById('tool-text').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-text'); document.getElementById('tool-text-bar').style.display = 'flex'; });
document.getElementById('text-fill-type').addEventListener('change', (e) => { document.getElementById('text-stroke-container').style.display = e.target.value === 'outline' ? 'flex' : 'none'; });
document.getElementById('btn-add-text').addEventListener('click', () => {
    const isOutline = document.getElementById('text-fill-type').value === 'outline'; const strokeW = parseInt(document.getElementById('text-stroke-width').value, 10); const color = globalColorPicker.value;
    const options = { left: canvas.width / 2, top: canvas.height / 2, originX: 'center', originY: 'center', fontFamily: 'sans-serif', fontSize: 60, fontWeight: 'bold', fill: isOutline ? 'transparent' : color, stroke: isOutline ? color : null, strokeWidth: isOutline ? strokeW : 0, transparentCorners: false, cornerColor: 'white', cornerStrokeColor: 'black', borderColor: 'white', name: 'Texto' };
    const text = new fabric.IText('Doble clic', options); canvas.add(text); canvas.setActiveObject(text); canvas.renderAll();
});

// ==========================================
// 10. FILTROS Y TRANSFORMACIONES
// ==========================================
let activeFilterObject = null;
document.getElementById('tool-filters').addEventListener('click', () => {
    activeFilterObject = canvas.getActiveObject();
    if (!activeFilterObject || activeFilterObject.type !== 'image') return alert('Por favor, selecciona una foto para aplicar filtros.');
    closeAllTools(); setActiveUI('tool-filters');
    const filters = activeFilterObject.filters || [];
    document.getElementById('filter-brightness').value = filters[0] ? filters[0].brightness : 0;
    document.getElementById('filter-contrast').value   = filters[1] ? filters[1].contrast : 0;
    document.getElementById('filter-saturation').value = filters[2] ? filters[2].saturation : 0;
    document.getElementById('filter-opacity').value = activeFilterObject.opacity;
    document.getElementById('tool-filters-bar').style.display = 'flex';
});

const opacitySlider = document.getElementById('filter-opacity');
opacitySlider.addEventListener('input', (e) => { if (!activeFilterObject) return; activeFilterObject.set('opacity', parseFloat(e.target.value)); canvas.renderAll(); });
opacitySlider.addEventListener('change', saveHistory);

document.getElementById('btn-reset-filters').addEventListener('click', () => {
    if(!activeFilterObject) return; activeFilterObject.filters = []; activeFilterObject.applyFilters(); activeFilterObject.set('opacity', 1); canvas.renderAll();
    document.getElementById('filter-brightness').value = document.getElementById('filter-contrast').value = document.getElementById('filter-saturation').value = 0; document.getElementById('filter-opacity').value = 1; saveHistory();
});
function applySliderFilter(index, filterClass, prop, value) {
    if (!activeFilterObject) return; const floatVal = parseFloat(value);
    if (floatVal === 0) activeFilterObject.filters[index] = null; else { const options = {}; options[prop] = floatVal; activeFilterObject.filters[index] = new fabric.Image.filters[filterClass](options); }
    activeFilterObject.applyFilters(); canvas.renderAll();
}
document.getElementById('filter-brightness').addEventListener('input', (e) => applySliderFilter(0, 'Brightness', 'brightness', e.target.value)); document.getElementById('filter-contrast').addEventListener('input', (e) => applySliderFilter(1, 'Contrast', 'contrast', e.target.value)); document.getElementById('filter-saturation').addEventListener('input', (e) => applySliderFilter(2, 'Saturation', 'saturation', e.target.value));
document.getElementById('filter-brightness').addEventListener('change', saveHistory); document.getElementById('filter-contrast').addEventListener('change', saveHistory); document.getElementById('filter-saturation').addEventListener('change', saveHistory);

function applyToggleFilter(filterClass) {
    if (!activeFilterObject) return; const existingIndex = activeFilterObject.filters.findIndex(f => f && f.type === filterClass);
    if (existingIndex > -1) activeFilterObject.filters[existingIndex] = null; else activeFilterObject.filters.push(new fabric.Image.filters[filterClass]());
    activeFilterObject.applyFilters(); canvas.renderAll(); saveHistory();
}
document.getElementById('btn-filter-gray').addEventListener('click', () => applyToggleFilter('Grayscale')); document.getElementById('btn-filter-sepia').addEventListener('click', () => applyToggleFilter('Sepia')); document.getElementById('btn-filter-invert').addEventListener('click', () => applyToggleFilter('Invert'));
document.getElementById('btn-flip-x').addEventListener('click', () => { if (!activeFilterObject) return; activeFilterObject.set('flipX', !activeFilterObject.flipX); canvas.renderAll(); saveHistory(); });
document.getElementById('btn-flip-y').addEventListener('click', () => { if (!activeFilterObject) return; activeFilterObject.set('flipY', !activeFilterObject.flipY); canvas.renderAll(); saveHistory(); });
document.getElementById('btn-rotate-90').addEventListener('click', () => { if (!activeFilterObject) return; activeFilterObject.rotate(activeFilterObject.angle + 90); canvas.renderAll(); saveHistory(); });

// ==========================================
// 11. IA OFFLINE (BORRADO DE FONDO)
// ==========================================
document.getElementById('tool-ai').addEventListener('click', async () => {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'image') return alert("Selecciona una foto primero.");
    if (!window.confirm("La IA procesará la imagen (la primera vez descargará el modelo, lo cual tarda). ¿Continuar?")) return;

    isMaskProcessing = true; document.body.style.cursor = 'wait';
    const imgEl = new Image(); imgEl.src = activeObj.toDataURL();
    
    imgEl.onload = async () => {
        try {
            const segmenter = await window.transformers.pipeline('image-segmentation', 'briaai/RMBG-1.4');
            const output = await segmenter(imgEl.src);
            const maskCanvas = document.createElement('canvas'); maskCanvas.width = imgEl.naturalWidth; maskCanvas.height = imgEl.naturalHeight; maskCanvas.getContext('2d').drawImage(output, 0, 0);
            const finalC = document.createElement('canvas'); finalC.width = imgEl.naturalWidth; finalC.height = imgEl.naturalHeight; const fCtx = finalC.getContext('2d');
            fCtx.drawImage(imgEl, 0, 0); fCtx.globalCompositeOperation = 'destination-in'; fCtx.drawImage(maskCanvas, 0, 0);
            
            fabric.Image.fromURL(finalC.toDataURL('image/png'), (newImg) => {
                newImg.set({ left: activeObj.left, top: activeObj.top, scaleX: activeObj.scaleX, scaleY: activeObj.scaleY, name: activeObj.name + " (Sin Fondo)" });
                canvas.remove(activeObj); canvas.add(newImg); canvas.setActiveObject(newImg); canvas.renderAll();
                isMaskProcessing = false; document.body.style.cursor = 'default'; saveHistory(); updateLayersPanel();
            });
        } catch (err) { alert("Error en la IA: " + err.message); isMaskProcessing = false; document.body.style.cursor = 'default'; }
    };
});

// ==========================================
// 12. MOTOR CENTRALIZADO DE RATÓN (UNIFICACIÓN TOTAL)
// ==========================================
document.getElementById('btnResetView').addEventListener('click', () => { canvas.setViewportTransform([1, 0, 0, 1, 0, 0]); canvas.renderAll(); });
canvas.on('mouse:wheel', function(opt) { var delta = opt.e.deltaY; var zoom = canvas.getZoom(); zoom *= 0.999 ** delta; if (zoom > 20) zoom = 20; if (zoom < 0.1) zoom = 0.1; canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom); opt.e.preventDefault(); opt.e.stopPropagation(); });

let isDraggingCamera = false, lastPosX = 0, lastPosY = 0;

canvas.on('mouse:down', function(opt) {
    // A. CÁMARA (PAN)
    if (opt.e.altKey === true || isPanMode) { 
        isDraggingCamera = true; canvas.selection = false; 
        lastPosX = opt.e.clientX || (opt.e.touches && opt.e.touches[0].clientX); 
        lastPosY = opt.e.clientY || (opt.e.touches && opt.e.touches[0].clientY); 
        canvas.defaultCursor = 'grabbing'; return; 
    }
    
    // B. PIPETA MANUAL (FALLBACK)
    if (isEyedropperMode) {
        const e = opt.e; const rect = canvas.lowerCanvasEl.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const x = (clientX - rect.left) * (canvas.lowerCanvasEl.width / rect.width);
        const y = (clientY - rect.top) * (canvas.lowerCanvasEl.height / rect.height);
        const p = canvas.lowerCanvasEl.getContext('2d', { willReadFrequently: true }).getImageData(x, y, 1, 1).data;
        if (p[3] === 0) applyGlobalColor('transparent'); else applyGlobalColor("#" + ("000000" + ((p[0] << 16) | (p[1] << 8) | p[2]).toString(16)).slice(-6));
        isEyedropperMode = false; canvas.defaultCursor = 'default';
        document.getElementById('color-status').innerText = '🎨 Panel de Color'; document.getElementById('color-status').style.color = '#00bfff'; return;
    }

    // C. CLONAR
    if (isCloneMode && isSettingCloneSource) {
        const pointer = canvas.getPointer(opt.e); cloneSource = { x: pointer.x, y: pointer.y }; isSettingCloneSource = false;
        const img = new Image(); img.src = canvas.toDataURL({ format: 'png', multiplier: 1 });
        img.onload = () => {
            cloneImageSnapshot = img; document.getElementById('clone-status').innerText = '🖌️ Pintando...'; canvas.defaultCursor = 'default';
            if (!myCloneBrush) {
                myCloneBrush = new fabric.PatternBrush(canvas); const originalDown = myCloneBrush.onMouseDown.bind(myCloneBrush);
                myCloneBrush.onMouseDown = function(ptr, options) {
                    if (isCloneMode && cloneImageSnapshot && !isCloneDeltaSet) {
                        cloneDeltaX = ptr.x - cloneSource.x; cloneDeltaY = ptr.y - cloneSource.y; isCloneDeltaSet = true; 
                        const tempC = document.createElement('canvas'); tempC.width = canvas.width; tempC.height = canvas.height;
                        tempC.getContext('2d').drawImage(cloneImageSnapshot, cloneDeltaX, cloneDeltaY); this.source = tempC; 
                    }
                    originalDown(ptr, options);
                };
            }
            myCloneBrush.width = parseInt(document.getElementById('clone-size').value, 10); canvas.freeDrawingBrush = myCloneBrush; canvas.isDrawingMode = true;
        };
    }
    
    // D. RECORTAR LIENZO
    if (isCropMode && !cropRect) {
        isDrawingCrop = true; const pointer = canvas.getPointer(opt.e); cropOrigX = pointer.x; cropOrigY = pointer.y;
        cropRect = new fabric.Rect({ left: cropOrigX, top: cropOrigY, width: 0, height: 0, fill: 'rgba(0,191,255,0.2)', stroke: '#00bfff', strokeWidth: 2, strokeDashArray: [5,5], hasRotatingPoint: false, name: 'CropOverlay' });
        canvas.add(cropRect); canvas.setActiveObject(cropRect);
    }
});

canvas.on('mouse:move', function(opt) {
    if (isDraggingCamera) { let e = opt.e; let clientX = e.clientX || (e.touches && e.touches[0].clientX); let clientY = e.clientY || (e.touches && e.touches[0].clientY); let vpt = canvas.viewportTransform; vpt[4] += clientX - lastPosX; vpt[5] += clientY - lastPosY; canvas.requestRenderAll(); lastPosX = clientX; lastPosY = clientY; return; }
    if (!isCropMode || !isDrawingCrop || !cropRect) return; const pointer = canvas.getPointer(opt.e); const w = pointer.x - cropOrigX; const h = pointer.y - cropOrigY; cropRect.set({ left: w < 0 ? pointer.x : cropOrigX, top: h < 0 ? pointer.y : cropOrigY, width: Math.abs(w), height: Math.abs(h) }); canvas.renderAll();
});

canvas.on('mouse:up', function() {
    if (isDraggingCamera) { canvas.setViewportTransform(canvas.viewportTransform); isDraggingCamera = false; canvas.selection = !isPanMode; canvas.defaultCursor = isPanMode ? 'grab' : 'default'; return; }
    if (isCropMode && isDrawingCrop) { isDrawingCrop = false; cropRect.setCoords(); document.getElementById('btn-apply-crop').style.display = 'block'; canvas.defaultCursor = 'default'; }
    // Limpieza de Guías Magnéticas al soltar
    verticalGuide = null; horizontalGuide = null; canvas.requestRenderAll();
});

// Evento que se dispara al terminar de dibujar un trazo (Lazo, Clonar o Borrador)
canvas.on('path:created', function(opt) {
    if (isCloneMode) { 
        opt.path.name = 'Clonación'; updateLayersPanel(); 
    } 
    else if (isLassoMode || isEraserMode) {
        isMaskProcessing = true; 
        const path = opt.path; 
        canvas.remove(path); 
        
        // Configurar el path según la herramienta
        if (isLassoMode) path.set({ fill: 'black', stroke: 'transparent' });
        if (isEraserMode) path.set({ stroke: 'black', opacity: 1, fill: 'transparent' }); // Trazo grueso sólido
        
        const targetLayer = isLassoMode ? lassoTarget : eraserTarget;
        
        // TRUCO PRO: Guardamos la vista de cámara actual y la reseteamos para capturar a resolución real sin que se rompa al estar haciendo Zoom.
        const originalVpt = canvas.viewportTransform.slice();
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

        // Ocultamos todo excepto la capa objetivo y tomamos la foto
        const visibilityMap = new Map(); 
        canvas.getObjects().forEach(obj => { visibilityMap.set(obj, obj.visible); obj.visible = false; });
        
        targetLayer.visible = true; 
        canvas.renderAll(); 
        const imgDataUrl = canvas.toDataURL({ format: 'png' });
        
        // Hacemos lo mismo con el dibujo que has hecho (el Lazo o el Borrón)
        targetLayer.visible = false; 
        path.visible = true; 
        canvas.add(path); 
        canvas.renderAll(); 
        const pathDataUrl = canvas.toDataURL({ format: 'png' }); 
        canvas.remove(path);

        // Restaurar estado visual y cámara del usuario
        canvas.getObjects().forEach(obj => { obj.visible = visibilityMap.get(obj); }); 
        canvas.setViewportTransform(originalVpt);
        canvas.renderAll();
        
        // Motor nativo de fusión de capas
        const imgObj = new Image(); imgObj.src = imgDataUrl;
        imgObj.onload = () => {
            const pathObj = new Image(); pathObj.src = pathDataUrl;
            pathObj.onload = () => {
                const tempC = document.createElement('canvas'); tempC.width = canvas.width; tempC.height = canvas.height; const ctx = tempC.getContext('2d');
                ctx.drawImage(imgObj, 0, 0); 
                
                // Modo de fusión (Agujerear vs Mantener)
                if (isEraserMode) {
                    ctx.globalCompositeOperation = 'destination-out'; // La goma agujerea
                } else if (isLassoMode) {
                    const mode = document.getElementById('lasso-mode').value;
                    ctx.globalCompositeOperation = (mode === 'invert') ? 'destination-out' : 'destination-in';
                }
                
                ctx.drawImage(pathObj, 0, 0);
                const finalC = document.createElement('canvas'); finalC.width = canvas.width; finalC.height = canvas.height; finalC.getContext('2d').drawImage(tempC, 0, 0);
                
                fabric.Image.fromURL(finalC.toDataURL('image/png'), function(finalImg) {
                    finalImg.set({ left: 0, top: 0, name: targetLayer.name + (isEraserMode ? ' (Borrado)' : '') });
                    
                    // Respetar el orden (z-index) de la capa
                    const zIndex = canvas.getObjects().indexOf(targetLayer);
                    canvas.remove(targetLayer); 
                    canvas.insertAt(finalImg, zIndex, false);
                    canvas.setActiveObject(finalImg); 
                    
                    if (isLassoMode) {
                        closeAllTools(); setActiveUI('tool-select');
                    } else if (isEraserMode) {
                        // En modo goma NO cerramos la herramienta para que el usuario pueda seguir borrando
                        eraserTarget = finalImg;
                    }

                    isMaskProcessing = false; 
                    saveHistory();
                    updateLayersPanel();
                });
            };
        };
    }
});

// ==========================================
// 13. SMART GUIDES PRO (GUÍAS MAGNÉTICAS AVANZADAS)
// ==========================================
const snapZone = 12;
let verticalGuide = null;
let horizontalGuide = null;

canvas.on('object:moving', function(opt) {
    const obj = opt.target; const canvasW = canvas.width; const canvasH = canvas.height; const centerX = canvasW / 2; const centerY = canvasH / 2;
    let objCenter = obj.getCenterPoint();
    let objLeft = objCenter.x - (obj.getScaledWidth() / 2); let objRight = objCenter.x + (obj.getScaledWidth() / 2);
    let objTop = objCenter.y - (obj.getScaledHeight() / 2); let objBottom = objCenter.y + (obj.getScaledHeight() / 2);
    verticalGuide = null; horizontalGuide = null;

    if (Math.abs(objCenter.x - centerX) < snapZone) { obj.set({ left: obj.left - (objCenter.x - centerX) }); verticalGuide = centerX; } 
    else if (Math.abs(objLeft - 0) < snapZone) { obj.set({ left: obj.left - objLeft }); verticalGuide = 0; } 
    else if (Math.abs(objRight - canvasW) < snapZone) { obj.set({ left: obj.left - (objRight - canvasW) }); verticalGuide = canvasW; }

    if (Math.abs(objCenter.y - centerY) < snapZone) { obj.set({ top: obj.top - (objCenter.y - centerY) }); horizontalGuide = centerY; } 
    else if (Math.abs(objTop - 0) < snapZone) { obj.set({ top: obj.top - objTop }); horizontalGuide = 0; } 
    else if (Math.abs(objBottom - canvasH) < snapZone) { obj.set({ top: obj.top - (objBottom - canvasH) }); horizontalGuide = canvasH; }
});

canvas.on('after:render', function(opt) {
    if (verticalGuide === null && horizontalGuide === null) return;
    const ctx = opt.ctx; if (!ctx) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.strokeStyle = '#00bfff'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    const vpt = canvas.viewportTransform; const htmlCanvas = canvas.getElement();
    if (verticalGuide !== null) { const drawX = (verticalGuide * vpt[0]) + vpt[4]; ctx.beginPath(); ctx.moveTo(drawX, 0); ctx.lineTo(drawX, htmlCanvas.height); ctx.stroke(); }
    if (horizontalGuide !== null) { const drawY = (horizontalGuide * vpt[3]) + vpt[5]; ctx.beginPath(); ctx.moveTo(0, drawY); ctx.lineTo(htmlCanvas.width, drawY); ctx.stroke(); }
    ctx.restore();
});

// ==========================================
// ARRANQUE: Añadir Capa Base Inicial
// ==========================================
const rectBase = new fabric.Rect({
    name: 'Capa Base', left: canvas.width / 2 - 100, top: canvas.height / 2 - 100, 
    fill: '#a8d8ea', width: 200, height: 200, cornerColor: 'white', cornerStrokeColor: 'black', borderColor: 'white', transparentCorners: false
});
canvas.add(rectBase); canvas.setActiveObject(rectBase);
saveHistory();