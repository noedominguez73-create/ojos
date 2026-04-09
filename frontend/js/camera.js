/**
 * Camera Manager for OjosParaCiego
 * Handles camera access and frame capture
 * Supports USB cameras and device selection
 */

class CameraManager {
    constructor() {
        this.video = document.getElementById('camera-preview');
        this.canvas = document.getElementById('capture-canvas');
        this.context = this.canvas ? this.canvas.getContext('2d') : null;
        this.stream = null;
        this.isInitialized = false;
        this.selectedDeviceId = null;

        // Camera settings - Higher resolution for better detection
        this.constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 15 }
            },
            audio: false
        };

        // Capture settings - Higher quality for better AI analysis
        this.captureWidth = 1280;
        this.captureHeight = 720;
        this.jpegQuality = 0.85;

        // Load saved camera preference
        this.loadSavedCamera();
    }

    loadSavedCamera() {
        const savedDeviceId = localStorage.getItem('selectedCameraId');
        if (savedDeviceId) {
            this.selectedDeviceId = savedDeviceId;
        }
    }

    saveSelectedCamera(deviceId) {
        localStorage.setItem('selectedCameraId', deviceId);
        this.selectedDeviceId = deviceId;
    }

    async listCameras() {
        try {
            // Request permission first to get device labels
            const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });

            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(device => device.kind === 'videoinput');

            // Stop the temporary stream
            tempStream.getTracks().forEach(track => track.stop());

            return cameras.map(camera => ({
                deviceId: camera.deviceId,
                label: camera.label || `Cámara ${cameras.indexOf(camera) + 1}`
            }));
        } catch (error) {
            console.error('Error listing cameras:', error);
            return [];
        }
    }

    setCamera(deviceId) {
        this.saveSelectedCamera(deviceId);
        if (this.isInitialized) {
            // Reinitialize with new camera
            this.stop();
            this.initialize();
        }
    }

    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        try {
            // Check for camera support
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera API not supported');
            }

            // Build constraints based on selected camera
            const constraints = { ...this.constraints };

            if (this.selectedDeviceId) {
                // Use specific camera by deviceId (USB camera or selected device)
                constraints.video = {
                    ...constraints.video,
                    deviceId: { exact: this.selectedDeviceId }
                };
            }

            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);

            // Set video source
            this.video.srcObject = this.stream;

            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    this.video.play()
                        .then(resolve)
                        .catch(reject);
                };
                this.video.onerror = reject;
            });

            // Set canvas dimensions
            this.canvas.width = this.captureWidth;
            this.canvas.height = this.captureHeight;

            this.isInitialized = true;
            console.log('Camera initialized successfully');
            return true;

        } catch (error) {
            console.error('Failed to initialize camera:', error);
            throw error;
        }
    }

    captureFrame() {
        if (!this.isInitialized || !this.video.videoWidth) {
            console.warn('Camera not ready for capture');
            return null;
        }

        try {
            // Draw video frame to canvas
            this.context.drawImage(
                this.video,
                0, 0,
                this.captureWidth,
                this.captureHeight
            );

            // Convert to base64 JPEG
            const dataUrl = this.canvas.toDataURL('image/jpeg', this.jpegQuality);

            // Extract base64 data (remove data URL prefix)
            const base64Data = dataUrl.split(',')[1];

            return base64Data;

        } catch (error) {
            console.error('Error capturing frame:', error);
            return null;
        }
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
        }

        if (this.video) {
            this.video.srcObject = null;
        }

        this.isInitialized = false;
        console.log('Camera stopped');
    }

    async switchCamera() {
        // Get list of cameras and switch to next one
        const cameras = await this.listCameras();
        if (cameras.length <= 1) {
            console.log('Only one camera available');
            return;
        }

        const currentIndex = cameras.findIndex(c => c.deviceId === this.selectedDeviceId);
        const nextIndex = (currentIndex + 1) % cameras.length;
        const nextCamera = cameras[nextIndex];

        this.setCamera(nextCamera.deviceId);
    }

    isReady() {
        return this.isInitialized && this.video.videoWidth > 0;
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            width: this.video?.videoWidth || 0,
            height: this.video?.videoHeight || 0,
            selectedDeviceId: this.selectedDeviceId
        };
    }

    async getCurrentCameraLabel() {
        const cameras = await this.listCameras();
        const current = cameras.find(c => c.deviceId === this.selectedDeviceId);
        return current ? current.label : 'Cámara por defecto';
    }
}

// Export for use in other modules
window.CameraManager = CameraManager;
