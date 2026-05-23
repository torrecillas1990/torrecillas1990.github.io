// ==========================================
// 1. CONFIGURACIÓN BASE Y PANELES COLAPSABLES
// ==========================================
if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.error(e))); }
const panelTools = document.getElementById('panel-tools'); const panelLayers = document.getElementById('panel-layers');
document.getElementById('btnToggleTools').addEventListener('click', () => { panelTools.classList.toggle('open'); /*panelLayers.classList.remove('open');*/ });
document.getElementById('btnCloseTools').addEventListener('click', () => panelTools.classList.remove('open'));
document.getElementById('btnToggleLayers').addEventListener('click', () => { panelLayers.classList.toggle('open'); /*panelTools.classList.remove('open');*/ });
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
// 5. ARCHIVOS Y EVENTOS DE TECLADO
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
// 6. HERRAMIENTAS ACTIVAS Y UI ESTADO
// ==========================================
let isPanMode = false, isCloneMode = false, isCropMode = false, isLassoMode = false;
let cloneSource = { x: 0, y: 0 }, cloneImageSnapshot = null, cloneDeltaX = 0, cloneDeltaY = 0, isCloneDeltaSet = false, isSettingCloneSource = false, myCloneBrush = null;
let cropRect = null, cropOrigX = 0, cropOrigY = 0, isDrawingCrop = false;
let lassoTarget = null;

const toolOptionsBar = document.getElementById('tool-options-bar');
const toolCropBar = document.getElementById('tool-crop-bar');
const toolLassoBar = document.getElementById('tool-lasso-bar');
const toolFiltersBar = document.getElementById('tool-filters-bar');

function setActiveUI(id) {
    document.querySelectorAll('.tool-item').forEach(el => el.classList.remove('active'));
    if(id) document.getElementById(id).classList.add('active');
}

function closeAllTools() {
    isPanMode = isCloneMode = isCropMode = isLassoMode = false;
    canvas.isDrawingMode = false; canvas.selection = true; canvas.defaultCursor = 'default';
    toolOptionsBar.style.display = toolCropBar.style.display = toolLassoBar.style.display = toolFiltersBar.style.display = 'none';
    if(cropRect) { canvas.remove(cropRect); cropRect = null; }
    canvas.getObjects().forEach(o => { o.selectable = true; o.evented = true; });
    document.getElementById('panel-tools').classList.remove('open');
    canvas.renderAll();
}

// Botones de Herramienta
document.getElementById('tool-select').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('tool-pan').addEventListener('click', () => { closeAllTools(); isPanMode = true; canvas.selection = false; canvas.defaultCursor = 'grab'; setActiveUI('tool-pan'); });

document.getElementById('tool-clone').addEventListener('click', () => {
    closeAllTools(); setActiveUI('tool-clone');
    canvas.discardActiveObject(); isCloneMode = true; isSettingCloneSource = true; isCloneDeltaSet = false;
    toolOptionsBar.style.display = 'flex'; document.getElementById('clone-status').innerText = '🎯 Fija el Origen'; canvas.defaultCursor = 'crosshair';
});
document.getElementById('btn-reset-clone').addEventListener('click', () => { isSettingCloneSource = true; isCloneDeltaSet = false; canvas.isDrawingMode = false; canvas.defaultCursor = 'crosshair'; document.getElementById('clone-status').innerText = '🎯 Fija el Origen'; });
document.getElementById('btn-close-tool').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('clone-size').addEventListener('input', e => { if (myCloneBrush) myCloneBrush.width = parseInt(e.target.value, 10); });

document.getElementById('tool-crop').addEventListener('click', () => {
    closeAllTools(); setActiveUI('tool-crop');
    canvas.discardActiveObject(); isCropMode = true; canvas.selection = false; canvas.defaultCursor = 'crosshair';
    canvas.getObjects().forEach(o => { o.selectable = false; o.evented = false; });
    toolCropBar.style.display = 'flex'; document.getElementById('btn-apply-crop').style.display = 'none'; 
});
document.getElementById('btn-cancel-crop').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('btn-apply-crop').addEventListener('click', () => {
    if (!cropRect) return; const bound = cropRect.getBoundingRect(); canvas.remove(cropRect);
    canvas.getObjects().forEach(obj => { obj.set({ left: obj.left - bound.left, top: obj.top - bound.top }); obj.setCoords(); });
    canvas.setWidth(bound.width); canvas.setHeight(bound.height); cropRect = null;
    closeAllTools(); setActiveUI('tool-select'); updateLayersPanel(); saveHistory();
});

