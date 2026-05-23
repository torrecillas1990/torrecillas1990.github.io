// ==========================================
// 1. CONFIGURACIÓN BASE Y PANELES COLAPSABLES
// ==========================================
if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.error(e))); }
const panelTools = document.getElementById('panel-tools'); const panelLayers = document.getElementById('panel-layers');
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
// 5. EVENTOS GLOBALES, IMPORTAR Y EXPORTAR
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
    const originalVpt = canvas.viewportTransform; const originalZoom = canvas.getZoom();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
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
// 6. UI Y HERRAMIENTAS ACTIVAS
// ==========================================
let isPanMode = false, isCloneMode = false, isCropMode = false, isLassoMode = false;
let cloneSource = { x: 0, y: 0 }, cloneImageSnapshot = null, cloneDeltaX = 0, cloneDeltaY = 0, isCloneDeltaSet = false, isSettingCloneSource = false, myCloneBrush = null;
let cropRect = null, cropOrigX = 0, cropOrigY = 0, isDrawingCrop = false, lassoTarget = null;

const toolOptionsBar = document.getElementById('tool-options-bar');
const toolCropBar = document.getElementById('tool-crop-bar');
const toolLassoBar = document.getElementById('tool-lasso-bar');
const toolFiltersBar = document.getElementById('tool-filters-bar');
const toolShapesBar = document.getElementById('tool-shapes-bar');
const toolTextBar = document.getElementById('tool-text-bar');

function setActiveUI(id) { document.querySelectorAll('.tool-item').forEach(el => el.classList.remove('active')); if(id) document.getElementById(id).classList.add('active'); }
function closeAllTools() {
    isPanMode = isCloneMode = isCropMode = isLassoMode = false;
    canvas.isDrawingMode = false; canvas.selection = true; canvas.defaultCursor = 'default';
    [toolOptionsBar, toolCropBar, toolLassoBar, toolFiltersBar, toolShapesBar, toolTextBar].forEach(b => b.style.display = 'none');
    if(cropRect) { canvas.remove(cropRect); cropRect = null; }
    canvas.getObjects().forEach(o => { o.selectable = true; o.evented = true; });
    document.getElementById('panel-tools').classList.remove('open');
    canvas.renderAll();
}

document.getElementById('tool-select').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('tool-pan').addEventListener('click', () => { closeAllTools(); isPanMode = true; canvas.selection = false; canvas.defaultCursor = 'grab'; setActiveUI('tool-pan'); });

// Clonar, Recorte, Lazo
document.getElementById('tool-clone').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-clone'); canvas.discardActiveObject(); isCloneMode = true; isSettingCloneSource = true; isCloneDeltaSet = false; toolOptionsBar.style.display = 'flex'; document.getElementById('clone-status').innerText = '🎯 Fija el Origen'; canvas.defaultCursor = 'crosshair'; });
document.getElementById('btn-reset-clone').addEventListener('click', () => { isSettingCloneSource = true; isCloneDeltaSet = false; canvas.isDrawingMode = false; canvas.defaultCursor = 'crosshair'; document.getElementById('clone-status').innerText = '🎯 Fija el Origen'; });
document.getElementById('btn-close-tool').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('clone-size').addEventListener('input', e => { if (myCloneBrush) myCloneBrush.width = parseInt(e.target.value, 10); });

document.getElementById('tool-crop').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-crop'); canvas.discardActiveObject(); isCropMode = true; canvas.selection = false; canvas.defaultCursor = 'crosshair'; canvas.getObjects().forEach(o => { o.selectable = false; o.evented = false; }); toolCropBar.style.display = 'flex'; document.getElementById('btn-apply-crop').style.display = 'none'; });
document.getElementById('btn-cancel-crop').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('btn-apply-crop').addEventListener('click', () => { if (!cropRect) return; const bound = cropRect.getBoundingRect(); canvas.remove(cropRect); canvas.getObjects().forEach(obj => { obj.set({ left: obj.left - bound.left, top: obj.top - bound.top }); obj.setCoords(); }); canvas.setWidth(bound.width); canvas.setHeight(bound.height); cropRect = null; closeAllTools(); setActiveUI('tool-select'); updateLayersPanel(); saveHistory(); });

