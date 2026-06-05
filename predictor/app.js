document.addEventListener('DOMContentLoaded', () => {
    const jsonInput = document.getElementById('json-input');
    const uploadText = document.getElementById('upload-text');
    const resultsSection = document.getElementById('results-section');
    
    const analysisMode = document.getElementById('analysis-mode');
    const setSizeContainer = document.getElementById('set-size-container');
    const setSizeInput = document.getElementById('set-size');
    const ignoreOrderCheckbox = document.getElementById('ignore-order-checkbox');
    const forceAscendingCheckbox = document.getElementById('force-ascending-checkbox'); // Nuevo control
    
    const statTotal = document.getElementById('stat-total');
    const statLast = document.getElementById('stat-last');
    const statMethod = document.getElementById('stat-method');
    const atomicSummaryContainer = document.getElementById('atomic-summary-container'); // Panel UI atómico
    const tableBody = document.getElementById('probability-table-body');
    
    let chartInstance = null;
    let cachedData = null;

    jsonInput.addEventListener('change', handleFileSelect);
    analysisMode.addEventListener('change', () => {
        setSizeContainer.classList.toggle('hidden', analysisMode.value !== 'set');
        processExecution();
    });
    setSizeInput.addEventListener('input', processExecution);
    ignoreOrderCheckbox.addEventListener('change', processExecution);
    forceAscendingCheckbox.addEventListener('change', processExecution);

	function handleFileSelect(event) {
		const file = event.target.files[0];
		if (!file) {
			console.log("No se seleccionó ningún archivo.");
			return;
		}

		uploadText.innerText = `Leyendo: ${file.name}...`;
		console.log("Archivo detectado:", file.name, "Tamaño:", file.size, "bytes");

		const reader = new FileReader();
		reader.onload = function(e) {
			try {
				const rawText = e.target.result;
				console.log("Contenido crudo del archivo cargado:", rawText.substring(0, 100)); // Log preliminar
				
				const parsedJson = JSON.parse(rawText);
				
				// Forzar detección tanto si es un array plano como si viene envuelto en un objeto { data: [...] }
				cachedData = Array.isArray(parsedJson) ? parsedJson : (parsedJson.data || parsedJson.sequence || null);

				if (!cachedData || !Array.isArray(cachedData)) {
					throw new Error("El archivo JSON válido debe contener un Array de números o de conjuntos. Ejemplo: [1,2,3] o [[1,2],[3,4]]");
				}

				console.log("Datos parseados con éxito. Total elementos:", cachedData.length);
				uploadText.innerText = `Cargado: ${file.name}`;
				
				// Forzar ejecución
				processExecution();

			} catch (error) {
				console.error("Error crítico en la lectura:", error);
				alert(`Error en el formato del JSON: ${error.message}`);
				uploadText.innerText = "Error de formato. Reintenta.";
				resultsSection.classList.add('hidden');
				cachedData = null;
			}
		};
		
		reader.onerror = function() {
			alert("Error físico al leer el archivo desde el disco.");
		};

		reader.readAsText(file);
	}

    function processExecution() {
        if (!cachedData) return;
        try {
            const options = {
                mode: analysisMode.value,
                setSize: parseInt(setSizeInput.value) || 3,
                ignoreInternalOrder: ignoreOrderCheckbox.checked,
                forceAscendingOrder: forceAscendingCheckbox.checked
            };

            const predictor = new SequencePredictor(cachedData, options);
            const results = predictor.predictNext();
            displayResults(results);
        } catch (err) {
            statMethod.innerText = "Configuración no válida o datos insuficientes.";
        }
    }

    function displayResults(results) {
        resultsSection.classList.remove('hidden');
        statTotal.innerText = results.totalElements;
        statLast.innerText = results.lastItemDisplay;
        statMethod.innerText = results.methodUsed;

        // Renderizar el bloque de análisis atómico individual por posición
        atomicSummaryContainer.innerHTML = '';
        if (results.atomicReport && results.atomicReport.length > 0) {
            const title = document.createElement('h4');
            title.className = "text-xs font-bold text-gray-500 uppercase mb-2";
            title.innerText = "Análisis Atómico de Números por Posición Histórica:";
            atomicSummaryContainer.appendChild(title);

            results.atomicReport.forEach(text => {
                const p = document.createElement('p');
                p.className = "text-xs font-mono text-gray-600 bg-gray-50 border border-gray-200 p-1.5 rounded mb-1";
                p.innerText = text;
                atomicSummaryContainer.appendChild(p);
            });
            atomicSummaryContainer.classList.remove('hidden');
        } else {
            atomicSummaryContainer.classList.add('hidden');
        }

        // Renderizar tabla
        tableBody.innerHTML = '';
        if(results.predictions.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-xs text-gray-400">Ningún conjunto cumple los criterios de ordenación lineal (Menor a Mayor) establecidos.</td></tr>`;
        }

        results.predictions.slice(0, 12).forEach(pred => { 
            const row = document.createElement('tr');
            row.className = "border-b border-gray-100 hover:bg-gray-50 transition";
            row.innerHTML = `
                <td class="p-3 font-mono font-bold text-blue-950">${pred.displayValue}</td>
                <td class="p-3">
                    <div class="flex items-center gap-2">
                        <span class="font-semibold text-blue-600 w-12">${(pred.probability * 100).toFixed(1)}%</span>
                        <div class="w-full bg-gray-200 rounded-full h-2 max-w-xs">
                            <div class="bg-blue-600 h-2 rounded-full" style="width: ${pred.probability * 100}%"></div>
                        </div>
                    </div>
                </td>
                <td class="p-3 text-xs text-gray-500 italic">${pred.evidence}</td>
            `;
            tableBody.appendChild(row);
        });

        renderChart(results.predictions.slice(0, 6)); 
    }

    function renderChart(predictions) {
        const ctx = document.getElementById('probability-chart').getContext('2d');
        if (chartInstance) chartInstance.destroy();

        if (predictions.length === 0) return;

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: predictions.map(p => p.displayValue),
                datasets: [{
                    data: predictions.map(p => (p.probability * 100).toFixed(1)),
                    backgroundColor: 'rgba(37, 99, 235, 0.7)',
                    borderColor: 'rgb(37, 99, 235)',
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } },
                plugins: { legend: { display: false } }
            }
        });
    }
});