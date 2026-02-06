/**
 * OjosParaCiego - Main Application
 * Integrates camera, speech, and WebSocket for blind assistance
 */

class OjosParaCiegoApp {
    constructor() {
        // Configuration
        this.config = {
            wsUrl: this.getWebSocketUrl(),
            frameInterval: 1500, // ms between frames in navigation mode
            searchTimeout: 30000 // ms timeout for search mode
        };

        // State
        this.state = {
            mode: 'idle', // idle, navigation, search
            isConnected: false,
            hasPermissions: false,
            searchObject: null
        };

        // Managers
        this.wsManager = null;
        this.cameraManager = null;
        this.speechManager = null;

        // Intervals
        this.navigationInterval = null;

        // DOM Elements
        this.elements = {
            connectionStatus: document.getElementById('connection-status'),
            modeText: document.getElementById('mode-text'),
            responseText: document.getElementById('response-text'),
            btnNavigation: document.getElementById('btn-navigation'),
            btnSearch: document.getElementById('btn-search'),
            btnAnalyze: document.getElementById('btn-analyze'),
            btnStop: document.getElementById('btn-stop'),
            voiceIndicator: document.getElementById('voice-indicator'),
            loadingOverlay: document.getElementById('loading-overlay'),
            errorModal: document.getElementById('error-modal'),
            errorMessage: document.getElementById('error-message'),
            errorClose: document.getElementById('error-close'),
            permissionModal: document.getElementById('permission-modal'),
            permissionGrant: document.getElementById('permission-grant')
        };

        // Initialize
        this.init();
    }

    getWebSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname || 'localhost';
        // In production (Railway), no port needed. In dev, use 8000
        let wsUrl;
        if (window.location.port === '3000') {
            // Local development: frontend on 3000, backend on 8000
            wsUrl = `${protocol}//${host}:8000/ws`;
        } else if (window.location.port) {
            // Local with custom port
            wsUrl = `${protocol}//${host}:${window.location.port}/ws`;
        } else {
            // Production (Railway) - no port needed
            wsUrl = `${protocol}//${host}/ws`;
        }
        console.log('WebSocket URL:', wsUrl);
        return wsUrl;
    }

    async init() {
        console.log('Initializing OjosParaCiego...');

        // Setup event listeners
        this.setupEventListeners();

        // Initialize managers
        this.wsManager = new WebSocketManager(this.config.wsUrl);
        this.cameraManager = new CameraManager();
        this.speechManager = new SpeechManager();

        // Setup WebSocket callbacks
        this.wsManager.onStatusChange((status) => this.handleConnectionStatus(status));
        this.wsManager.onMessage((data) => this.handleServerMessage(data));

        // Setup speech callbacks
        this.speechManager.onResult((transcript, confidence) => {
            this.handleSpeechResult(transcript, confidence);
        });

        // Show permission modal
        this.showPermissionModal();
    }

    setupEventListeners() {
        // Navigation button
        this.elements.btnNavigation.addEventListener('click', () => {
            if (this.state.mode === 'navigation') {
                this.stopNavigation();
            } else {
                this.startNavigation();
            }
        });

        // Search button
        this.elements.btnSearch.addEventListener('click', () => {
            this.startSearch();
        });

        // Analyze button (single frame)
        this.elements.btnAnalyze.addEventListener('click', () => {
            this.analyzeOnce();
        });

        // Stop button
        this.elements.btnStop.addEventListener('click', () => {
            this.stopAllModes();
        });

        // Error modal close
        this.elements.errorClose.addEventListener('click', () => {
            this.hideErrorModal();
        });

        // Permission grant button
        this.elements.permissionGrant.addEventListener('click', () => {
            this.requestPermissions();
        });

        // Handle visibility change (pause when app goes to background)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state.mode !== 'idle') {
                this.stopAllModes();
            }
        });
    }

    showPermissionModal() {
        this.elements.permissionModal.classList.remove('hidden');
    }

    hidePermissionModal() {
        this.elements.permissionModal.classList.add('hidden');
    }

    async requestPermissions() {
        this.showLoading();

        try {
            // Initialize camera (requests permission)
            await this.cameraManager.initialize();

            // Connect WebSocket
            this.wsManager.connect();

            this.state.hasPermissions = true;
            this.hidePermissionModal();
            this.updateResponse('Listo. Toca Navegación para comenzar.');

        } catch (error) {
            console.error('Permission error:', error);
            this.showError('No se pudo acceder a la cámara. Por favor, permite el acceso en la configuración del navegador.');
        } finally {
            this.hideLoading();
        }
    }

    handleConnectionStatus(status) {
        this.state.isConnected = status === 'connected';

        // Update UI
        this.elements.connectionStatus.className = `status ${status}`;
        this.elements.connectionStatus.textContent =
            status === 'connected' ? 'Conectado' :
            status === 'connecting' ? 'Conectando...' : 'Desconectado';
    }

    handleServerMessage(data) {
        console.log('Server message:', data);

        if (data.type === 'error') {
            this.showError(data.message);
            return;
        }

        // Handle analysis response
        if (data.text) {
            this.updateResponse(data.text);

            // Play audio if available
            if (data.audio_base64) {
                this.speechManager.playAudio(data.audio_base64);
            } else {
                // Fallback to Web Speech API
                this.speechManager.speak(data.text);
            }
        }
    }

    async startNavigation() {
        if (!this.state.hasPermissions || !this.state.isConnected) {
            this.showError('No hay conexión. Verifica tu internet.');
            return;
        }

        this.state.mode = 'navigation';
        this.updateModeDisplay('Navegación');

        // Update buttons
        this.elements.btnNavigation.classList.add('active');
        this.elements.btnStop.classList.remove('hidden');

        // Announce start
        this.speechManager.speak('Modo navegación activado');

        // Start continuous frame capture
        this.navigationInterval = setInterval(() => {
            this.captureAndSend('navigation');
        }, this.config.frameInterval);

        // Capture first frame immediately
        this.captureAndSend('navigation');
    }

    stopNavigation() {
        if (this.navigationInterval) {
            clearInterval(this.navigationInterval);
            this.navigationInterval = null;
        }

        this.state.mode = 'idle';
        this.updateModeDisplay('Inactivo');

        // Update buttons
        this.elements.btnNavigation.classList.remove('active');
        this.elements.btnStop.classList.add('hidden');

        this.speechManager.speak('Navegación detenida');
    }

    async startSearch() {
        if (!this.state.hasPermissions) {
            this.showError('Permisos no concedidos');
            return;
        }

        // Stop navigation if running
        if (this.state.mode === 'navigation') {
            this.stopNavigation();
        }

        // Show voice indicator
        this.elements.voiceIndicator.classList.remove('hidden');
        this.speechManager.speak('¿Qué deseas buscar?');

        // Start listening
        setTimeout(() => {
            this.speechManager.startListening();
        }, 1500);
    }

    handleSpeechResult(transcript, confidence) {
        console.log('Speech result:', transcript);

        // Hide voice indicator
        this.elements.voiceIndicator.classList.add('hidden');

        // Parse search command
        const searchObject = this.speechManager.parseSearchCommand(transcript) || transcript;

        if (searchObject) {
            this.state.searchObject = searchObject;
            this.state.mode = 'search';
            this.updateModeDisplay(`Buscando: ${searchObject}`);
            this.speechManager.speak(`Buscando ${searchObject}`);
            this.elements.btnStop.classList.remove('hidden');

            // Start search with continuous frame capture
            this.navigationInterval = setInterval(() => {
                this.captureAndSend('search', searchObject);
            }, this.config.frameInterval);

            // Capture first frame immediately
            this.captureAndSend('search', searchObject);

            // Set timeout for search
            setTimeout(() => {
                if (this.state.mode === 'search') {
                    this.stopAllModes();
                    this.speechManager.speak('Búsqueda finalizada');
                }
            }, this.config.searchTimeout);
        }
    }

    async analyzeOnce() {
        if (!this.state.hasPermissions || !this.state.isConnected) {
            this.showError('No hay conexión');
            return;
        }

        this.showLoading();
        this.speechManager.speak('Analizando');

        await this.captureAndSend('navigation');

        this.hideLoading();
    }

    async captureAndSend(mode, searchObject = null) {
        if (!this.cameraManager.isReady()) {
            console.warn('Camera not ready');
            return;
        }

        const frame = this.cameraManager.captureFrame();
        if (frame) {
            this.wsManager.sendFrame(frame, mode, searchObject);
        }
    }

    stopAllModes() {
        // Stop navigation interval
        if (this.navigationInterval) {
            clearInterval(this.navigationInterval);
            this.navigationInterval = null;
        }

        // Stop speech
        this.speechManager.stopListening();
        this.speechManager.stopAudio();

        // Reset state
        this.state.mode = 'idle';
        this.state.searchObject = null;

        // Update UI
        this.updateModeDisplay('Inactivo');
        this.elements.btnNavigation.classList.remove('active');
        this.elements.btnStop.classList.add('hidden');
        this.elements.voiceIndicator.classList.add('hidden');
    }

    updateModeDisplay(text) {
        this.elements.modeText.textContent = text;
    }

    updateResponse(text) {
        this.elements.responseText.textContent = text;
    }

    showLoading() {
        this.elements.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        this.elements.loadingOverlay.classList.add('hidden');
    }

    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorModal.classList.remove('hidden');
    }

    hideErrorModal() {
        this.elements.errorModal.classList.add('hidden');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new OjosParaCiegoApp();
});