document.getElementById('tool-lasso').addEventListener('click', () => { lassoTarget = canvas.getActiveObject(); if (!lassoTarget) return alert('Por favor, selecciona primero la capa a recortar.'); closeAllTools(); setActiveUI('tool-lasso'); isLassoMode = true; canvas.isDrawingMode = true; canvas.freeDrawingBrush = new fabric.PencilBrush(canvas); canvas.freeDrawingBrush.color = 'rgba(0,191,255,0.7)'; canvas.freeDrawingBrush.width = 4; toolLassoBar.style.display = 'flex'; });
document.getElementById('btn-cancel-lasso').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });


// ==========================================
// 7. CÁMARA (PAN Y ZOOM) Y RATÓN
// ==========================================
document.getElementById('btnResetView').addEventListener('click', () => { canvas.setViewportTransform([1, 0, 0, 1, 0, 0]); canvas.renderAll(); });
canvas.on('mouse:wheel', function(opt) { var delta = opt.e.deltaY; var zoom = canvas.getZoom(); zoom *= 0.999 ** delta; if (zoom > 20) zoom = 20; if (zoom < 0.1) zoom = 0.1; canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom); opt.e.preventDefault(); opt.e.stopPropagation(); });

let isDraggingCamera = false, lastPosX = 0, lastPosY = 0;
canvas.on('mouse:down', function(opt) {
    if (opt.e.altKey === true || isPanMode) { isDraggingCamera = true; canvas.selection = false; lastPosX = opt.e.clientX || (opt.e.touches && opt.e.touches[0].clientX); lastPosY = opt.e.clientY || (opt.e.touches && opt.e.touches[0].clientY); canvas.defaultCursor = 'grabbing'; return; }
    if (isCloneMode && isSettingCloneSource) {
        const pointer = canvas.getPointer(opt.e); cloneSource = { x: pointer.x, y: pointer.y }; isSettingCloneSource = false;
        const img = new Image(); img.src = canvas.toDataURL({ format: 'png', multiplier: 1 });
        img.onload = () => { cloneImageSnapshot = img; document.getElementById('clone-status').innerText = '🖌️ Pintando...'; canvas.defaultCursor = 'default'; if (!myCloneBrush) { myCloneBrush = new fabric.PatternBrush(canvas); const originalDown = myCloneBrush.onMouseDown.bind(myCloneBrush); myCloneBrush.onMouseDown = function(ptr, options) { if (isCloneMode && cloneImageSnapshot && !isCloneDeltaSet) { cloneDeltaX = ptr.x - cloneSource.x; cloneDeltaY = ptr.y - cloneSource.y; isCloneDeltaSet = true; const tempC = document.createElement('canvas'); tempC.width = canvas.width; tempC.height = canvas.height; tempC.getContext('2d').drawImage(cloneImageSnapshot, cloneDeltaX, cloneDeltaY); this.source = tempC; } originalDown(ptr, options); }; } myCloneBrush.width = parseInt(document.getElementById('clone-size').value, 10); canvas.freeDrawingBrush = myCloneBrush; canvas.isDrawingMode = true; };
    }
    if (isCropMode && !cropRect) { isDrawingCrop = true; const pointer = canvas.getPointer(opt.e); cropOrigX = pointer.x; cropOrigY = pointer.y; cropRect = new fabric.Rect({ left: cropOrigX, top: cropOrigY, width: 0, height: 0, fill: 'rgba(0,191,255,0.2)', stroke: '#00bfff', strokeWidth: 2, strokeDashArray: [5,5], hasRotatingPoint: false, name: 'CropOverlay' }); canvas.add(cropRect); canvas.setActiveObject(cropRect); }
});

