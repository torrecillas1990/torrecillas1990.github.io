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
		const btnMerge = document.createElement('button');
		btnMerge.innerHTML = '🔗';
		btnMerge.title = 'Fusionar con la de abajo';
		// Solo mostramos el botón si no es la capa inferior (índice 0)
		if (i > 0) {
			btnMerge.onclick = () => mergeLayerDown(obj);
			actionsDiv.appendChild(btnMerge);
		}
        const btnVisibility = document.createElement('button'); btnVisibility.textContent = obj.visible ? '👁️' : '🙈'; btnVisibility.onclick = () => { obj.set('visible', !obj.visible); canvas.renderAll(); updateLayersPanel(); saveHistory(); };
        const btnUp = document.createElement('button'); btnUp.innerHTML = '↑'; btnUp.onclick = () => { canvas.bringForward(obj); canvas.renderAll(); updateLayersPanel(); saveHistory(); };
        const btnDown = document.createElement('button'); btnDown.innerHTML = '↓'; btnDown.onclick = () => { canvas.sendBackwards(obj); canvas.renderAll(); updateLayersPanel(); saveHistory(); };
        const btnDelete = document.createElement('button'); btnDelete.innerHTML = '🗑️'; btnDelete.onclick = () => { canvas.remove(obj); canvas.discardActiveObject(); };
        actionsDiv.appendChild(btnVisibility); actionsDiv.appendChild(btnUp); actionsDiv.appendChild(btnDown); actionsDiv.appendChild(btnDelete);
        li.appendChild(nameSpan); li.appendChild(actionsDiv); layersList.appendChild(li);
    }
}

function mergeLayerDown(topObj) {
    const objects = canvas.getObjects();
    const topIdx = objects.indexOf(topObj);
    if (topIdx <= 0) return; // Seguridad: no hay capa debajo

    const bottomObj = objects[topIdx - 1];

    // 1. Calcular la caja delimitadora ABSOLUTA conjunta (ignora el zoom/paneo actual)
    const topBound = topObj.getBoundingRect(true, true);
    const bottomBound = bottomObj.getBoundingRect(true, true);

    const minX = Math.min(topBound.left, bottomBound.left);
    const minY = Math.min(topBound.top, bottomBound.top);
    const maxX = Math.max(topBound.left + topBound.width, bottomBound.left + bottomBound.width);
    const maxY = Math.max(topBound.top + topBound.height, bottomBound.top + bottomBound.height);

    const finalWidth = maxX - minX;
    const finalHeight = maxY - minY;

    // 2. Ocultar el resto de capas temporalmente
    const visibilityMap = new Map();
    canvas.getObjects().forEach(obj => {
        visibilityMap.set(obj, obj.visible);
        obj.visible = (obj === topObj || obj === bottomObj);
    });

    // 3. CLAVE: Resetear la cámara temporalmente para evitar que el recorte salga desplazado
    const originalVpt = canvas.viewportTransform.slice();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    // 4. Renderizar a imagen de alta calidad
    const dataUrl = canvas.toDataURL({
        format: 'png',
        left: minX,
        top: minY,
        width: finalWidth,
        height: finalHeight,
        multiplier: 2 // Usamos x2 para que no pierda resolución al fusionar
    });

    // 5. Restaurar visibilidad y cámara
    canvas.setViewportTransform(originalVpt);
    canvas.getObjects().forEach(obj => obj.visible = visibilityMap.get(obj));

    // 6. Cargar la imagen y colocarla exactamente en el mismo sitio
    fabric.Image.fromURL(dataUrl, function(mergedImg) {
        
        // La colocamos con origen Top/Left porque nuestras coordenadas minX/minY vienen de ahí
        mergedImg.set({
            left: minX,
            top: minY,
            originX: 'left',
            originY: 'top',
            name: 'Capa Fusionada'
        });

        // La re-centramos para que coincida con el comportamiento del resto de tus herramientas
        mergedImg.set({
            left: minX + (finalWidth / 2),
            top: minY + (finalHeight / 2),
            originX: 'center',
            originY: 'center'
        });

        // CLAVE: Como la exportamos a x2 de tamaño, la reducimos al 50% en el lienzo
        // para que mantenga su tamaño original pero con el doble de densidad de píxeles
        mergedImg.scale(0.5);

        // 7. Reemplazar en la pila de capas
        canvas.remove(topObj);
        canvas.remove(bottomObj);
        
        // Insertamos la nueva capa exactamente en la posición donde estaba la capa inferior
        canvas.insertAt(mergedImg, topIdx - 1, false);
        canvas.setActiveObject(mergedImg);
        
        saveHistory();
        updateLayersPanel();
        canvas.renderAll();
    });
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
let isPanMode = false, isCloneMode = false, isCropMode = false, isLassoMode = false, isEyedropperMode = false, isEraserMode = false;
let cloneSource = { x: 0, y: 0 }, cloneImageSnapshot = null, cloneDeltaX = 0, cloneDeltaY = 0, isCloneDeltaSet = false, isSettingCloneSource = false, myCloneBrush = null;
let cropRect = null, cropOrigX = 0, cropOrigY = 0, isDrawingCrop = false, lassoTarget = null, eraserTarget = null;
let showEraserPreview = false, showClonePreview = false, isCloningActive = false;
let currentMouseX = 0, currentMouseY = 0;

const toolBars = [
    document.getElementById('tool-options-bar'), document.getElementById('tool-crop-bar'),
    document.getElementById('tool-lasso-bar'), document.getElementById('tool-filters-bar'),
    document.getElementById('tool-shapes-bar'), document.getElementById('tool-text-bar'),
    document.getElementById('tool-color-bar'), document.getElementById('tool-eraser-bar')
];

function setActiveUI(id) { document.querySelectorAll('.tool-item').forEach(el => el.classList.remove('active')); if(id) document.getElementById(id).classList.add('active'); }
function closeAllTools() {
    isPanMode = isCloneMode = isCropMode = isLassoMode = isEyedropperMode = isEraserMode = false;
    showEraserPreview = showClonePreview = isCloningActive = false;
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
document.getElementById('clone-size').addEventListener('input', e => { if (myCloneBrush) myCloneBrush.width = parseInt(e.target.value, 10); if (isCloneMode) { showClonePreview = true; canvas.requestRenderAll(); } });
document.getElementById('clone-size').addEventListener('change', () => { showClonePreview = false; canvas.requestRenderAll(); });
document.getElementById('clone-hardness').addEventListener('input', () => { if (isCloneMode) { showClonePreview = true; canvas.requestRenderAll(); } });
document.getElementById('clone-hardness').addEventListener('change', () => { showClonePreview = false; canvas.requestRenderAll(); });
document.getElementById('tool-crop').addEventListener('click', () => { 
    closeAllTools(); 
    setActiveUI('tool-crop'); 
    canvas.discardActiveObject(); 
    isCropMode = true; 
    canvas.selection = false; 
    canvas.defaultCursor = 'crosshair'; 
    canvas.getObjects().forEach(o => { o.selectable = false; o.evented = false; }); 
    
    // Sincronizar inputs con el tamaño actual del lienzo
    document.getElementById('crop-width').value = Math.round(canvas.width);
    document.getElementById('crop-height').value = Math.round(canvas.height);

    document.getElementById('tool-crop-bar').style.display = 'flex'; 
});
document.getElementById('btn-cancel-crop').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('btn-apply-crop').addEventListener('click', () => { 
    // Si el usuario no dibujó el recuadro a mano, lo creamos centrado con los números de los inputs
    if (!cropRect) {
        const w = parseInt(document.getElementById('crop-width').value, 10) || canvas.width;
        const h = parseInt(document.getElementById('crop-height').value, 10) || canvas.height;
        cropRect = new fabric.Rect({
            left: (canvas.width - w) / 2,
            top: (canvas.height - h) / 2,
            width: w,
            height: h
        });
    }

    const bound = cropRect.getBoundingRect(); 
    canvas.remove(cropRect); 
    canvas.getObjects().forEach(obj => { obj.set({ left: obj.left - bound.left, top: obj.top - bound.top }); obj.setCoords(); }); 
    canvas.setWidth(bound.width); 
    canvas.setHeight(bound.height); 
    cropRect = null; 
    closeAllTools(); 
    setActiveUI('tool-select'); 
    updateLayersPanel(); 
    saveHistory(); 
});

document.getElementById('tool-lasso').addEventListener('click', () => { lassoTarget = canvas.getActiveObject(); if (!lassoTarget) return alert('Selecciona primero la capa a recortar.'); closeAllTools(); setActiveUI('tool-lasso'); isLassoMode = true; canvas.isDrawingMode = true; canvas.freeDrawingBrush = new fabric.PencilBrush(canvas); canvas.freeDrawingBrush.color = 'rgba(0,191,255,0.7)'; canvas.freeDrawingBrush.width = 4; document.getElementById('tool-lasso-bar').style.display = 'flex'; });
document.getElementById('btn-cancel-lasso').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });

