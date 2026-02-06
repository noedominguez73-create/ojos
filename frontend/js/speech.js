/**
 * Speech Manager for OjosParaCiego
 * Handles speech recognition (STT) and audio playback
 */

class SpeechManager {
    constructor() {
        this.recognition = null;
        this.audioPlayer = document.getElementById('audio-player');
        this.isListening = false;
        this.onResultCallback = null;
        this.onErrorCallback = null;

        // Initialize speech recognition
        this.initializeRecognition();
    }

    initializeRecognition() {
        // Check for Web Speech API support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('Speech recognition not supported');
            return;
        }

        this.recognition = new SpeechRecognition();

        // Configuration
        this.recognition.lang = 'es-ES';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;

        // Event handlers
        this.recognition.onresult = (event) => {
            const result = event.results[0][0];
            const transcript = result.transcript.toLowerCase().trim();
            const confidence = result.confidence;

            console.log('Speech recognized:', transcript, 'Confidence:', confidence);

            if (this.onResultCallback) {
                this.onResultCallback(transcript, confidence);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);

            if (this.onErrorCallback) {
                this.onErrorCallback(event.error);
            }

            this.isListening = false;
        };

        this.recognition.onend = () => {
            this.isListening = false;
        };

        console.log('Speech recognition initialized');
    }

    startListening() {
        if (!this.recognition) {
            console.error('Speech recognition not available');
            return false;
        }

        if (this.isListening) {
            return true;
        }

        try {
            this.recognition.start();
            this.isListening = true;
            console.log('Started listening');
            return true;
        } catch (error) {
            console.error('Failed to start listening:', error);
            return false;
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
            console.log('Stopped listening');
        }
    }

    onResult(callback) {
        this.onResultCallback = callback;
    }

    onError(callback) {
        this.onErrorCallback = callback;
    }

    async playAudio(base64Audio) {
        if (!base64Audio) {
            return;
        }

        try {
            // Create blob from base64
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'audio/mp3' });

            // Create URL and play
            const url = URL.createObjectURL(blob);
            this.audioPlayer.src = url;

            await this.audioPlayer.play();

            // Clean up URL after playback
            this.audioPlayer.onended = () => {
                URL.revokeObjectURL(url);
            };

        } catch (error) {
            console.error('Error playing audio:', error);
        }
    }

    stopAudio() {
        if (this.audioPlayer) {
            this.audioPlayer.pause();
            this.audioPlayer.currentTime = 0;
        }
    }

    // Fallback TTS using Web Speech API
    speak(text) {
        if (!('speechSynthesis' in window)) {
            console.warn('Speech synthesis not supported');
            return;
        }

        // Cancel any ongoing speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 1.1;
        utterance.pitch = 1;
        utterance.volume = 1;

        // Try to find a Spanish voice
        const voices = speechSynthesis.getVoices();
        const spanishVoice = voices.find(voice =>
            voice.lang.startsWith('es') && voice.localService
        );
        if (spanishVoice) {
            utterance.voice = spanishVoice;
        }

        speechSynthesis.speak(utterance);
    }

    parseSearchCommand(transcript) {
        // Common patterns for search commands
        const searchPatterns = [
            /^buscar?\s+(.+)$/i,
            /^busco\s+(.+)$/i,
            /^encontrar?\s+(.+)$/i,
            /^donde\s+est[aá]\s+(.+)$/i,
            /^d[oó]nde\s+hay\s+(.+)$/i,
            /^localizar?\s+(.+)$/i
        ];

        for (const pattern of searchPatterns) {
            const match = transcript.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        return null;
    }

    isSupported() {
        return {
            recognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
            synthesis: 'speechSynthesis' in window
        };
    }
}

// Export for use in other modules
window.SpeechManager = SpeechManager;
