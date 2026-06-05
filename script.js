const proyectos = [
    {
        categoria: 'boda',
        titulo: 'Invitación Boda V1',
        descripcion: 'Versión 1 de la invitación interactiva.',
        ruta: 'boda/invitacion-v1/index.html'
    },
	{
        categoria: 'boda',
        titulo: 'Invitación Boda V2',
        descripcion: 'Versión 2 de la invitación interactiva.',
        ruta: 'boda/invitacion-v2/index.html'
    },
	{
        categoria: 'boda',
        titulo: 'Invitación Boda V3',
        descripcion: 'Versión 3 de la invitación interactiva.',
        ruta: 'boda/invitacion-v3/index.html'
    },
	{
        categoria: 'boda',
        titulo: 'Invitación Boda V4',
        descripcion: 'Versión 4 de la invitación interactiva.',
        ruta: 'boda/invitacion-v4/index.html'
    },
	{
        categoria: 'boda',
        titulo: 'Invitación Boda V5',
        descripcion: 'Versión 5 de la invitación interactiva.',
        ruta: 'boda/invitacion-v5/index.html'
    },
    {
        categoria: 'boda',
        titulo: 'My Dots',
        descripcion: 'Herramienta de gestión de recuerdos/fotos de la boda.',
        ruta: 'boda/my-dots/index.html'
    },
    {
        categoria: 'boda',
        titulo: 'My Dots PRO',
        descripcion: 'Herramienta de gestión PRO de recuerdos/fotos de la boda.',
        ruta: 'boda/my-dots-pro/index.html'
    },
    {
        categoria: 'boda',
        titulo: 'My Dots PRO modo admin',
        descripcion: 'Herramienta de gestión PRO de recuerdos/fotos de la boda.',
        ruta: 'boda/my-dots-pro/index.html?modo=admin'
    },
    {
        categoria: 'manuel-torrecillas-sl',
        titulo: 'Manuel Torrecillas SL',
        descripcion: 'Web corporativa oficial.',
        ruta: 'manuel-torrecillas-sl/index.html'
    },
    {
        categoria: 'utilidades',
        titulo: 'Calculadora de Ritmo',
        descripcion: 'Herramienta para el cálculo de tiempos de carrera y ritmos por kilómetro para corredores.',
        ruta: 'deportiva/calculadora-ritmo/index.html'
    },
    {
        categoria: 'deportiva',
        titulo: 'Web deportiva',
        descripcion: 'Web deportiva.',
        ruta: 'deportiva/index.html'
    },
    {
        categoria: 'utilidades',
        titulo: 'Grasa Corporal',
        descripcion: 'Herramienta para el cálculo de grasa corporal basado en el Método de la Marina de EEUU (Navy Method).',
        ruta: 'deportiva/calculadora-grasa-corporal/index.html'
    },
    {
        categoria: 'utilidades',
        titulo: 'Contador de Calorías',
        descripcion: 'Herramienta para base de datos simplificada para productos específicos.',
        ruta: 'deportiva/contador-calorias/index.html'
    },
    {
        categoria: 'utilidades',
        titulo: 'Editor Imagenes',
        descripcion: 'Herramienta para editar imagenes de manera profesional.',
        ruta: 'imagen/index.html'
    },
    {
        categoria: 'utilidades',
        titulo: 'Editor Voz',
        descripcion: 'Herramienta para editar sonidos de manera profesional.',
        ruta: 'voz/index.html'
    },
    {
        categoria: 'utilidades',
        titulo: 'Radar aeronaves',
        descripcion: 'Herramienta para geolocalizar aeronaves.',
        ruta: 'cops/index.html'
    },
    {
        categoria: 'utilidades',
        titulo: 'Predictor',
        descripcion: 'Herramienta Predictor.',
        ruta: 'predictor/index.html'
    },
    {
        categoria: 'juegos',
        titulo: 'Juego RPG',
        descripcion: 'Juego.',
        ruta: 'mon/index.html'
    }
];

function cargarProyectos() {
    proyectos.forEach(proy => {
        const grid = document.getElementById(`grid-${proy.categoria}`);
        
        if (grid) {
            const card = document.createElement('div');
            card.className = 'card';
            
            card.innerHTML = `
                <h4>${proy.titulo}</h4>
                <p>${proy.descripcion}</p>
                <a href="${proy.ruta}" target="_blank">Abrir Proyecto</a>
            `;
            
            grid.appendChild(card);
        }
    });
}

// Ejecutar cuando cargue la web
document.addEventListener('DOMContentLoaded', cargarProyectos);