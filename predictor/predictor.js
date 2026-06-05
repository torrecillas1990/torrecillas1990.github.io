/**
 * Motor Predictivo Cuantitativo Nivel 4 (Definitivo)
 * Arquitectura: Markov O1+O2, Laplace, Z-Score Gaps, RSI/SMA, Entropía Dinámica, 
 * Bayes Cruzado y Auto-Optimización de Pesos (Grid Search Backtesting).
 */
class SequencePredictor {
    constructor(rawInput, options = {}) {
        if (!Array.isArray(rawInput) || rawInput.length === 0) {
            throw new Error("Los datos de entrada deben ser un array válido.");
        }

        this.mode = options.mode || 'auto'; 
        this.setSize = parseInt(options.setSize) || 3;
        this.forceAscendingOrder = options.forceAscendingOrder || false;

        let processedSequence = [];
        const inputIsAlreadySets = Array.isArray(rawInput[0]);

        if (this.mode === 'set' || (this.mode === 'auto' && inputIsAlreadySets)) {
            if (inputIsAlreadySets) {
                processedSequence = rawInput;
                this.setSize = rawInput[0].length;
            } else {
                processedSequence = [];
                for (let i = 0; i <= rawInput.length - this.setSize; i += this.setSize) {
                    processedSequence.push(rawInput.slice(i, i + this.setSize));
                }
            }
            this.isSetSeries = true;
        } else {
            processedSequence = rawInput.map(n => [Number(n)]);
            this.setSize = 1;
            this.isSetSeries = false;
        }

        this.sequence = processedSequence.map(set => set.map(Number).filter(n => !isNaN(n)));
        this.totalElements = this.sequence.length;

        if (this.totalElements < 5) {
            throw new Error("Se requieren al menos 5 registros para calibrar el motor estadístico.");
        }

        this.gapStats = this.isSetSeries ? this.calculateGapStatistics(this.sequence) : null;
        
        // Pesos dinámicos que serán sobreescritos por el optimizador
        this.optimalWeights = { global: 0.2, m1: 0.4, m2: 0.4 };
        this.calibrationReport = "";

        // Ejecutar Auto-Optimización antes de predecir el futuro
        this.calibrateWeights();
    }

    /**
     * OPTIMIZADOR GRID SEARCH: Simula el pasado para calibrar los pesos del futuro
     */
    calibrateWeights() {
        // Dividir datos: 80% entrenamiento, 20% validación (mínimo 2 bloques)
        const splitIndex = Math.max(3, Math.floor(this.totalElements * 0.8));
        const trainData = this.sequence.slice(0, splitIndex);
        const testData = this.sequence.slice(splitIndex);
        
        let bestScore = -1;
        let bestParams = { global: 0.33, m1: 0.33, m2: 0.34 };

        // Definir la malla de búsqueda (Grid) de combinaciones de pesos
        const steps = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
        
        steps.forEach(wG => {
            steps.forEach(wM1 => {
                const wM2 = 1.0 - wG - wM1;
                if (wM2 < 0.0 || wM2 > 1.0) return; // Descartar combinaciones inválidas

                let score = 0;
                
                // Simular paso a paso sobre el set de prueba
                const simHistory = [...trainData];
                for (let testIdx = 0; testIdx < testData.length; testIdx++) {
                    const actualNextBlock = testData[testIdx];
                    
                    // Predecir usando el historial simulado y los pesos actuales
                    let blockProb = 1.0;
                    for (let pos = 0; pos < this.setSize; pos++) {
                        const posHistory = simHistory.map(set => set[pos]);
                        const probMap = this.getRawProbabilities(posHistory, wG, wM1, wM2);
                        
                        // Si el número real estaba en nuestras predicciones, sumamos su probabilidad asignada
                        const actualNum = actualNextBlock[pos];
                        blockProb *= (probMap[actualNum] || 0);
                    }
                    score += blockProb;
                    simHistory.push(actualNextBlock); // Avanzar un paso temporal
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestParams = { global: wG, m1: wM1, m2: wM2 };
                }
            });
        });

        // Aplicar los pesos ganadores a la instancia
        this.optimalWeights = bestParams;
        this.calibrationReport = `Calibración Óptima ➔ Global: ${Math.round(bestParams.global*100)}% | Markov O1: ${Math.round(bestParams.m1*100)}% | Markov O2: ${Math.round(bestParams.m2*100)}%`;
    }

    calculateGapStatistics(dataset) {
        const stats = [];
        for (let i = 0; i < this.setSize - 1; i++) {
            const gaps = [];
            dataset.forEach(set => {
                if (set[i] !== undefined && set[i + 1] !== undefined) gaps.push(set[i + 1] - set[i]);
            });
            if (gaps.length === 0) continue;
            const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
            const stdDev = Math.sqrt(gaps.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / gaps.length);
            stats.push({ mean, stdDev });
        }
        return stats;
    }

    calculateSMA(history, period) {
        if (history.length < period) return null;
        return history.slice(-period).reduce((a, b) => a + b, 0) / period;
    }

