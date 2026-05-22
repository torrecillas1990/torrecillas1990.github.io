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
// 5. ARCHIVOS Y EVENTOS
// ==========================================
function addImageToCanvas(file) {
    if (!file.type.match('image.*')) return alert('Imagen no válida.');
    const reader = new FileReader();
    reader.onload = function(event) {
        const imgObj = new Image(); imgObj.src = event.target.result;
        imgObj.onload = function() {
            const fabricImg = new fabric.Image(imgObj);
            const scale = Math.min((canvas.width * 0.9) / fabricImg.width, (canvas.height * 0.9) / fabricImg.height, 1);
            fabricImg.scale(scale); fabricImg.set({ left: canvas.width / 2, top: canvas.height / 2, originX: 'center', originY: 'center' });
            canvas.add(fabricImg); canvas.setActiveObject(fabricImg); canvas.renderAll();
        }
    }; reader.readAsDataURL(file);
}
document.getElementById('btnUpload').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('btnUndo').addEventListener('click', undo); document.getElementById('btnRedo').addEventListener('click', redo);
document.getElementById('fileInput').addEventListener('change', function(e) { if (e.target.files[0]) { addImageToCanvas(e.target.files[0]); this.value = ''; } });

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
// HERRAMIENTAS: CLONAR, RECORTE, LAZO
// ==========================================
let isCloneMode = false, isCropMode = false, isLassoMode = false;
let cloneSource = { x: 0, y: 0 }, cloneImageSnapshot = null, cloneDeltaX = 0, cloneDeltaY = 0, isCloneDeltaSet = false, isSettingCloneSource = false, myCloneBrush = null;
let cropRect = null, cropOrigX = 0, cropOrigY = 0, isDrawingCrop = false;
let lassoTarget = null;
const toolOptionsBar = document.getElementById('tool-options-bar');
const toolCropBar = document.getElementById('tool-crop-bar');
const toolLassoBar = document.getElementById('tool-lasso-bar');
const toolFiltersBar = document.getElementById('tool-filters-bar');

function closeAllTools() {
    isCloneMode = isCropMode = isLassoMode = false;
    canvas.isDrawingMode = false; canvas.selection = true; canvas.defaultCursor = 'default';
    toolOptionsBar.style.display = toolCropBar.style.display = toolLassoBar.style.display = toolFiltersBar.style.display = 'none';
    if(cropRect) { canvas.remove(cropRect); cropRect = null; }
    canvas.getObjects().forEach(o => { o.selectable = true; o.evented = true; });
    document.getElementById('panel-tools').classList.remove('open');
    canvas.renderAll();
}

// Clonar
document.getElementById('tool-clone').addEventListener('click', () => {
    closeAllTools(); canvas.discardActiveObject(); isCloneMode = true; isSettingCloneSource = true; isCloneDeltaSet = false;
    toolOptionsBar.style.display = 'flex'; document.getElementById('clone-status').innerText = '🎯 Fija el Origen'; canvas.defaultCursor = 'crosshair';
});
document.getElementById('btn-reset-clone').addEventListener('click', () => { isSettingCloneSource = true; isCloneDeltaSet = false; canvas.isDrawingMode = false; canvas.defaultCursor = 'crosshair'; document.getElementById('clone-status').innerText = '🎯 Fija el Origen'; });
document.getElementById('btn-close-tool').addEventListener('click', closeAllTools);
document.getElementById('clone-size').addEventListener('input', e => { if (myCloneBrush) myCloneBrush.width = parseInt(e.target.value, 10); });

// Recorte Lienzo
document.getElementById('tool-crop').addEventListener('click', () => {
    closeAllTools(); canvas.discardActiveObject(); isCropMode = true; canvas.selection = false; canvas.defaultCursor = 'crosshair';
    canvas.getObjects().forEach(o => { o.selectable = false; o.evented = false; });
    toolCropBar.style.display = 'flex'; document.getElementById('btn-apply-crop').style.display = 'none'; 
});
document.getElementById('btn-cancel-crop').addEventListener('click', closeAllTools);
document.getElementById('btn-apply-crop').addEventListener('click', () => {
    if (!cropRect) return; const bound = cropRect.getBoundingRect(); canvas.remove(cropRect);
    canvas.getObjects().forEach(obj => { obj.set({ left: obj.left - bound.left, top: obj.top - bound.top }); obj.setCoords(); });
    canvas.setWidth(bound.width); canvas.setHeight(bound.height); cropRect = null;
    closeAllTools(); updateLayersPanel(); saveHistory();
});