canvas.on('mouse:move', function(opt) {
    if (isDraggingCamera) { let e = opt.e; let clientX = e.clientX || (e.touches && e.touches[0].clientX); let clientY = e.clientY || (e.touches && e.touches[0].clientY); let vpt = canvas.viewportTransform; vpt[4] += clientX - lastPosX; vpt[5] += clientY - lastPosY; canvas.requestRenderAll(); lastPosX = clientX; lastPosY = clientY; return; }
    if (!isCropMode || !isDrawingCrop || !cropRect) return; const pointer = canvas.getPointer(opt.e); const w = pointer.x - cropOrigX; const h = pointer.y - cropOrigY; cropRect.set({ left: w < 0 ? pointer.x : cropOrigX, top: h < 0 ? pointer.y : cropOrigY, width: Math.abs(w), height: Math.abs(h) }); canvas.renderAll();
});

canvas.on('mouse:up', function() {
    if (isDraggingCamera) { canvas.setViewportTransform(canvas.viewportTransform); isDraggingCamera = false; canvas.selection = !isPanMode; canvas.defaultCursor = isPanMode ? 'grab' : 'default'; return; }
    if (isCropMode && isDrawingCrop) { isDrawingCrop = false; cropRect.setCoords(); document.getElementById('btn-apply-crop').style.display = 'block'; canvas.defaultCursor = 'default'; }
});

canvas.on('path:created', function(opt) {
    if (isCloneMode) { opt.path.name = 'Clonación'; updateLayersPanel(); } 
    else if (isLassoMode) {
        const mode = document.getElementById('lasso-mode').value; isMaskProcessing = true; const path = opt.path; canvas.remove(path); path.set({ fill: 'black', stroke: 'transparent' });
        const visibilityMap = new Map(); canvas.getObjects().forEach(obj => { visibilityMap.set(obj, obj.visible); obj.visible = false; });
        lassoTarget.visible = true; canvas.renderAll(); const imgDataUrl = canvas.toDataURL({ format: 'png' });
        lassoTarget.visible = false; path.visible = true; canvas.add(path); canvas.renderAll(); const pathDataUrl = canvas.toDataURL({ format: 'png' }); canvas.remove(path);
        canvas.getObjects().forEach(obj => { obj.visible = visibilityMap.get(obj); }); canvas.renderAll();
        const imgObj = new Image(); imgObj.src = imgDataUrl;
        imgObj.onload = () => {
            const pathObj = new Image(); pathObj.src = pathDataUrl;
            pathObj.onload = () => {
                const tempC = document.createElement('canvas'); tempC.width = canvas.width; tempC.height = canvas.height; const ctx = tempC.getContext('2d');
                ctx.drawImage(imgObj, 0, 0); ctx.globalCompositeOperation = (mode === 'invert') ? 'destination-out' : 'destination-in'; ctx.drawImage(pathObj, 0, 0);
                const finalC = document.createElement('canvas'); finalC.width = canvas.width; finalC.height = canvas.height; finalC.getContext('2d').drawImage(tempC, 0, 0);
                fabric.Image.fromURL(finalC.toDataURL('image/png'), function(finalImg) {
                    finalImg.set({ left: 0, top: 0, name: lassoTarget.name + (mode === 'invert' ? ' (Invertido)' : ' (Recortado)') });
                    canvas.remove(lassoTarget); canvas.add(finalImg); canvas.setActiveObject(finalImg); closeAllTools(); setActiveUI('tool-select'); isMaskProcessing = false; saveHistory();
                });
            };
        };
    }
});