document.getElementById('tool-lasso').addEventListener('click', () => {
    lassoTarget = canvas.getActiveObject();
    if (!lassoTarget) return alert('Por favor, selecciona primero la capa a recortar.');
    closeAllTools(); setActiveUI('tool-lasso');
    isLassoMode = true; canvas.isDrawingMode = true;
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas); canvas.freeDrawingBrush.color = 'rgba(0,191,255,0.7)'; canvas.freeDrawingBrush.width = 4;
    toolLassoBar.style.display = 'flex';
});
document.getElementById('btn-cancel-lasso').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });


// ==========================================
// 7. MOTOR DE CÁMARA (ZOOM Y PAN) Y LÓGICA DE RATÓN
// ==========================================

// ==========================================
// A. CÁMARA: PAN (Arrastrar) y ZOOM (Rueda)
// ==========================================

// Resetear Cámara
document.getElementById('btnResetView').addEventListener('click', () => {
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.renderAll();
});

// Zoom con Rueda
canvas.on('mouse:wheel', function(opt) {
    var delta = opt.e.deltaY;
    var zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;
    if (zoom > 20) zoom = 20;
    if (zoom < 0.1) zoom = 0.1;
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    opt.e.preventDefault();
    opt.e.stopPropagation();
});

// Paneo con Alt + Click
let isDraggingCamera = false;
let lastPosX = 0, lastPosY = 0;

canvas.on('mouse:down', function(opt) {
    if (opt.e.altKey === true || isPanMode) {
        isDraggingCamera = true;
        canvas.selection = false;
        lastPosX = opt.e.clientX;
        lastPosY = opt.e.clientY;
        canvas.defaultCursor = 'grabbing';
        return;
    }
	
    // 1. PRIORIDAD: PAN Y ZOOM (Alt pulsado o herramienta Mano seleccionada)
    if (opt.e.altKey === true || isPanMode) {
        isDraggingCamera = true;
        canvas.selection = false;
        lastPosX = opt.e.clientX || (opt.e.touches && opt.e.touches[0].clientX);
        lastPosY = opt.e.clientY || (opt.e.touches && opt.e.touches[0].clientY);
        canvas.defaultCursor = 'grabbing';
        return; // Salir de la función para no disparar Lazo ni Clonar
    }

    // 2. Herramienta: Clonar
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
    
    // 3. Herramienta: Recorte
    if (isCropMode && !cropRect) {
        isDrawingCrop = true; const pointer = canvas.getPointer(opt.e); cropOrigX = pointer.x; cropOrigY = pointer.y;
        cropRect = new fabric.Rect({ left: cropOrigX, top: cropOrigY, width: 0, height: 0, fill: 'rgba(0,191,255,0.2)', stroke: '#00bfff', strokeWidth: 2, strokeDashArray: [5,5], hasRotatingPoint: false, name: 'CropOverlay' });
        canvas.add(cropRect); canvas.setActiveObject(cropRect);
    }
});

canvas.on('mouse:move', function(opt) {
    if (isDraggingCamera) {
        let e = opt.e;
        let vpt = canvas.viewportTransform;
        vpt[4] += e.clientX - lastPosX;
        vpt[5] += e.clientY - lastPosY;
        canvas.requestRenderAll();
        lastPosX = e.clientX;
        lastPosY = e.clientY;
        return;
    }
	
    // 1. Arrastrando Cámara
    if (isDraggingCamera) {
        let e = opt.e;
        let clientX = e.clientX || (e.touches && e.touches[0].clientX);
        let clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        let vpt = canvas.viewportTransform;
        vpt[4] += clientX - lastPosX;
        vpt[5] += clientY - lastPosY;
        canvas.requestRenderAll();
        
        lastPosX = clientX; lastPosY = clientY;
        return;
    }

    // 2. Dibujando Cuadro de Recorte
    if (!isCropMode || !isDrawingCrop || !cropRect) return;
    const pointer = canvas.getPointer(opt.e); const w = pointer.x - cropOrigX; const h = pointer.y - cropOrigY;
    cropRect.set({ left: w < 0 ? pointer.x : cropOrigX, top: h < 0 ? pointer.y : cropOrigY, width: Math.abs(w), height: Math.abs(h) }); canvas.renderAll();
});