// Lazo
document.getElementById('tool-lasso').addEventListener('click', () => {
    lassoTarget = canvas.getActiveObject();
    if (!lassoTarget) return alert('Por favor, selecciona primero la capa a recortar.');
    closeAllTools(); isLassoMode = true; canvas.isDrawingMode = true;
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas); canvas.freeDrawingBrush.color = 'rgba(0,191,255,0.7)'; canvas.freeDrawingBrush.width = 4;
    toolLassoBar.style.display = 'flex';
});
document.getElementById('btn-cancel-lasso').addEventListener('click', closeAllTools);

// ==========================================
// LÓGICA DE RATÓN (Clonar, Lazo, Crop)
// ==========================================
canvas.on('mouse:down', function(opt) {
    if (isCloneMode && isSettingCloneSource) {
        const pointer = canvas.getPointer(opt.e); cloneSource = { x: pointer.x, y: pointer.y }; isSettingCloneSource = false;
        const img = new Image(); img.src = canvas.toDataURL({ format: 'png', multiplier: 1 });
        img.onload = () => {
            cloneImageSnapshot = img; document.getElementById('clone-status').innerText = '🖌️ Pintando...'; canvas.defaultCursor = 'default';
            if (!myCloneBrush) {
                myCloneBrush = new fabric.PatternBrush(canvas);
                const originalDown = myCloneBrush.onMouseDown.bind(myCloneBrush);
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
    if (isCropMode && !cropRect) {
        isDrawingCrop = true; const pointer = canvas.getPointer(opt.e); cropOrigX = pointer.x; cropOrigY = pointer.y;
        cropRect = new fabric.Rect({ left: cropOrigX, top: cropOrigY, width: 0, height: 0, fill: 'rgba(0,191,255,0.2)', stroke: '#00bfff', strokeWidth: 2, strokeDashArray: [5,5], hasRotatingPoint: false, name: 'CropOverlay' });
        canvas.add(cropRect); canvas.setActiveObject(cropRect);
    }
});
canvas.on('mouse:move', function(opt) {
    if (!isCropMode || !isDrawingCrop || !cropRect) return;
    const pointer = canvas.getPointer(opt.e); const w = pointer.x - cropOrigX; const h = pointer.y - cropOrigY;
    cropRect.set({ left: w < 0 ? pointer.x : cropOrigX, top: h < 0 ? pointer.y : cropOrigY, width: Math.abs(w), height: Math.abs(h) }); canvas.renderAll();
});
canvas.on('mouse:up', function() {
    if (isCropMode && isDrawingCrop) { isDrawingCrop = false; cropRect.setCoords(); document.getElementById('btn-apply-crop').style.display = 'block'; canvas.defaultCursor = 'default'; }
});
canvas.on('path:created', function(opt) {
    if (isCloneMode) { opt.path.name = 'Clonación'; updateLayersPanel(); } 
    else if (isLassoMode) {
        isMaskProcessing = true; const path = opt.path; canvas.remove(path); path.set({ fill: 'black', stroke: 'transparent' });
        const visibilityMap = new Map(); canvas.getObjects().forEach(obj => { visibilityMap.set(obj, obj.visible); obj.visible = false; });
        lassoTarget.visible = true; canvas.renderAll(); const imgDataUrl = canvas.toDataURL({ format: 'png' });
        lassoTarget.visible = false; path.visible = true; canvas.add(path); canvas.renderAll(); const pathDataUrl = canvas.toDataURL({ format: 'png' }); canvas.remove(path);
        canvas.getObjects().forEach(obj => { obj.visible = visibilityMap.get(obj); }); canvas.renderAll();
        const imgObj = new Image(); imgObj.src = imgDataUrl;
        imgObj.onload = () => {
            const pathObj = new Image(); pathObj.src = pathDataUrl;
            pathObj.onload = () => {
                const tempC = document.createElement('canvas'); tempC.width = canvas.width; tempC.height = canvas.height; const ctx = tempC.getContext('2d');
                ctx.drawImage(imgObj, 0, 0); ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(pathObj, 0, 0);
                const rect = path.getBoundingRect(); const padding = 2; const cx = Math.max(0, rect.left - padding); const cy = Math.max(0, rect.top - padding); const cw = Math.min(canvas.width - cx, rect.width + padding * 2); const ch = Math.min(canvas.height - cy, rect.height + padding * 2);
                const finalC = document.createElement('canvas'); finalC.width = cw; finalC.height = ch; finalC.getContext('2d').drawImage(tempC, cx, cy, cw, ch, 0, 0, cw, ch);
                fabric.Image.fromURL(finalC.toDataURL('image/png'), function(finalImg) {
                    finalImg.set({ left: cx, top: cy, originX: 'left', originY: 'top', name: lassoTarget.name + ' (Cortado)' });
                    canvas.remove(lassoTarget); canvas.add(finalImg); canvas.setActiveObject(finalImg); closeAllTools(); isMaskProcessing = false; saveHistory();
                });
            };
        };
    }
});


// ==========================================
// 10. HERRAMIENTA: FILTROS Y AJUSTES
// ==========================================
let activeFilterObject = null;

document.getElementById('tool-filters').addEventListener('click', () => {
    activeFilterObject = canvas.getActiveObject();
    if (!activeFilterObject || activeFilterObject.type !== 'image') {
        return alert('Por favor, selecciona una capa de imagen (foto) para aplicar filtros.');
    }
    closeAllTools();
    
    // Rellenar sliders con los valores actuales si la imagen ya tiene filtros
    const filters = activeFilterObject.filters || [];
    document.getElementById('filter-brightness').value = filters[0] ? filters[0].brightness : 0;
    document.getElementById('filter-contrast').value   = filters[1] ? filters[1].contrast : 0;
    document.getElementById('filter-saturation').value = filters[2] ? filters[2].saturation : 0;
    
    toolFiltersBar.style.display = 'flex';
});

document.getElementById('btn-close-filters').addEventListener('click', closeAllTools);

// Reseteo total
document.getElementById('btn-reset-filters').addEventListener('click', () => {
    if(!activeFilterObject) return;
    activeFilterObject.filters = [];
    activeFilterObject.applyFilters();
    canvas.renderAll();
    document.getElementById('filter-brightness').value = 0;
    document.getElementById('filter-contrast').value = 0;
    document.getElementById('filter-saturation').value = 0;
    saveHistory();
});

// Función para aplicar filtros de slider (Brillo, Contraste, Saturación)
function applySliderFilter(index, filterClass, prop, value) {
    if (!activeFilterObject) return;
    const floatVal = parseFloat(value);
    
    // Si el valor es 0, desactivamos ese filtro para no consumir memoria gráfica
    if (floatVal === 0) {
        activeFilterObject.filters[index] = null;
    } else {
        const options = {};
        options[prop] = floatVal;
        activeFilterObject.filters[index] = new fabric.Image.filters[filterClass](options);
    }
    
    activeFilterObject.applyFilters();
    canvas.renderAll();
}

// Evento INPUT (Muestra el cambio en vivo mientras mueves el slider)
document.getElementById('filter-brightness').addEventListener('input', (e) => applySliderFilter(0, 'Brightness', 'brightness', e.target.value));
document.getElementById('filter-contrast').addEventListener('input', (e) => applySliderFilter(1, 'Contrast', 'contrast', e.target.value));
document.getElementById('filter-saturation').addEventListener('input', (e) => applySliderFilter(2, 'Saturation', 'saturation', e.target.value));

// Evento CHANGE (Guarda en la Máquina del Tiempo solo cuando sueltas el slider)
document.getElementById('filter-brightness').addEventListener('change', saveHistory);
document.getElementById('filter-contrast').addEventListener('change', saveHistory);
document.getElementById('filter-saturation').addEventListener('change', saveHistory);

// Función para filtros de botón on/off
function applyToggleFilter(filterClass) {
    if (!activeFilterObject) return;
    // Miramos si la imagen ya tiene este filtro activo (en un índice mayor que 2)
    const existingIndex = activeFilterObject.filters.findIndex(f => f && f.type === filterClass);
    if (existingIndex > -1) {
        activeFilterObject.filters[existingIndex] = null; // Quitarlo
    } else {
        activeFilterObject.filters.push(new fabric.Image.filters[filterClass]()); // Añadirlo al final
    }
    activeFilterObject.applyFilters();
    canvas.renderAll();
    saveHistory();
}

document.getElementById('btn-filter-gray').addEventListener('click', () => applyToggleFilter('Grayscale'));
document.getElementById('btn-filter-sepia').addEventListener('click', () => applyToggleFilter('Sepia'));
document.getElementById('btn-filter-invert').addEventListener('click', () => applyToggleFilter('Invert'));


// ==========================================
// ARRANQUE: Añadir Capa Base Inicial
// ==========================================
const rectBase = new fabric.Rect({
    name: 'Capa Base', left: canvas.width / 2 - 100, top: canvas.height / 2 - 100, 
    fill: '#a8d8ea', width: 200, height: 200, cornerColor: 'white', cornerStrokeColor: 'black', borderColor: 'white', transparentCorners: false
});
canvas.add(rectBase); canvas.setActiveObject(rectBase);