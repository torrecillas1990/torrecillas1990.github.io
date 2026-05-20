// Carga Aubio desde un CDN o local
import Aubio from 'aubiojs';

let pitchDetector;

export async function initAnalysis(audioContext) {
    const audio = await Aubio();
    pitchDetector = new audio.Pitch("default", 2048, 512, audioContext.sampleRate);
}

export function processAudio(buffer) {
    const pitch = pitchDetector.do(buffer);
    return {
        pitch: pitch > 0 ? pitch : null, // Filtra silencios
        timestamp: Date.now()
    };
}