document.getElementById('tool-eraser').addEventListener('click', () => { 
    eraserTarget = canvas.getActiveObject(); if (!eraserTarget) return alert('Por favor, selecciona primero la capa que quieres borrar.');
    closeAllTools(); setActiveUI('tool-eraser'); isEraserMode = true; canvas.isDrawingMode = true; 
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas); canvas.freeDrawingBrush.color = 'rgba(255, 0, 0, 0.4)'; 
    canvas.freeDrawingBrush.width = parseInt(document.getElementById('eraser-size').value, 10); 
    document.getElementById('tool-eraser-bar').style.display = 'flex'; 
});
document.getElementById('btn-cancel-eraser').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-select'); });
document.getElementById('eraser-size').addEventListener('input', e => { if (isEraserMode) { canvas.freeDrawingBrush.width = parseInt(e.target.value, 10); showEraserPreview = true; canvas.requestRenderAll(); } });
document.getElementById('eraser-size').addEventListener('change', () => { showEraserPreview = false; canvas.requestRenderAll(); });
document.getElementById('eraser-hardness').addEventListener('input', () => { if (isEraserMode) { showEraserPreview = true; canvas.requestRenderAll(); } });
document.getElementById('eraser-hardness').addEventListener('change', () => { showEraserPreview = false; canvas.requestRenderAll(); });