// ==========================================
// 8. FILTROS Y TRANSFORMACIONES
// ==========================================
let activeFilterObject = null;
document.getElementById('tool-filters').addEventListener('click', () => {
    activeFilterObject = canvas.getActiveObject();
    if (!activeFilterObject || activeFilterObject.type !== 'image') return alert('Por favor, selecciona una capa de imagen (foto) para aplicar filtros.');
    closeAllTools(); setActiveUI('tool-filters');
    const filters = activeFilterObject.filters || [];
    document.getElementById('filter-brightness').value = filters[0] ? filters[0].brightness : 0;
    document.getElementById('filter-contrast').value   = filters[1] ? filters[1].contrast : 0;
    document.getElementById('filter-saturation').value = filters[2] ? filters[2].saturation : 0;
    document.getElementById('filter-opacity').value = activeFilterObject.opacity;
    toolFiltersBar.style.display = 'flex';
});
document.getElementById('btn-close-filters').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('btn-reset-filters').addEventListener('click', () => { if(!activeFilterObject) return; activeFilterObject.filters = []; activeFilterObject.applyFilters(); activeFilterObject.set('opacity', 1); canvas.renderAll(); document.getElementById('filter-brightness').value = document.getElementById('filter-contrast').value = document.getElementById('filter-saturation').value = 0; document.getElementById('filter-opacity').value = 1; saveHistory(); });

function applySliderFilter(index, filterClass, prop, value) { if (!activeFilterObject) return; const floatVal = parseFloat(value); if (floatVal === 0) activeFilterObject.filters[index] = null; else { const options = {}; options[prop] = floatVal; activeFilterObject.filters[index] = new fabric.Image.filters[filterClass](options); } activeFilterObject.applyFilters(); canvas.renderAll(); }
document.getElementById('filter-brightness').addEventListener('input', (e) => applySliderFilter(0, 'Brightness', 'brightness', e.target.value)); document.getElementById('filter-contrast').addEventListener('input', (e) => applySliderFilter(1, 'Contrast', 'contrast', e.target.value)); document.getElementById('filter-saturation').addEventListener('input', (e) => applySliderFilter(2, 'Saturation', 'saturation', e.target.value));
document.getElementById('filter-brightness').addEventListener('change', saveHistory); document.getElementById('filter-contrast').addEventListener('change', saveHistory); document.getElementById('filter-saturation').addEventListener('change', saveHistory);

const opacitySlider = document.getElementById('filter-opacity');
opacitySlider.addEventListener('input', (e) => { if (!activeFilterObject) return; activeFilterObject.set('opacity', parseFloat(e.target.value)); canvas.renderAll(); });
opacitySlider.addEventListener('change', saveHistory);

function applyToggleFilter(filterClass) { if (!activeFilterObject) return; const existingIndex = activeFilterObject.filters.findIndex(f => f && f.type === filterClass); if (existingIndex > -1) activeFilterObject.filters[existingIndex] = null; else activeFilterObject.filters.push(new fabric.Image.filters[filterClass]()); activeFilterObject.applyFilters(); canvas.renderAll(); saveHistory(); }
document.getElementById('btn-filter-gray').addEventListener('click', () => applyToggleFilter('Grayscale')); document.getElementById('btn-filter-sepia').addEventListener('click', () => applyToggleFilter('Sepia')); document.getElementById('btn-filter-invert').addEventListener('click', () => applyToggleFilter('Invert'));

document.getElementById('btn-flip-x').addEventListener('click', () => { if (!activeFilterObject) return; activeFilterObject.set('flipX', !activeFilterObject.flipX); canvas.renderAll(); saveHistory(); });
document.getElementById('btn-flip-y').addEventListener('click', () => { if (!activeFilterObject) return; activeFilterObject.set('flipY', !activeFilterObject.flipY); canvas.renderAll(); saveHistory(); });
document.getElementById('btn-rotate-90').addEventListener('click', () => { if (!activeFilterObject) return; activeFilterObject.rotate(activeFilterObject.angle + 90); canvas.renderAll(); saveHistory(); });


// ==========================================
// 9. FORMAS (SHAPES) Y TEXTO
// ==========================================

