// --- Supongamos que ya tienes el código base anterior ---

// Variables para nuestra lógica
const radioMesaVisual = 60; // Radio del círculo visual de la mesa

// 1. EXTENDER LA FUNCIÓN CREAR MESA PARA GESTIONAR INVITADOS
function crearMesa(x, y, nombre, capacidadMax) {
    const circulo = new fabric.Circle({
        radius: radioMesaVisual, fill: '#f1f5f9', stroke: '#3b82f6', strokeWidth: 3,
        originX: 'center', originY: 'center'
    });
    const texto = new fabric.Text(nombre, {
        fontSize: 18, fill: '#1e293b', originX: 'center', originY: 'center'
    });

    const mesa = new fabric.Group([circulo, texto], {
        left: x, top: y, hasControls: false,
        tipoObjeto: 'mesa',
        nombreAsignado: nombre,
        capacidadMax: capacidadMax,
        // ESTADO: Un array para guardar referencias de los invitados sentados
        invitadosSentados: [] 
    });
    return mesa;
}

// 2. FUNCIÓN MAESTRA: RECALCULAR POSICIONES EN LA MESA
function reposicionarInvitadosEnCirculo(mesa) {
    const invitados = mesa.invitadosSentados;
    const numInvitados = invitados.length;
    if (numInvitados === 0) return;

    // Centro absoluto de la mesa (Fabric.js usa top/left del grupo, necesitamos el centro)
    const cx = mesa.left + (mesa.width / 2);
    const cy = mesa.top + (mesa.height / 2);

    // El radio donde queremos que se sienten (un poco más allá del borde visual)
    const radioAsiento = radioMesaVisual + 25; 

    invitados.forEach((invitadoObj, index) => {
        // A) Calcular el ángulo (en radianes) para este invitado
        const angulo = (index / numInvitados) * (2 * Math.PI);

        // B) Aplicar la fórmula trigonométrica
        const xFinal = cx + (radioAsiento * Math.cos(angulo));
        const yFinal = cy + (radioAsiento * Math.sin(angulo));

        // C) Actualizar el objeto del invitado
        invitadoObj.set({
            left: xFinal - (invitadoObj.width / 2), // Restamos la mitad para centrar el objeto
            top: yFinal - (invitadoObj.height / 2),
            mesaActualId: mesa.nombreAsignado // Estado actualizado
        });
        
        // Efecto visual: Cambiar color de fondo a verde (sentado)
        invitadoObj.item(0).set('fill', '#bbf7d0'); 
        invitadoObj.item(1).set('fill', '#166534');
    });

    // Indicar a Fabric.js que renderice los cambios
    canvas.renderAll();
}

// --- ACTUALIZACIÓN DEL EVENTO DE COLISIÓN (del código anterior) ---
canvas.on('object:modified', function(options) {
    const objetoMovido = options.target;
    if (objetoMovido.tipoObjeto !== 'invitado') return;

    const mesas = canvas.getObjects().filter(obj => obj.tipoObjeto === 'mesa');
    let mesaColisionada = null;

    // Detectar intersección (igual que antes)
    mesas.forEach(mesa => {
        if (objetoMovido.intersectsWithObject(mesa)) {
            mesaColisionada = mesa;
        }
    });

    if (mesaColisionada) {
        // LÓGICA DE ASIGNACIÓN:
        
        // 1. Verificar capacidad
        if (mesaColisionada.invitadosSentados.length >= mesaColisionada.capacidadMax) {
            alert(`La ${mesaColisionada.nombreAsignado} está llena.`);
            // Reseteamos posición si está llena
            objetoMovido.set({left: 100, top: 100}); 
            return;
        }

        // 2. Si venía de otra mesa, quitarlo de allí primero
        const mesasAnteriores = mesas.filter(m => m.invitadosSentados.includes(objetoMovido));
        mesasAnteriores.forEach(m => {
            m.invitadosSentados = m.invitadosSentados.filter(inv => inv !== objetoMovido);
            // Reposicionamos la mesa antigua (ahora tiene uno menos)
            reposicionarInvitadosEnCirculo(m);
        });

        // 3. Añadirlo a la nueva mesa
        if (!mesaColisionada.invitadosSentados.includes(objetoMovido)) {
            mesaColisionada.invitadosSentados.push(objetoMovido);
        }
        
        // 4. Reposicionar la nueva mesa (ahora tiene uno más)
        reposicionarInvitadosEnCirculo(mesaColisionada);

    } else {
        // Se soltó fuera: Quitar de cualquier mesa y resetear color
        mesas.forEach(m => {
            if (m.invitadosSentados.includes(objetoMovido)) {
                m.invitadosSentados = m.invitadosSentados.filter(inv => inv !== objetoMovido);
                reposicionarInvitadosEnCirculo(m); // Reposicionamos la mesa antigua
            }
        });
        objetoMovido.item(0).set('fill', '#fecaca'); // Vuelve a rojo (pendiente)
        objetoMovido.item(1).set('fill', '#7f1d1d');
    }
    canvas.renderAll();
});