// ==========================================
// 8. PANEL DE COLOR Y PIPETA
// ==========================================
const globalColorPicker = document.getElementById('global-color-picker');
const colorTargetType = document.getElementById('color-apply-target');
document.getElementById('tool-color').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-color'); const obj = canvas.getActiveObject(); if (obj && (obj.type === 'i-text' || ['rect', 'circle', 'triangle', 'ellipse', 'path', 'polygon'].includes(obj.type))) { const currentColor = colorTargetType.value === 'fill' ? obj.fill : obj.stroke; if (currentColor && currentColor !== 'transparent') globalColorPicker.value = currentColor; } document.getElementById('tool-color-bar').style.display = 'flex'; });
function applyGlobalColor(hexColor) { if(hexColor !== 'transparent') globalColorPicker.value = hexColor; const obj = canvas.getActiveObject(); if (obj && (obj.type === 'i-text' || ['rect', 'circle', 'triangle', 'ellipse', 'path', 'polygon'].includes(obj.type))) { if (colorTargetType.value === 'fill') obj.set('fill', hexColor); else { obj.set('stroke', hexColor); if (hexColor !== 'transparent' && obj.strokeWidth === 0) obj.set('strokeWidth', 3); } canvas.renderAll(); saveHistory(); } }
globalColorPicker.addEventListener('input', (e) => applyGlobalColor(e.target.value)); colorTargetType.addEventListener('change', () => { const obj = canvas.getActiveObject(); if (obj) { const col = colorTargetType.value === 'fill' ? obj.fill : obj.stroke; if (col && col !== 'transparent') globalColorPicker.value = col; } });
document.querySelectorAll('.color-swatch').forEach(swatch => { swatch.addEventListener('click', (e) => applyGlobalColor(e.target.dataset.color)); });
document.getElementById('btn-eyedropper').addEventListener('click', async () => { if (window.EyeDropper) { try { const dropper = new EyeDropper(); const result = await dropper.open(); applyGlobalColor(result.sRGBHex); } catch (e) {} } else { isEyedropperMode = true; canvas.defaultCursor = 'crosshair'; document.getElementById('color-status').innerText = '🎯 Haz clic para capturar'; document.getElementById('color-status').style.color = '#ff0000'; } });

// ==========================================
// 9. FORMAS Y TEXTO (VECTORIAL)
// ==========================================
document.getElementById('tool-shapes').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-shapes'); document.getElementById('tool-shapes-bar').style.display = 'flex'; });
document.getElementById('shape-fill-type').addEventListener('change', (e) => { document.getElementById('shape-stroke-container').style.display = e.target.value === 'outline' ? 'flex' : 'none'; });
document.getElementById('btn-add-shape').addEventListener('click', () => { const type = document.getElementById('shape-type').value; const isOutline = document.getElementById('shape-fill-type').value === 'outline'; const strokeW = parseInt(document.getElementById('shape-stroke-width').value, 10); const color = globalColorPicker.value; const options = { left: canvas.width / 2, top: canvas.height / 2, originX: 'center', originY: 'center', fill: isOutline ? 'transparent' : color, stroke: isOutline ? color : null, strokeWidth: isOutline ? strokeW : 0, transparentCorners: false, cornerColor: 'white', cornerStrokeColor: 'black', borderColor: 'white' }; let shape; switch(type) { case 'square': shape = new fabric.Rect({ ...options, width: 100, height: 100 }); break; case 'rectangle': shape = new fabric.Rect({ ...options, width: 150, height: 100 }); break; case 'circle': shape = new fabric.Circle({ ...options, radius: 50 }); break; case 'triangle': shape = new fabric.Triangle({ ...options, width: 100, height: 100 }); break; case 'star': shape = new fabric.Polygon([{x:50,y:0},{x:61,y:35},{x:98,y:35},{x:68,y:57},{x:79,y:91},{x:50,y:70},{x:21,y:91},{x:32,y:57},{x:2,y:35},{x:39,y:35}], options); break; } shape.name = 'Forma Vectorial'; canvas.add(shape); canvas.setActiveObject(shape); canvas.renderAll(); });
document.getElementById('tool-text').addEventListener('click', () => { closeAllTools(); setActiveUI('tool-text'); document.getElementById('tool-text-bar').style.display = 'flex'; });
document.getElementById('text-fill-type').addEventListener('change', (e) => { document.getElementById('text-stroke-container').style.display = e.target.value === 'outline' ? 'flex' : 'none'; });
document.getElementById('btn-add-text').addEventListener('click', () => { const isOutline = document.getElementById('text-fill-type').value === 'outline'; const strokeW = parseInt(document.getElementById('text-stroke-width').value, 10); const color = globalColorPicker.value; const options = { left: canvas.width / 2, top: canvas.height / 2, originX: 'center', originY: 'center', fontFamily: 'sans-serif', fontSize: 60, fontWeight: 'bold', fill: isOutline ? 'transparent' : color, stroke: isOutline ? color : null, strokeWidth: isOutline ? strokeW : 0, transparentCorners: false, cornerColor: 'white', cornerStrokeColor: 'black', borderColor: 'white', name: 'Texto' }; const text = new fabric.IText('Doble clic', options); canvas.add(text); canvas.setActiveObject(text); canvas.renderAll(); });

// ==========================================
// 10. MOTOR CENTRALIZADO DE RATÓN (UNIFICACIÓN)
// ==========================================
let currentZoom = 1; // Variable global para controlar el zoom de la mesa de trabajo

document.getElementById('btnResetView').addEventListener('click', () => { 
    currentZoom = 1;
    document.getElementById('workspace').style.transform = `scale(1)`;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]); 
    canvas.calcOffset(); // Muy importante para resetear las coordenadas del ratón
    canvas.renderAll(); 
});