// --- Formas Geométricas ---
document.getElementById('tool-shapes').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-shapes'); toolShapesBar.style.display = 'flex'; });
document.getElementById('btn-close-shapes').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('shape-fill-type').addEventListener('change', (e) => { document.getElementById('shape-stroke-container').style.display = e.target.value === 'outline' ? 'flex' : 'none'; });

document.getElementById('btn-add-shape').addEventListener('click', () => {
    const type = document.getElementById('shape-type').value;
    const isOutline = document.getElementById('shape-fill-type').value === 'outline';
    const color = document.getElementById('shape-color').value;
    const strokeW = parseInt(document.getElementById('shape-stroke-width').value, 10);

    const options = {
        left: canvas.width / 2, top: canvas.height / 2, originX: 'center', originY: 'center',
        fill: isOutline ? 'transparent' : color, stroke: isOutline ? color : null, strokeWidth: isOutline ? strokeW : 0,
        transparentCorners: false, cornerColor: 'white', cornerStrokeColor: 'black', borderColor: 'white'
    };

    let shape;
    switch(type) {
        case 'square': shape = new fabric.Rect({ ...options, width: 100, height: 100 }); break;
        case 'rectangle': shape = new fabric.Rect({ ...options, width: 150, height: 100 }); break;
        case 'circle': shape = new fabric.Circle({ ...options, radius: 50 }); break;
        case 'triangle': shape = new fabric.Triangle({ ...options, width: 100, height: 100 }); break;
        case 'oval': shape = new fabric.Ellipse({ ...options, rx: 75, ry: 50 }); break;
        case 'semicircle': shape = new fabric.Path('M 0 50 A 50 50 0 0 1 100 50 Z', options); break;
        case 'star': 
            const starPoints = [{x:50,y:0},{x:61,y:35},{x:98,y:35},{x:68,y:57},{x:79,y:91},{x:50,y:70},{x:21,y:91},{x:32,y:57},{x:2,y:35},{x:39,y:35}];
            shape = new fabric.Polygon(starPoints, options); break;
    }
    
    // Traducir nombre para la lista de capas
    const names = { square: 'Cuadrado', rectangle: 'Rectángulo', circle: 'Círculo', triangle: 'Triángulo', oval: 'Óvalo', semicircle: 'Semicírculo', star: 'Estrella' };
    shape.name = `Forma (${names[type]})`;
    
    canvas.add(shape); canvas.setActiveObject(shape); canvas.renderAll();
});

// --- Texto Inteligente ---
document.getElementById('tool-text').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-text'); toolTextBar.style.display = 'flex'; });
document.getElementById('btn-close-text').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('text-fill-type').addEventListener('change', (e) => { document.getElementById('text-stroke-container').style.display = e.target.value === 'outline' ? 'flex' : 'none'; });

document.getElementById('btn-add-text').addEventListener('click', () => {
    const isOutline = document.getElementById('text-fill-type').value === 'outline';
    const color = document.getElementById('text-color').value;
    const strokeW = parseInt(document.getElementById('text-stroke-width').value, 10);

    const options = {
        left: canvas.width / 2, top: canvas.height / 2, originX: 'center', originY: 'center',
        fontFamily: 'sans-serif', fontSize: 60, fontWeight: 'bold',
        fill: isOutline ? 'transparent' : color, stroke: isOutline ? color : null, strokeWidth: isOutline ? strokeW : 0,
        transparentCorners: false, cornerColor: 'white', cornerStrokeColor: 'black', borderColor: 'white',
        name: 'Texto'
    };

    const text = new fabric.IText('Doble clic para editar', options);
    canvas.add(text); canvas.setActiveObject(text); canvas.renderAll();
});