canvas.on('mouse:up', function() {
    if (isDraggingCamera) {
        canvas.setViewportTransform(canvas.viewportTransform);
        isDraggingCamera = false;
        canvas.selection = !isPanMode;
        canvas.defaultCursor = isPanMode ? 'grab' : 'default';
        return;
    }
	
    // 1. Soltar Cámara
    if (isDraggingCamera) {
        canvas.setViewportTransform(canvas.viewportTransform);
        isDraggingCamera = false;
        if (!isPanMode) {
            canvas.selection = true; canvas.defaultCursor = 'default';
        } else {
            canvas.defaultCursor = 'grab'; // Si la herramienta de mano sigue activa
        }
        return;
    }

    // 2. Soltar Cuadro de Recorte
    if (isCropMode && isDrawingCrop) { isDrawingCrop = false; cropRect.setCoords(); document.getElementById('btn-apply-crop').style.display = 'block'; canvas.defaultCursor = 'default'; }
});

// ==========================================
// B. TRANSFORMACIONES (Voltear/Rotar)
// ==========================================

document.getElementById('btn-flip-x').addEventListener('click', () => {
    if (!activeFilterObject) return;
    activeFilterObject.set('flipX', !activeFilterObject.flipX);
    canvas.renderAll(); saveHistory();
});

document.getElementById('btn-flip-y').addEventListener('click', () => {
    if (!activeFilterObject) return;
    activeFilterObject.set('flipY', !activeFilterObject.flipY);
    canvas.renderAll(); saveHistory();
});

document.getElementById('btn-rotate-90').addEventListener('click', () => {
    if (!activeFilterObject) return;
    activeFilterObject.rotate(activeFilterObject.angle + 90);
    canvas.renderAll(); saveHistory();
});

// Finalización de Trazos
// ... dentro de app.js, busca el evento 'path:created' y reemplaza la lógica de isLassoMode:

canvas.on('path:created', function(opt) {
    if (isCloneMode) { 
        opt.path.name = 'Clonación'; updateLayersPanel(); 
    } 
    else if (isLassoMode) {
        const mode = document.getElementById('lasso-mode').value; // 'keep' o 'invert'
        isMaskProcessing = true; 
        const path = opt.path; 
        canvas.remove(path); 
        path.set({ fill: 'black', stroke: 'transparent' });
        
        const visibilityMap = new Map(); 
        canvas.getObjects().forEach(obj => { visibilityMap.set(obj, obj.visible); obj.visible = false; });
        lassoTarget.visible = true; 
        canvas.renderAll(); 
        const imgDataUrl = canvas.toDataURL({ format: 'png' });
        
        lassoTarget.visible = false; 
        path.visible = true; 
        canvas.add(path); 
        canvas.renderAll(); 
        const pathDataUrl = canvas.toDataURL({ format: 'png' }); 
        canvas.remove(path);

        canvas.getObjects().forEach(obj => { obj.visible = visibilityMap.get(obj); }); 
        canvas.renderAll();
        
        const imgObj = new Image(); imgObj.src = imgDataUrl;
        imgObj.onload = () => {
            const pathObj = new Image(); pathObj.src = pathDataUrl;
            pathObj.onload = () => {
                const tempC = document.createElement('canvas'); 
                tempC.width = canvas.width; tempC.height = canvas.height; 
                const ctx = tempC.getContext('2d');

                // Lógica de inversión
                ctx.drawImage(imgObj, 0, 0);
                
                // Si el modo es INVERTIR, usamos 'destination-out' para borrar la zona dibujada
                // Si es MANTENER, usamos 'destination-in' para quedarnos solo con la zona
                ctx.globalCompositeOperation = (mode === 'invert') ? 'destination-out' : 'destination-in';
                ctx.drawImage(pathObj, 0, 0);

                // --- Generar capa final ---
                const finalC = document.createElement('canvas');
                finalC.width = canvas.width; finalC.height = canvas.height;
                finalC.getContext('2d').drawImage(tempC, 0, 0);

                fabric.Image.fromURL(finalC.toDataURL('image/png'), function(finalImg) {
                    finalImg.set({ 
                        left: 0, top: 0, 
                        name: lassoTarget.name + (mode === 'invert' ? ' (Invertido)' : ' (Recortado)') 
                    });
                    
                    canvas.remove(lassoTarget); 
                    canvas.add(finalImg); 
                    canvas.setActiveObject(finalImg); 
                    exitLassoMode();
                    updateLayersPanel();
                    isMaskProcessing = false; 
                    saveHistory();
                });
            };
        };
    }
});