    calculateRSI(history, period) {
        if (history.length <= period) return null;
        let gains = 0, losses = 0;
        const startIdx = history.length - period;
        for (let i = startIdx; i < history.length; i++) {
            const diff = history[i] - history[i - 1];
            if (diff > 0) gains += diff;
            else losses -= diff;
        }
        const avgGain = gains / period, avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        if (avgGain === 0) return 0;
        return 100 - (100 / (1 + (avgGain / avgLoss)));
    }

    calculateLocalVolatilityModifier(history, period = 5) {
        if (history.length < period) return 1.0;
        const slice = history.slice(-period);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        if (mean === 0) return 1.0;
        const stdDev = Math.sqrt(slice.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / period);
        const cv = stdDev / Math.abs(mean);
        if (cv > 0.8) return 0.5; 
        if (cv > 0.4) return 0.8; 
        return 1.0; 
    }

    getCrossConditionalProb(posA, valA, posB, valB) {
        let countA = 0, countAandB = 0;
        this.sequence.forEach(set => {
            if (set[posA] === valA) {
                countA++;
                if (set[posB] === valB) countAandB++;
            }
        });
        return (countAandB + 1.0) / ((countA / this.totalElements) + 2.0);
    }

    /**
     * Motor atómico puro extraído para reutilización en Backtest y Predicción final
     */
    getRawProbabilities(history, wG, wM1, wM2) {
        const total = history.length;
        if (total === 0) return {};

        const lastNum = history[total - 1];
        const prevLastNum = total >= 2 ? history[total - 2] : null;

        const globalCounts = {};
        const markov1Counts = {};
        const markov2Counts = {};
        let globalWeight = 0, markov1Weight = 0, markov2Weight = 0;

        const getWeight = (index) => 1 + (index / (total > 1 ? total - 1 : 1));

        for (let i = 0; i < total; i++) {
            const num = history[i];
            const w = getWeight(i);
            
            globalCounts[num] = (globalCounts[num] || 0) + w;
            globalWeight += w;

            if (i < total - 1 && history[i] === lastNum) {
                const next1 = history[i + 1];
                const w1 = getWeight(i + 1);
                markov1Counts[next1] = (markov1Counts[next1] || 0) + w1;
                markov1Weight += w1;
            }
            if (i < total - 2 && prevLastNum !== null && history[i] === prevLastNum && history[i + 1] === lastNum) {
                const next2 = history[i + 2];
                const w2 = getWeight(i + 2);
                markov2Counts[next2] = (markov2Counts[next2] || 0) + w2;
                markov2Weight += w2;
            }
        }

        const allNumbers = new Set([...Object.keys(globalCounts), ...Object.keys(markov1Counts), ...Object.keys(markov2Counts)]);
        const vocabSize = allNumbers.size;
        const alpha = 0.5;
        const probs = {};

        allNumbers.forEach(numStr => {
            const pGlobal = globalCounts[numStr] / globalWeight;
            const pM1 = ((markov1Counts[numStr] || 0) + alpha) / (markov1Weight + alpha * vocabSize);
            const pM2 = wM2 > 0 ? (((markov2Counts[numStr] || 0) + alpha) / (markov2Weight + alpha * vocabSize)) : 0;

            probs[numStr] = (pGlobal * wG) + (pM1 * wM1) + (pM2 * wM2);
        });

        return probs;
    }

    predictNextNumberForPosition(posIndex) {
        const history = this.sequence.map(set => set[posIndex]).filter(n => n !== undefined);
        const total = history.length;
        if (total === 0) return [];

        const lastNum = history[total - 1];
        const volatilityMod = this.calculateLocalVolatilityModifier(history);

        // Aplicar pesos óptimos calculados por el Backtest, ajustados por la volatilidad actual
        let wG = this.optimalWeights.global;
        let wM1 = this.optimalWeights.m1 * volatilityMod;
        let wM2 = this.optimalWeights.m2 * volatilityMod;
        
        // Re-balanceo si la volatilidad reduce el peso de Markov
        const diff = 1.0 - (wG + wM1 + wM2);
        wG += diff; 

        const rawProbs = this.getRawProbabilities(history, wG, wM1, wM2);
        
        const rsiPeriod = Math.min(14, Math.floor(total / 2)); 
        const smaPeriod = Math.min(5, Math.floor(total / 2));
        const currentRSI = rsiPeriod >= 2 ? this.calculateRSI(history, rsiPeriod) : null;
        const currentSMA = smaPeriod >= 2 ? this.calculateSMA(history, smaPeriod) : null;

        const candidates = [];
        Object.keys(rawProbs).forEach(numStr => {
            const num = parseInt(numStr);
            let baseProb = rawProbs[numStr];
            let momentumMultiplier = 1.0;
            let momentumLabel = "";

            if (currentRSI !== null && currentSMA !== null) {
                const isUptrend = num > lastNum;
                const isDowntrend = num < lastNum;

                if (currentRSI > 70 && isUptrend) {
                    momentumMultiplier = 0.6; momentumLabel = " (Pullback RSI)";
                } else if (currentRSI < 30 && isDowntrend) {
                    momentumMultiplier = 0.6; momentumLabel = " (Rebote RSI)";
                } else if (currentRSI >= 30 && currentRSI <= 70) {
                    if (lastNum > currentSMA && isUptrend) momentumMultiplier = 1.15;
                    else if (lastNum < currentSMA && isDowntrend) momentumMultiplier = 1.15;
                }
            }

            if (volatilityMod < 1.0) momentumLabel += " 🌪️(Entropía)";

            candidates.push({ 
                num, 
                probability: baseProb * momentumMultiplier,
                momentumLabel: momentumLabel.trim()
            });
        });

        return candidates.sort((a, b) => b.probability - a.probability);
    }