// ==========================================
// 10. IA DE BORRADO DE FONDO Y GUÍAS MAGNÉTICAS
// ==========================================
document.getElementById('tool-ai').addEventListener('click', async () => {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'image') return alert("Selecciona una foto primero.");
    if (!window.confirm("La IA procesará la imagen (la primera vez descargará el modelo, lo cual tarda un poco). ¿Continuar?")) return;

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

const snapZone = 15; let verticalGuide = null; let horizontalGuide = null;
canvas.on('object:moving', function(options) {
    const obj = options.target; verticalGuide = null; horizontalGuide = null;
    const canvasWidth = canvas.width; const canvasHeight = canvas.height;
    const snapPointsX = [0, canvasWidth / 2, canvasWidth]; const snapPointsY = [0, canvasHeight / 2, canvasHeight];
    const objW = obj.getScaledWidth(); const objH = obj.getScaledHeight();
    let objLeft, objCenterX, objRight, objTop, objCenterY, objBottom;

    if (obj.originX === 'center') { objCenterX = obj.left; objLeft = obj.left - objW / 2; objRight = obj.left + objW / 2; } 
    else { objLeft = obj.left; objCenterX = obj.left + objW / 2; objRight = obj.left + objW; }
    if (obj.originY === 'center') { objCenterY = obj.top; objTop = obj.top - objH / 2; objBottom = obj.top + objH / 2; } 
    else { objTop = obj.top; objCenterY = obj.top + objH / 2; objBottom = obj.top + objH; }

    let snappedX = false;
    for (let targetX of snapPointsX) {
        if (!snappedX && Math.abs(targetX - objCenterX) < snapZone) { obj.set('left', obj.originX === 'center' ? targetX : targetX - objW/2); verticalGuide = targetX; snappedX = true; }
        if (!snappedX && Math.abs(targetX - objLeft) < snapZone) { obj.set('left', obj.originX === 'center' ? targetX + objW/2 : targetX); verticalGuide = targetX; snappedX = true; }
        if (!snappedX && Math.abs(targetX - objRight) < snapZone) { obj.set('left', obj.originX === 'center' ? targetX - objW/2 : targetX - objW); verticalGuide = targetX; snappedX = true; }
    }

    let snappedY = false;
    for (let targetY of snapPointsY) {
        if (!snappedY && Math.abs(targetY - objCenterY) < snapZone) { obj.set('top', obj.originY === 'center' ? targetY : targetY - objH/2); horizontalGuide = targetY; snappedY = true; }
        if (!snappedY && Math.abs(targetY - objTop) < snapZone) { obj.set('top', obj.originY === 'center' ? targetY + objH/2 : targetY); horizontalGuide = targetY; snappedY = true; }
        if (!snappedY && Math.abs(targetY - objBottom) < snapZone) { obj.set('top', obj.originY === 'center' ? targetY - objH/2 : targetY - objH); horizontalGuide = targetY; snappedY = true; }
    }
});

canvas.on('mouse:up', function() { verticalGuide = null; horizontalGuide = null; canvas.renderAll(); });
canvas.on('after:render', function() {
    if (verticalGuide !== null || horizontalGuide !== null) {
        const ctx = canvas.contextContainer; ctx.save();
        ctx.strokeStyle = '#00bfff'; ctx.lineWidth = 1; ctx.setTransform(1, 0, 0, 1, 0, 0); 
        const vpt = canvas.viewportTransform;
        if (verticalGuide !== null) { const drawX = verticalGuide * vpt[0] + vpt[4]; ctx.beginPath(); ctx.moveTo(drawX, 0); ctx.lineTo(drawX, canvas.height * vpt[3] + vpt[5]); ctx.stroke(); }
        if (horizontalGuide !== null) { const drawY = horizontalGuide * vpt[3] + vpt[5]; ctx.beginPath(); ctx.moveTo(0, drawY); ctx.lineTo(canvas.width * vpt[0] + vpt[4], drawY); ctx.stroke(); }
        ctx.restore();
    }
});


// ARRANQUE
saveHistory();