// ==========================================
// 8. FILTROS
// ==========================================
let activeFilterObject = null;
// A. Al abrir el panel, lee la opacidad actual
document.getElementById('tool-filters').addEventListener('click', () => {
    activeFilterObject = canvas.getActiveObject();
    if (!activeFilterObject || activeFilterObject.type !== 'image') {
        return alert('Por favor, selecciona una capa de imagen (foto) para aplicar filtros.');
    }
    closeAllTools();
    
    // Rellenar sliders
    const filters = activeFilterObject.filters || [];
    document.getElementById('filter-brightness').value = filters[0] ? filters[0].brightness : 0;
    document.getElementById('filter-contrast').value   = filters[1] ? filters[1].contrast : 0;
    document.getElementById('filter-saturation').value = filters[2] ? filters[2].saturation : 0;
    
    // NUEVO: Cargar opacidad actual
    document.getElementById('filter-opacity').value = activeFilterObject.opacity;
    
    toolFiltersBar.style.display = 'flex';
});

// B. Lógica de cambio de opacidad
const opacitySlider = document.getElementById('filter-opacity');

opacitySlider.addEventListener('input', (e) => {
    if (!activeFilterObject) return;
    activeFilterObject.set('opacity', parseFloat(e.target.value));
    canvas.renderAll();
});

// C. Registrar en historial al soltar el slider
opacitySlider.addEventListener('change', saveHistory);

// D. Asegúrate de que el botón de reseteo también devuelva la opacidad a 1
document.getElementById('btn-reset-filters').addEventListener('click', () => {
    if(!activeFilterObject) return;
    activeFilterObject.filters = [];
    activeFilterObject.applyFilters();
    activeFilterObject.set('opacity', 1); // Reset a opacidad total
    canvas.renderAll();
    document.getElementById('filter-brightness').value = 0;
    document.getElementById('filter-contrast').value = 0;
    document.getElementById('filter-saturation').value = 0;
    document.getElementById('filter-opacity').value = 1;
    saveHistory();
});
document.getElementById('btn-close-filters').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('btn-reset-filters').addEventListener('click', () => {
    if(!activeFilterObject) return; activeFilterObject.filters = []; activeFilterObject.applyFilters(); canvas.renderAll();
    document.getElementById('filter-brightness').value = document.getElementById('filter-contrast').value = document.getElementById('filter-saturation').value = 0; saveHistory();
});
function applySliderFilter(index, filterClass, prop, value) {
    if (!activeFilterObject) return; const floatVal = parseFloat(value);
    if (floatVal === 0) activeFilterObject.filters[index] = null; else { const options = {}; options[prop] = floatVal; activeFilterObject.filters[index] = new fabric.Image.filters[filterClass](options); }
    activeFilterObject.applyFilters(); canvas.renderAll();
}
document.getElementById('filter-brightness').addEventListener('input', (e) => applySliderFilter(0, 'Brightness', 'brightness', e.target.value));
document.getElementById('filter-contrast').addEventListener('input', (e) => applySliderFilter(1, 'Contrast', 'contrast', e.target.value));
document.getElementById('filter-saturation').addEventListener('input', (e) => applySliderFilter(2, 'Saturation', 'saturation', e.target.value));
document.getElementById('filter-brightness').addEventListener('change', saveHistory); document.getElementById('filter-contrast').addEventListener('change', saveHistory); document.getElementById('filter-saturation').addEventListener('change', saveHistory);

function applyToggleFilter(filterClass) {
    if (!activeFilterObject) return; const existingIndex = activeFilterObject.filters.findIndex(f => f && f.type === filterClass);
    if (existingIndex > -1) activeFilterObject.filters[existingIndex] = null; else activeFilterObject.filters.push(new fabric.Image.filters[filterClass]());
    activeFilterObject.applyFilters(); canvas.renderAll(); saveHistory();
}
document.getElementById('btn-filter-gray').addEventListener('click', () => applyToggleFilter('Grayscale'));
document.getElementById('btn-filter-sepia').addEventListener('click', () => applyToggleFilter('Sepia'));
document.getElementById('btn-filter-invert').addEventListener('click', () => applyToggleFilter('Invert'));

// ==========================================
// 12. HERRAMIENTA: EXPORTACIÓN
// ==========================================

