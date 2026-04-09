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

            // Buttons
            btnNavigation: document.getElementById('btn-navigation'), // El gigante
            btnSearch: document.getElementById('btn-search'),
            btnAnalyze: document.getElementById('btn-analyze'),
            btnStop: document.getElementById('btn-stop'),

            // Modals & UI
            voiceIndicator: document.getElementById('voice-indicator'),
            loadingOverlay: document.getElementById('loading-overlay'),
            errorModal: document.getElementById('error-modal'),
            errorMessage: document.getElementById('error-message'),
            errorClose: document.getElementById('error-close'),
            permissionModal: document.getElementById('permission-modal'),
            permissionGrant: document.getElementById('permission-grant')
        };

        // Only initialize connection and camera stuff if we are on the Control page
        if (this.elements.btnNavigation) {
            this.init();
        }
    }

    getWebSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname || 'localhost';
        let wsUrl;
        if (window.location.port === '3000') {
            wsUrl = `${protocol}//${host}:8000/ws`;
        } else if (window.location.port) {
            wsUrl = `${protocol}//${host}:${window.location.port}/ws`;
        } else {
            wsUrl = `${protocol}//${host}/ws`;
        }
        return wsUrl;
    }

    async init() {
        console.log('Initializing OjosParaCiego...');

        try {
            // Initialize managers FIRST
            this.wsManager = new WebSocketManager(this.config.wsUrl);
            this.cameraManager = new CameraManager();
            this.speechManager = new SpeechManager();
            console.log('Managers created');

            // Setup WebSocket callbacks
            this.wsManager.onStatusChange((status) => this.handleConnectionStatus(status));
            this.wsManager.onMessage((data) => this.handleServerMessage(data));

            // Setup speech callbacks
            this.speechManager.onResult((transcript, confidence) => {
                this.handleSpeechResult(transcript, confidence);
            });

            // Setup event listeners AFTER managers
            this.setupEventListeners();
            console.log('Event listeners set up');

            // Show permission modal
            this.showPermissionModal();
        } catch (error) {
            console.error('Init error:', error);
        }
    }

    setupEventListeners() {
        // Navigation button (Giant AI Button)
        if (this.elements.btnNavigation) {
            this.elements.btnNavigation.addEventListener('click', () => {
                if (this.state.mode === 'navigation') {
                    this.stopNavigation();
                } else {
                    this.startNavigation();
                }
            });
        }

        // Search button
        if (this.elements.btnSearch) {
            this.elements.btnSearch.addEventListener('click', () => {
                this.startSearch();
            });
        }

        // Analyze button
        if (this.elements.btnAnalyze) {
            this.elements.btnAnalyze.addEventListener('click', () => {
                this.analyzeOnce();
            });
        }

        // Stop button
        if (this.elements.btnStop) {
            this.elements.btnStop.addEventListener('click', () => {
                this.stopAllModes();
            });
        }

        // Error modal close
        const errorClose = this.elements.errorClose;
        if (errorClose) {
            errorClose.addEventListener('click', () => this.hideErrorModal());
        }

        // Permission grant button
        const permissionBtn = this.elements.permissionGrant;
        if (permissionBtn) {
            console.log('Permission button found');
            permissionBtn.addEventListener('click', async () => {
                console.log('Permission button clicked!');
                await this.requestPermissions();
            });
        } else {
            console.error('Permission button NOT found!');
        }

        // Handle visibility change (pause when app goes to background)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state.mode !== 'idle') {
                this.stopAllModes();
            }
        });
    }

    showPermissionModal() {
        if (this.elements.permissionModal) {
            this.elements.permissionModal.classList.remove('hidden');
        }
    }

    hidePermissionModal() {
        if (this.elements.permissionModal) {
            this.elements.permissionModal.classList.add('hidden');
        }
    }

    async requestPermissions() {
        console.log('requestPermissions called');
        this.showLoading();

        try {
            if (!this.cameraManager) {
                throw new Error('CameraManager no inicializado');
            }

            console.log('Initializing camera...');
            await this.cameraManager.initialize();
            console.log('Camera initialized');

            if (this.wsManager) {
                console.log('Connecting WebSocket...');
                this.wsManager.connect();
                console.log('WebSocket connecting');
            }

            this.state.hasPermissions = true;
            this.hidePermissionModal();
            this.updateResponse('Listo. Toca Navegación para comenzar.');
            console.log('Permissions granted successfully');

        } catch (error) {
            console.error('Permission error:', error);
            this.hidePermissionModal();
            this.showError('Error: ' + (error.message || 'No se pudo acceder a la cámara'));
        } finally {
            this.hideLoading();
        }
    }

    handleConnectionStatus(status) {
        this.state.isConnected = status === 'connected';

        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.className = `status ${status}`;
            this.elements.connectionStatus.textContent =
                status === 'connected' ? 'Conectado' :
                    status === 'connecting' ? 'Conectando...' : 'Desconectado';
        }
    }

    handleServerMessage(data) {
        if (data.type === 'error') {
            this.showError(data.message);
            return;
        }

        if (data.text) {
            this.updateResponse(data.text);

            if (data.audio_base64) {
                this.speechManager.playAudio(data.audio_base64);
            } else {
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
        this.updateModeDisplay('Navegación Activa');

        this.elements.btnNavigation.classList.add('active');
        this.elements.btnStop.classList.remove('hidden');

        this.speechManager.speak('Modo navegación activado');

        this.navigationInterval = setInterval(() => {
            this.captureAndSend('navigation');
        }, this.config.frameInterval);

        this.captureAndSend('navigation');
    }

    stopNavigation() {
        if (this.navigationInterval) {
            clearInterval(this.navigationInterval);
            this.navigationInterval = null;
        }

        this.state.mode = 'idle';
        this.updateModeDisplay('Inactivo');

        this.elements.btnNavigation.classList.remove('active');
        this.elements.btnStop.classList.add('hidden');

        this.speechManager.speak('Navegación detenida');
    }

    async startSearch() {
        if (!this.state.hasPermissions) {
            this.showError('Permisos no concedidos');
            return;
        }

        if (this.state.mode === 'navigation') {
            this.stopNavigation();
        }

        this.elements.voiceIndicator.classList.remove('hidden');
        this.speechManager.speak('¿Qué deseas buscar?');

        setTimeout(() => {
            this.speechManager.startListening();
        }, 1500);
    }

    handleSpeechResult(transcript, confidence) {
        this.elements.voiceIndicator.classList.add('hidden');

        const searchObject = this.speechManager.parseSearchCommand(transcript) || transcript;

        if (searchObject) {
            this.state.searchObject = searchObject;
            this.state.mode = 'search';
            this.updateModeDisplay(`Buscando: ${searchObject}`);
            this.speechManager.speak(`Buscando ${searchObject}`);
            this.elements.btnStop.classList.remove('hidden');

            this.navigationInterval = setInterval(() => {
                this.captureAndSend('search', searchObject);
            }, this.config.frameInterval);

            this.captureAndSend('search', searchObject);

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
        if (!this.cameraManager || !this.cameraManager.isReady()) {
            return;
        }

        const frame = this.cameraManager.captureFrame();
        if (frame) {
            this.wsManager.sendFrame(frame, mode, searchObject);
        }
    }

    stopAllModes() {
        if (this.navigationInterval) {
            clearInterval(this.navigationInterval);
            this.navigationInterval = null;
        }

        if (this.speechManager) {
            this.speechManager.stopListening();
            this.speechManager.stopAudio();
        }

        this.state.mode = 'idle';
        this.state.searchObject = null;

        this.updateModeDisplay('Inactivo');
        if (this.elements.btnNavigation) this.elements.btnNavigation.classList.remove('active');
        if (this.elements.btnStop) this.elements.btnStop.classList.add('hidden');
        if (this.elements.voiceIndicator) this.elements.voiceIndicator.classList.add('hidden');
    }

    updateModeDisplay(text) {
        if (this.elements.modeText) this.elements.modeText.textContent = text;
    }

    updateResponse(text) {
        if (this.elements.responseText) this.elements.responseText.textContent = text;
    }

    showLoading() {
        if (this.elements.loadingOverlay) this.elements.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        if (this.elements.loadingOverlay) this.elements.loadingOverlay.classList.add('hidden');
    }

    showError(message) {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.errorModal.classList.remove('hidden');
        } else {
            alert(message);
        }
    }

    hideErrorModal() {
        if (this.elements.errorModal) this.elements.errorModal.classList.add('hidden');
    }

    disconnect() {
        this.stopAllModes();

        if (this.wsManager) {
            this.wsManager.disconnect();
        }

        if (this.cameraManager) {
            this.cameraManager.stop();
        }

        this.state.hasPermissions = false;
        this.state.isConnected = false;

        this.updateResponse('Desconectado. Permite el acceso para reconectar.');
        if (this.speechManager) this.speechManager.speak('Desconectado');

        this.showPermissionModal();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new OjosParaCiegoApp();
});