// NUEVO COMPORTAMIENTO DE ZOOM
canvas.on('mouse:wheel', function(opt) { 
    var delta = opt.e.deltaY; 
    currentZoom *= 0.999 ** delta; 
    
    // Límites de zoom (de 10% a 1000%)
    if (currentZoom > 10) currentZoom = 10; 
    if (currentZoom < 0.1) currentZoom = 0.1; 
    
    // Hacemos zoom sobre TODA la caja, incluyendo el lienzo y el fondo de cuadraditos
    document.getElementById('workspace').style.transform = `scale(${currentZoom})`;
    
    // Le indicamos a Fabric que la caja ha cambiado de tamaño para que el ratón no pierda precisión
    canvas.calcOffset(); 
    
    opt.e.preventDefault(); 
    opt.e.stopPropagation(); 
});

let isDraggingCamera = false, lastPosX = 0, lastPosY = 0;

canvas.on('mouse:down', function(opt) {
    const pointer = canvas.getPointer(opt.e); currentMouseX = pointer.x; currentMouseY = pointer.y;

    if (opt.e.altKey === true || isPanMode) { 
        isDraggingCamera = true; 
        canvas.selection = false; 
        lastPosX = opt.e.clientX || (opt.e.touches && opt.e.touches[0].clientX); 
        lastPosY = opt.e.clientY || (opt.e.touches && opt.e.touches[0].clientY); 
        canvas.defaultCursor = 'grabbing'; 
        return; 
    }
    
    if (isEyedropperMode) {
        const e = opt.e; const rect = canvas.lowerCanvasEl.getBoundingClientRect(); const clientX = e.clientX || (e.touches && e.touches[0].clientX); const clientY = e.clientY || (e.touches && e.touches[0].clientY); const x = (clientX - rect.left) * (canvas.lowerCanvasEl.width / rect.width); const y = (clientY - rect.top) * (canvas.lowerCanvasEl.height / rect.height); const p = canvas.lowerCanvasEl.getContext('2d', { willReadFrequently: true }).getImageData(x, y, 1, 1).data;
        if (p[3] === 0) applyGlobalColor('transparent'); else applyGlobalColor("#" + ("000000" + ((p[0] << 16) | (p[1] << 8) | p[2]).toString(16)).slice(-6));
        isEyedropperMode = false; canvas.defaultCursor = 'default'; document.getElementById('color-status').innerText = '🎨 Panel de Color'; document.getElementById('color-status').style.color = '#00bfff'; return;
    }
    
    // Lógica de Clonador
    if (isCloneMode) {
        if (isSettingCloneSource) {
            cloneSource = { x: pointer.x, y: pointer.y }; isSettingCloneSource = false;
            
            const originalVpt = canvas.viewportTransform.slice(); canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            const img = new Image(); img.src = canvas.toDataURL({ format: 'png' });
            canvas.setViewportTransform(originalVpt);
            
            img.onload = () => {
                cloneImageSnapshot = img; document.getElementById('clone-status').innerText = '🖌️ Pintando...'; canvas.defaultCursor = 'default';
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
                
                myCloneBrush.width = parseInt(document.getElementById('clone-size').value, 10); 
                canvas.freeDrawingBrush = myCloneBrush; canvas.isDrawingMode = true;
            };
        } else {
            isCloningActive = true;
        }
    }
    
    // Lógica de Recorte
    if (isCropMode && !cropRect) { isDrawingCrop = true; cropOrigX = pointer.x; cropOrigY = pointer.y; cropRect = new fabric.Rect({ left: cropOrigX, top: cropOrigY, width: 0, height: 0, fill: 'rgba(0,191,255,0.2)', stroke: '#00bfff', strokeWidth: 2, strokeDashArray: [5,5], hasRotatingPoint: false, name: 'CropOverlay' }); canvas.add(cropRect); canvas.setActiveObject(cropRect); }
});

canvas.on('mouse:move', function(opt) {
    const pointer = canvas.getPointer(opt.e); currentMouseX = pointer.x; currentMouseY = pointer.y;
    
    // ARRASTRE DE CÁMARA CORREGIDO
    if (isDraggingCamera) { 
        let e = opt.e; 
        let clientX = e.clientX || (e.touches && e.touches[0].clientX); 
        let clientY = e.clientY || (e.touches && e.touches[0].clientY); 
        let vpt = canvas.viewportTransform; 
        
        // Dividimos la distancia por el zoom actual para que el arrastre sea fiel a la pantalla
        vpt[4] += (clientX - lastPosX) / currentZoom; 
        vpt[5] += (clientY - lastPosY) / currentZoom; 
        
        canvas.requestRenderAll(); 
        lastPosX = clientX; 
        lastPosY = clientY; 
        return; 
    }
    
    if (isCloneMode && isCloningActive) canvas.requestRenderAll();
    if (!isCropMode || !isDrawingCrop || !cropRect) return; const w = pointer.x - cropOrigX; const h = pointer.y - cropOrigY; 
	cropRect.set({ left: w < 0 ? pointer.x : cropOrigX, top: h < 0 ? pointer.y : cropOrigY, width: Math.abs(w), height: Math.abs(h) }); 
	document.getElementById('crop-width').value = Math.round(Math.abs(w));
	document.getElementById('crop-height').value = Math.round(Math.abs(h));
	canvas.renderAll();
});