function exportCanvas(format) {
    // 1. Guardar estado actual de la cámara
    const originalVpt = canvas.viewportTransform;
    const originalZoom = canvas.getZoom();

    // 2. Resetear vista para exportar todo el lienzo correctamente
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    
    // 3. Generar la imagen
    const dataURL = canvas.toDataURL({
        format: format,
        quality: 1.0, // Calidad máxima
        multiplier: 2 // Exportar al doble de tamaño para más nitidez (opcional)
    });

    // 4. Crear un enlace temporal para la descarga
    const link = document.createElement('a');
    link.download = `proyecto-foto-${new Date().getTime()}.${format}`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 5. Restaurar vista del usuario
    canvas.setViewportTransform(originalVpt);
    canvas.setZoom(originalZoom);
    canvas.renderAll();
}

// Conectar botones
document.getElementById('btnExportPNG').addEventListener('click', () => exportCanvas('png'));
document.getElementById('btnExportJPG').addEventListener('click', () => exportCanvas('jpeg'));

// ==========================================
// 13. HERRAMIENTA: BORRADO DE FONDO (IA OFFLINE)
// ==========================================

async function runBackgroundRemoval(imgElement) {
    // 1. Cargamos el pipeline (se cachea automáticamente por el navegador)
    const segmenter = await window.transformers.pipeline('image-segmentation', 'briaai/RMBG-1.4');
    
    // 2. Ejecutar segmentación
    const output = await segmenter(imgElement.src);
    
    // 3. Crear máscara
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = imgElement.naturalWidth;
    maskCanvas.height = imgElement.naturalHeight;
    const ctx = maskCanvas.getContext('2d');
    ctx.drawImage(output, 0, 0);

    // 4. Fusionar (Imagen Original + Máscara)
    const finalC = document.createElement('canvas');
    finalC.width = imgElement.naturalWidth;
    finalC.height = imgElement.naturalHeight;
    const fCtx = finalC.getContext('2d');
    
    fCtx.drawImage(imgElement, 0, 0);
    fCtx.globalCompositeOperation = 'destination-in';
    fCtx.drawImage(maskCanvas, 0, 0);

    return finalC.toDataURL('image/png');
}

// Botón de IA en el panel de herramientas
document.getElementById('tool-ai').addEventListener('click', async () => {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'image') {
        return alert("Selecciona una capa de imagen (foto) primero.");
    }

    const confirm = window.confirm("La IA procesará la imagen (primera vez puede tardar un poco). ¿Continuar?");
    if (!confirm) return;

    // Bloqueo de UI mientras trabaja
    isMaskProcessing = true; 
    document.body.style.cursor = 'wait';
    alert("IA trabajando... Por favor, espera unos segundos.");

    const imgEl = new Image();
    imgEl.src = activeObj.toDataURL();
    
    imgEl.onload = async () => {
        try {
            const resultDataUrl = await runBackgroundRemoval(imgEl);
            
            // Reemplazar capa
            fabric.Image.fromURL(resultDataUrl, (newImg) => {
                newImg.set({
                    left: activeObj.left, top: activeObj.top,
                    scaleX: activeObj.scaleX, scaleY: activeObj.scaleY,
                    name: activeObj.name + " (Sin Fondo)"
                });
                canvas.remove(activeObj);
                canvas.add(newImg);
                canvas.setActiveObject(newImg);
                canvas.renderAll();
                
                isMaskProcessing = false;
                document.body.style.cursor = 'default';
                saveHistory();
                updateLayersPanel();
            });
        } catch (err) {
            alert("Error al procesar la IA: " + err.message);
            isMaskProcessing = false;
            document.body.style.cursor = 'default';
        }
    };
});

// Helper para encontrar el botón por texto (pequeño parche para el querySelector)
// Si prefieres, añade un ID 'tool-ai' al div correspondiente en el index.html

// ==========================================
// 14. SISTEMA DE GUÍAS MAGNÉTICAS (SMART GUIDES)
// ==========================================

const snapZone = 15; // Distancia en píxeles para que actúe el imán
let verticalGuide = null;
let horizontalGuide = null;