    predictNext() {
        const positionPredictions = [];
        for (let i = 0; i < this.setSize; i++) {
            positionPredictions.push(this.predictNextNumberForPosition(i));
        }

        let blocks = [ { set: [], prob: 1.0, tags: [] } ];

        positionPredictions.forEach((posCandidates, posIndex) => {
            const topCandidates = posCandidates.slice(0, 3);
            const nextBlocks = [];

            blocks.forEach(currentBlock => {
                topCandidates.forEach(candidate => {
                    const newSet = [...currentBlock.set, candidate.num];
                    let currentProb = currentBlock.prob * candidate.probability;
                    const newTags = [...currentBlock.tags];
                    if (candidate.momentumLabel) newTags.push(`P${posIndex+1}:${candidate.momentumLabel}`);

                    if (posIndex > 0) {
                        const valA = currentBlock.set[posIndex - 1];
                        const bayesMultiplier = this.getCrossConditionalProb(posIndex - 1, valA, posIndex, candidate.num);
                        currentProb *= bayesMultiplier;
                        if (bayesMultiplier > 1.5) newTags.push(`🔗 Bayes(P${posIndex}➜P${posIndex+1})`);
                    }

                    nextBlocks.push({ set: newSet, prob: currentProb, tags: newTags });
                });
            });
            blocks = nextBlocks;
        });

        if (this.isSetSeries && this.forceAscendingOrder) {
            blocks = blocks.filter(b => {
                for (let i = 0; i < b.set.length - 1; i++) {
                    if (b.set[i] >= b.set[i + 1]) return false;
                }
                return true;
            });
        }

        if (this.isSetSeries && this.gapStats) {
            blocks.forEach(b => {
                let penalty = 1.0;
                let penaltyEvidence = false;
                for (let i = 0; i < b.set.length - 1; i++) {
                    const gap = b.set[i + 1] - b.set[i];
                    const stats = this.gapStats[i];
                    if (stats && stats.stdDev > 0) {
                        const zScore = Math.abs(gap - stats.mean) / stats.stdDev;
                        if (zScore > 2.0) { penalty *= 0.5; penaltyEvidence = true; }
                        if (zScore > 3.0) penalty *= 0.1;
                    }
                }
                b.prob *= penalty;
                if (penaltyEvidence) b.hasPenalty = true;
            });
        }

        const totalProbSum = blocks.reduce((sum, b) => sum + b.prob, 0);
        
        const finalPredictions = blocks.map(b => {
            const normalizedProb = totalProbSum > 0 ? (b.prob / totalProbSum) : 0;
            let evidenceStr = b.set.map((num, idx) => `P${idx+1}:${num}`).join(' ➔ ');
            if (b.hasPenalty) evidenceStr += " | ⚠️ Anomalía Z-Score";
            if (b.tags.length > 0) evidenceStr += ` | ${[...new Set(b.tags)].join(' ')}`; 

            return {
                displayValue: this.isSetSeries ? `[ ${b.set.join(', ')} ]` : `Nº ${b.set[0]}`,
                probability: normalizedProb,
                evidence: evidenceStr
            };
        });

        finalPredictions.sort((a, b) => b.probability - a.probability);

        const atomicReport = [];
        atomicReport.push(`⚙️ ${this.calibrationReport}`); // Inyectar el reporte del optimizador arriba del todo
        
        positionPredictions.forEach((pos, i) => {
            const topStr = pos.slice(0, 2).map(c => `${c.num} (${Math.round(c.probability * 100)}%)`).join(', ');
            atomicReport.push(`Posición ${i + 1}: ${topStr}`);
        });

        const lastBlock = this.sequence[this.totalElements - 1];
        const lastBlockDisplay = this.isSetSeries ? `[ ${lastBlock.join(', ')} ]` : lastBlock[0];

        return {
            predictions: finalPredictions.slice(0, 15),
            methodUsed: "Híbrido Cuantitativo Auto-Calibrado (Grid Search)",
            totalElements: this.totalElements,
            lastItemDisplay: lastBlockDisplay,
            atomicReport: atomicReport
        };
    }
}