canvas.on('mouse:up', function() {
    if (isDraggingCamera) { canvas.setViewportTransform(canvas.viewportTransform); isDraggingCamera = false; canvas.selection = !isPanMode; canvas.defaultCursor = isPanMode ? 'grab' : 'default'; return; }
    if (isCropMode && isDrawingCrop) { isDrawingCrop = false; cropRect.setCoords(); document.getElementById('btn-apply-crop').style.display = 'block'; canvas.defaultCursor = 'default'; }
    if (isCloneMode) { isCloningActive = false; canvas.requestRenderAll(); }
    verticalGuide = null; horizontalGuide = null; canvas.requestRenderAll();
});

// ==========================================
// 11. MOTOR DE MÁSCARAS (DUREZA CLONADOR Y BORRADOR)
// ==========================================
canvas.on('path:created', function(opt) {
    const path = opt.path;

    if (isCloneMode) { 
        const hEl = document.getElementById('clone-hardness');
        const hardness = hEl ? parseInt(hEl.value, 10) : 100;
        
        // Si el clonador está al 100% de dureza, guardamos el trazo nativo.
        if (hardness >= 99) {
            path.name = 'Clonación'; updateLayersPanel(); saveHistory(); 
        } else {
            // Clonador con difuminado suave
            isMaskProcessing = true; canvas.remove(path);
            
            const originalVpt = canvas.viewportTransform.slice(); canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            const visibilityMap = new Map(); canvas.getObjects().forEach(obj => { visibilityMap.set(obj, obj.visible); obj.visible = false; });
            
            path.set({ stroke: 'black', opacity: 1, fill: 'transparent' });
            path.visible = true; canvas.add(path); canvas.renderAll(); const pathDataUrl = canvas.toDataURL({ format: 'png' }); canvas.remove(path);
            canvas.getObjects().forEach(obj => { obj.visible = visibilityMap.get(obj); }); canvas.setViewportTransform(originalVpt); canvas.renderAll();
            
            const pathImg = new Image(); pathImg.src = pathDataUrl;
            pathImg.onload = () => {
                const tempC = document.createElement('canvas'); tempC.width = canvas.width; tempC.height = canvas.height; const ctx = tempC.getContext('2d');
                ctx.drawImage(cloneImageSnapshot, cloneDeltaX, cloneDeltaY);
                
                const blurPx = Math.max(0, (100 - hardness) / 4); 
                const maskC = document.createElement('canvas'); maskC.width = canvas.width; maskC.height = canvas.height; const mCtx = maskC.getContext('2d');
                if (blurPx > 0) mCtx.filter = `blur(${blurPx}px)`;
                mCtx.drawImage(pathImg, 0, 0);

                ctx.globalCompositeOperation = 'destination-in';
                ctx.drawImage(maskC, 0, 0);
                
                fabric.Image.fromURL(tempC.toDataURL('image/png'), function(finalImg) {
                    finalImg.set({ left: 0, top: 0, name: 'Clonación Suave' });
                    canvas.add(finalImg); canvas.setActiveObject(finalImg);
                    canvas.isDrawingMode = true; // reactivamos pincel
                    isMaskProcessing = false; saveHistory(); updateLayersPanel();
                });
            };
        }
    } 
    else if (isLassoMode || isEraserMode) {
        isMaskProcessing = true; canvas.remove(path); 
        if (isLassoMode) path.set({ fill: 'black', stroke: 'transparent' });
        if (isEraserMode) path.set({ stroke: 'black', opacity: 1, fill: 'transparent' });
        
        const targetLayer = isLassoMode ? lassoTarget : eraserTarget;
        const originalVpt = canvas.viewportTransform.slice(); canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        const visibilityMap = new Map(); canvas.getObjects().forEach(obj => { visibilityMap.set(obj, obj.visible); obj.visible = false; });
        
        targetLayer.visible = true; canvas.renderAll(); const imgDataUrl = canvas.toDataURL({ format: 'png' });
        targetLayer.visible = false; path.visible = true; canvas.add(path); canvas.renderAll(); const pathDataUrl = canvas.toDataURL({ format: 'png' }); canvas.remove(path);
        canvas.getObjects().forEach(obj => { obj.visible = visibilityMap.get(obj); }); canvas.setViewportTransform(originalVpt); canvas.renderAll();
        
        const imgObj = new Image(); imgObj.src = imgDataUrl;
        imgObj.onload = () => {
            const pathObj = new Image(); pathObj.src = pathDataUrl;
            pathObj.onload = () => {
                const tempC = document.createElement('canvas'); tempC.width = canvas.width; tempC.height = canvas.height; const ctx = tempC.getContext('2d'); ctx.drawImage(imgObj, 0, 0); 
                
                const hardnessEl = document.getElementById(isEraserMode ? 'eraser-hardness' : 'clone-hardness');
                const hardness = hardnessEl ? parseInt(hardnessEl.value, 10) : 100;
                const blurPx = Math.max(0, (100 - hardness) / 4); 
                
                const maskC = document.createElement('canvas'); maskC.width = canvas.width; maskC.height = canvas.height; const mCtx = maskC.getContext('2d');
                if (blurPx > 0) mCtx.filter = `blur(${blurPx}px)`;
                mCtx.drawImage(pathObj, 0, 0);

                if (isEraserMode) ctx.globalCompositeOperation = 'destination-out';
                else if (isLassoMode) { const mode = document.getElementById('lasso-mode').value; ctx.globalCompositeOperation = (mode === 'invert') ? 'destination-out' : 'destination-in'; }
                ctx.drawImage(maskC, 0, 0);
                
                const finalC = document.createElement('canvas'); finalC.width = canvas.width; finalC.height = canvas.height; finalC.getContext('2d').drawImage(tempC, 0, 0);
                fabric.Image.fromURL(finalC.toDataURL('image/png'), function(finalImg) {
                    finalImg.set({ left: 0, top: 0, name: targetLayer.name + (isEraserMode ? ' (Borrado)' : '') });
                    const zIndex = canvas.getObjects().indexOf(targetLayer); canvas.remove(targetLayer); canvas.insertAt(finalImg, zIndex, false); canvas.setActiveObject(finalImg); 
                    if (isLassoMode) { closeAllTools(); setActiveUI('tool-select'); } else if (isEraserMode) { eraserTarget = finalImg; canvas.isDrawingMode = true; }
                    isMaskProcessing = false; saveHistory(); updateLayersPanel();
                });
            };
        };
    }
});