canvas.on('object:moving', function(options) {
    const obj = options.target;
    
    // Reiniciar guías en cada frame de movimiento
    verticalGuide = null;
    horizontalGuide = null;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Puntos de anclaje del lienzo (Izquierda, Centro, Derecha / Arriba, Medio, Abajo)
    const snapPointsX = [0, canvasWidth / 2, canvasWidth];
    const snapPointsY = [0, canvasHeight / 2, canvasHeight];

    // Dimensiones de la capa actual
    const objW = obj.getScaledWidth();
    const objH = obj.getScaledHeight();

    // Calcular las coordenadas absolutas de la capa (Bordes y Centro)
    let objLeft, objCenterX, objRight;
    let objTop, objCenterY, objBottom;

    if (obj.originX === 'center') {
        objCenterX = obj.left;
        objLeft = obj.left - objW / 2;
        objRight = obj.left + objW / 2;
    } else {
        objLeft = obj.left;
        objCenterX = obj.left + objW / 2;
        objRight = obj.left + objW;
    }

    if (obj.originY === 'center') {
        objCenterY = obj.top;
        objTop = obj.top - objH / 2;
        objBottom = obj.top + objH / 2;
    } else {
        objTop = obj.top;
        objCenterY = obj.top + objH / 2;
        objBottom = obj.top + objH;
    }

    // --- Lógica del Imán X (Líneas Verticales) ---
    let snappedX = false;
    for (let targetX of snapPointsX) {
        if (!snappedX && Math.abs(targetX - objCenterX) < snapZone) {
            obj.set('left', obj.originX === 'center' ? targetX : targetX - objW/2);
            verticalGuide = targetX; snappedX = true;
        }
        if (!snappedX && Math.abs(targetX - objLeft) < snapZone) {
            obj.set('left', obj.originX === 'center' ? targetX + objW/2 : targetX);
            verticalGuide = targetX; snappedX = true;
        }
        if (!snappedX && Math.abs(targetX - objRight) < snapZone) {
            obj.set('left', obj.originX === 'center' ? targetX - objW/2 : targetX - objW);
            verticalGuide = targetX; snappedX = true;
        }
    }

    // --- Lógica del Imán Y (Líneas Horizontales) ---
    let snappedY = false;
    for (let targetY of snapPointsY) {
        if (!snappedY && Math.abs(targetY - objCenterY) < snapZone) {
            obj.set('top', obj.originY === 'center' ? targetY : targetY - objH/2);
            horizontalGuide = targetY; snappedY = true;
        }
        if (!snappedY && Math.abs(targetY - objTop) < snapZone) {
            obj.set('top', obj.originY === 'center' ? targetY + objH/2 : targetY);
            horizontalGuide = targetY; snappedY = true;
        }
        if (!snappedY && Math.abs(targetY - objBottom) < snapZone) {
            obj.set('top', obj.originY === 'center' ? targetY - objH/2 : targetY - objH);
            horizontalGuide = targetY; snappedY = true;
        }
    }
});

// Al soltar el ratón, borramos las guías
canvas.on('mouse:up', function() {
    verticalGuide = null;
    horizontalGuide = null;
    canvas.renderAll();
});

// Dibujar las líneas sobre el lienzo
canvas.on('after:render', function() {
    if (verticalGuide !== null || horizontalGuide !== null) {
        // Usamos el contexto del lienzo para pintar sin crear objetos en la historia
        const ctx = canvas.contextContainer;
        ctx.save();
        
        // Estilo de la guía (Cian brillante como en Photoshop)
        ctx.strokeStyle = '#00bfff';
        ctx.lineWidth = 1;
        
        // Hacemos que la línea se dibuje punteada o con trazos (5px línea, 5px hueco)
        // Para deshacer la escala del zoom y que la línea siempre se vea fina:
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        
        // Transformar las coordenadas relativas al zoom y paneo actual
        const vpt = canvas.viewportTransform;
        
        if (verticalGuide !== null) {
            const drawX = verticalGuide * vpt[0] + vpt[4];
            ctx.beginPath();
            ctx.moveTo(drawX, 0);
            ctx.lineTo(drawX, canvas.height * vpt[3] + vpt[5]); // Ajuste para el zoom
            ctx.stroke();
        }
        
        if (horizontalGuide !== null) {
            const drawY = horizontalGuide * vpt[3] + vpt[5];
            ctx.beginPath();
            ctx.moveTo(0, drawY);
            ctx.lineTo(canvas.width * vpt[0] + vpt[4], drawY);
            ctx.stroke();
        }
        
        ctx.restore();
    }
});

// ==========================================
// ARRANQUE: Añadir Capa Base Inicial
// ==========================================
const rectBase = new fabric.Rect({
    name: 'Capa Base', left: canvas.width / 2 - 100, top: canvas.height / 2 - 100, 
    fill: '#a8d8ea', width: 200, height: 200, cornerColor: 'white', cornerStrokeColor: 'black', borderColor: 'white', transparentCorners: false
});
canvas.add(rectBase); canvas.setActiveObject(rectBase);