// ==========================================
// 12. GUÍAS MAGNÉTICAS Y CÍRCULOS DE DUREZA
// ==========================================
const snapZone = 12; let verticalGuide = null; let horizontalGuide = null;

canvas.on('object:moving', function(opt) {
    const obj = opt.target; const canvasW = canvas.width; const canvasH = canvas.height; const centerX = canvasW / 2; const centerY = canvasH / 2;
    let objCenter = obj.getCenterPoint(); let objLeft = objCenter.x - (obj.getScaledWidth() / 2); let objRight = objCenter.x + (obj.getScaledWidth() / 2); let objTop = objCenter.y - (obj.getScaledHeight() / 2); let objBottom = objCenter.y + (obj.getScaledHeight() / 2);
    verticalGuide = null; horizontalGuide = null;
    if (Math.abs(objCenter.x - centerX) < snapZone) { obj.set({ left: obj.left - (objCenter.x - centerX) }); verticalGuide = centerX; } 
    else if (Math.abs(objLeft - 0) < snapZone) { obj.set({ left: obj.left - objLeft }); verticalGuide = 0; } 
    else if (Math.abs(objRight - canvasW) < snapZone) { obj.set({ left: obj.left - (objRight - canvasW) }); verticalGuide = canvasW; }
    if (Math.abs(objCenter.y - centerY) < snapZone) { obj.set({ top: obj.top - (objCenter.y - centerY) }); horizontalGuide = centerY; } 
    else if (Math.abs(objTop - 0) < snapZone) { obj.set({ top: obj.top - objTop }); horizontalGuide = 0; } 
    else if (Math.abs(objBottom - canvasH) < snapZone) { obj.set({ top: obj.top - (objBottom - canvasH) }); horizontalGuide = canvasH; }
});

canvas.on('after:render', function(opt) {
    const ctx = opt.ctx; if (!ctx) return; const vpt = canvas.viewportTransform;
    if (verticalGuide !== null || horizontalGuide !== null) {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.strokeStyle = '#00bfff'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); const htmlCanvas = canvas.getElement();
        if (verticalGuide !== null) { const drawX = (verticalGuide * vpt[0]) + vpt[4]; ctx.beginPath(); ctx.moveTo(drawX, 0); ctx.lineTo(drawX, htmlCanvas.height); ctx.stroke(); }
        if (horizontalGuide !== null) { const drawY = (horizontalGuide * vpt[3]) + vpt[5]; ctx.beginPath(); ctx.moveTo(0, drawY); ctx.lineTo(htmlCanvas.width, drawY); ctx.stroke(); }
        ctx.restore();
    }
    
    ctx.save();
    if (showEraserPreview || showClonePreview) {
        const centerX = (canvas.width / 2 - vpt[4]) / vpt[0]; const centerY = (canvas.height / 2 - vpt[5]) / vpt[3];
        const radiusId = showEraserPreview ? 'eraser-size' : 'clone-size'; const hardnessId = showEraserPreview ? 'eraser-hardness' : 'clone-hardness'; const radiusColor = showEraserPreview ? '#ff4444' : '#00bfff';
        const radius = parseInt(document.getElementById(radiusId).value, 10) / 2; const hardness = parseInt(document.getElementById(hardnessId).value, 10); const innerRadius = radius * (hardness / 100);
        ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI); ctx.strokeStyle = radiusColor; ctx.lineWidth = 2 / vpt[0]; ctx.setLineDash([3, 3]); ctx.stroke();
        if (hardness < 100 && innerRadius > 0) { ctx.beginPath(); ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI); ctx.strokeStyle = radiusColor; ctx.lineWidth = 1 / vpt[0]; ctx.setLineDash([1, 4]); ctx.stroke(); }
    }
    if (isCloneMode && isCloningActive && isCloneDeltaSet) {
        const sourceX = currentMouseX - cloneDeltaX; const sourceY = currentMouseY - cloneDeltaY; const radius = parseInt(document.getElementById('clone-size').value, 10) / 2;
        ctx.beginPath(); ctx.arc(sourceX, sourceY, radius, 0, 2 * Math.PI); ctx.strokeStyle = 'rgba(0, 191, 255, 0.8)'; ctx.lineWidth = 2 / vpt[0]; ctx.setLineDash([4, 4]); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sourceX - 5 / vpt[0], sourceY); ctx.lineTo(sourceX + 5 / vpt[0], sourceY); ctx.moveTo(sourceX, sourceY - 5 / vpt[0]); ctx.lineTo(sourceX, sourceY + 5 / vpt[0]); ctx.setLineDash([]); ctx.stroke();
    }
    ctx.restore();
});

// ==========================================
// 13. MOTOR DE AUTO-MEJORA INTELIGENTE
// ==========================================
document.getElementById('tool-enhance').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    
    // Seguridad: Solo funciona si hay una capa de imagen seleccionada
    if (!obj || obj.type !== 'image') {
        return alert('Por favor, selecciona primero una capa de imagen (Foto) en el Gestor de Capas para poder auto-mejorarla.');
    }

    // 1. Crear una miniatura invisible (100x100) para analizar píxeles a máxima velocidad
    const sampleSize = 100;
    const tempCanvas = obj.toCanvasElement({ multiplier: sampleSize / Math.max(obj.width, obj.height) });
    const ctx = tempCanvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;

    let totalLuminance = 0;
    let minL = 255;
    let maxL = 0;
    const count = imgData.length / 4;

    // 2. Analizar el canal de color y calcular la luminancia percibida
    for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        
        // Fórmula estándar de luminancia ITU-R BT.709
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        
        totalLuminance += l;
        if (l < minL) minL = l;
        if (l > maxL) maxL = l;
    }

    const avgLuminance = totalLuminance / count;
    const currentRange = maxL - minL;

    // 3. Calcular los ajustes óptimos (Fabric.js trabaja con rangos de -1 a 1)
    let brightnessAdjust = 0;
    if (avgLuminance < 100) {
        // La imagen está subexpuesta (oscura): subimos el brillo proporcionalmente
        brightnessAdjust = ((100 - avgLuminance) / 255) * 0.35;
    } else if (avgLuminance > 160) {
        // La imagen está sobreexpuesta (muy clara): bajamos el brillo sutilmente
        brightnessAdjust = ((160 - avgLuminance) / 255) * 0.2;
    }

    let contrastAdjust = 0.08; // Un toque base de contraste que siempre favorece
    if (currentRange < 180) {
        // Si el rango dinámico es plano, estiramos el contraste
        contrastAdjust += ((180 - currentRange) / 255) * 0.3;
    }

    const saturationAdjust = 0.12; // Un sutil 12% extra para avivar tonos apagados sin saturar pieles

    // 4. Aplicar los filtros de forma limpia
    // Filtramos el array para eliminar mejoras previas si el usuario pulsa el botón más de una vez
    obj.filters = obj.filters.filter(f => f.type !== 'Brightness' && f.type !== 'Contrast' && f.type !== 'Saturation');

    // Inyectamos los nuevos filtros calculados
    if (brightnessAdjust !== 0) {
        obj.filters.push(new fabric.Image.filters.Brightness({ brightness: brightnessAdjust }));
    }
    obj.filters.push(new fabric.Image.filters.Contrast({ contrast: contrastAdjust }));
    obj.filters.push(new fabric.Image.filters.Saturation({ saturation: saturationAdjust }));

    // 5. Renderizar los cambios y registrar en el historial de la PWA
    obj.applyFilters();
    canvas.renderAll();
    saveHistory();
});

// ==========================================
// 14. HERRAMIENTA: DUPLICAR RESOLUCIÓN (UPSCALING X2)
// ==========================================
document.getElementById('tool-upscale').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    
    // Seguridad: Solo procesar si hay una capa de imagen activa
    if (!obj || obj.type !== 'image') {
        return alert('Por favor, selecciona una capa de imagen (Foto) en el Gestor de Capas para duplicar su resolución.');
    }

    // Guardar los estados de transformación actuales para el reemplazo milimétrico
    const currentScaleX = obj.scaleX;
    const currentScaleY = obj.scaleY;
    const currentLeft = obj.left;
    const currentTop = obj.top;
    const currentAngle = obj.angle;
    const currentZIndex = canvas.getObjects().indexOf(obj);
    const currentName = obj.name;
    const originalEl = obj._element;

    // 1. Calcular las nuevas dimensiones del mapa de píxeles base
    const targetWidth = originalEl.width * 2;
    const targetHeight = originalEl.height * 2;

    // 2. Crear un entorno de renderizado offline
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = targetWidth;
    offscreenCanvas.height = targetHeight;
    const ctx = offscreenCanvas.getContext('2d');

    // Forzar al motor gráfico del navegador a usar interpolación bilineal/bicúbica avanzada
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Rasterizar la imagen original al doble de su tamaño de píxeles
    ctx.drawImage(originalEl, 0, 0, targetWidth, targetHeight);

    // 3. Reinyectar el nuevo recurso de alta densidad en Fabric.js
    fabric.Image.fromURL(offscreenCanvas.toDataURL('image/png'), function(newImg) {
        newImg.set({
            left: currentLeft,
            top: currentTop,
            angle: currentAngle,
            originX: obj.originX,
            originY: obj.originY,
            name: currentName.includes('(x2 Res)') ? currentName : currentName + ' (x2 Res)',
            // CLAVE: Reducimos la escala visual a la mitad del objeto original.
            // Esto compensa el aumento de píxeles base, manteniendo el tamaño en pantalla idéntico.
            scaleX: currentScaleX / 2,
            scaleY: currentScaleY / 2
        });

        // Preservar la cadena de filtros fotográficos aplicados previamente si existieran
        if (obj.filters && obj.filters.length > 0) {
            newImg.filters = [...obj.filters];
            newImg.applyFilters();
        }

        // 4. Sustitución atómica en la pila de renderizado
        canvas.remove(obj);
        canvas.insertAt(newImg, currentZIndex, false);
        canvas.setActiveObject(newImg);
        
        // Sincronizar con los sistemas nativos de la aplicación
        saveHistory();
        updateLayersPanel();
        canvas.renderAll();
    });
});

// ==========================================
// 15. BARRA DE INFORMACIÓN (TAMAÑOS)
// ==========================================
const infoCanvasSize = document.getElementById('info-canvas-size');
const infoLayerSize = document.getElementById('info-layer-size');

function updateInfoBar() {
    // 1. Actualizar tamaño del lienzo
    infoCanvasSize.textContent = `${Math.round(canvas.width)} x ${Math.round(canvas.height)} px`;

    // 2. Actualizar tamaño de la capa seleccionada
    const activeObj = canvas.getActiveObject();
    if (activeObj && activeObj.name !== 'CropOverlay') {
        // Multiplicamos el ancho/alto original por su escala actual para obtener el tamaño real en el lienzo
        const w = Math.round(activeObj.width * activeObj.scaleX);
        const h = Math.round(activeObj.height * activeObj.scaleY);
        infoLayerSize.textContent = `${w} x ${h} px`;
    } else {
        infoLayerSize.textContent = `-`;
    }
}

// 3. Conectar la función a los eventos de Fabric.js para que se actualice en tiempo real
canvas.on('selection:created', updateInfoBar);
canvas.on('selection:updated', updateInfoBar);
canvas.on('selection:cleared', updateInfoBar);
canvas.on('object:scaling', updateInfoBar); // Actualiza mientra arrastras para hacer más grande/pequeña una capa
canvas.on('object:modified', updateInfoBar);
canvas.on('after:render', updateInfoBar); // Captura cambios de lienzo (como la herramienta de recorte)

// Llamada inicial para establecer el tamaño base al abrir la app
updateInfoBar();

// ==========================================
// 16. CONTROL NUMÉRICO DEL LIENZO (CROP CON INPUTS)
// ==========================================
function updateCropRectFromInputs() {
    if (!isCropMode) return;
    const w = parseInt(document.getElementById('crop-width').value, 10) || 0;
    const h = parseInt(document.getElementById('crop-height').value, 10) || 0;
    if (w <= 0 || h <= 0) return;

    // Si no existe el recuadro de previsualización, lo inicializamos
    if (!cropRect) {
        cropRect = new fabric.Rect({
            fill: 'rgba(0,191,255,0.2)', 
            stroke: '#00bfff', 
            strokeWidth: 2, 
            strokeDashArray: [5,5], 
            hasRotatingPoint: false, 
            name: 'CropOverlay'
        });
        canvas.add(cropRect);
    }

    // Centrar el recuadro numérico en mitad del lienzo de trabajo de forma simétrica
    cropRect.set({
        left: (canvas.width - w) / 2,
        top: (canvas.height - h) / 2,
        width: w,
        height: h
    });
    cropRect.setCoords();
    canvas.setActiveObject(cropRect);
    canvas.renderAll();
}

// Escuchar la escritura en los campos numéricos
document.getElementById('crop-width').addEventListener('input', updateCropRectFromInputs);
document.getElementById('crop-height').addEventListener('input', updateCropRectFromInputs);

// Sincronizar inputs si el usuario deforma el recuadro usando los tiradores de las esquinas de Fabric.js
canvas.on('object:scaling', function(opt) {
    const obj = opt.target;
    if (isCropMode && obj && obj.name === 'CropOverlay') {
        document.getElementById('crop-width').value = Math.round(obj.getScaledWidth());
        document.getElementById('crop-height').value = Math.round(obj.getScaledHeight());
    }
});

// ==========================================
// WELCOME
// ==========================================
const welcomeOverlay = document.getElementById('welcome-overlay');

// 1. Botón: Importar Imagen
document.getElementById('welcome-import').addEventListener('click', () => {
    welcomeOverlay.style.display = 'none'; // Ocultamos el modal
    document.getElementById('fileInput').click(); // Abrimos el selector de archivos
});

// 2. Botón: Lienzo Vacío
document.getElementById('welcome-empty').addEventListener('click', () => {
    welcomeOverlay.style.display = 'none';
    
    // Aquí inicializamos el lienzo base solo si el usuario elige esta opción
    const rectBase = new fabric.Rect({ 
        name: 'Capa Base', 
        left: canvas.width / 2 - 100, 
        top: canvas.height / 2 - 100, 
        fill: '#a8d8ea', 
        width: 200, 
        height: 200, 
        cornerColor: 'white', 
        cornerStrokeColor: 'black', 
        borderColor: 'white', 
        transparentCorners: false 
    });
    canvas.add(rectBase); 
    canvas.setActiveObject(rectBase); 
    saveHistory();
});
