/**
 * Camera Manager for OjosParaCiego
 * Handles camera access and frame capture
 */

class CameraManager {
    constructor() {
        this.video = document.getElementById('camera-preview');
        this.canvas = document.getElementById('capture-canvas');
        this.context = this.canvas.getContext('2d');
        this.stream = null;
        this.isInitialized = false;

        // Camera settings - Higher resolution for better detection
        this.constraints = {
            video: {
                facingMode: 'user', // Front camera
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

            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia(this.constraints);

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
        // Toggle between front and back camera
        const currentFacing = this.constraints.video.facingMode;
        this.constraints.video.facingMode = currentFacing === 'user' ? 'environment' : 'user';

        // Reinitialize with new camera
        this.stop();
        await this.initialize();
    }

    isReady() {
        return this.isInitialized && this.video.videoWidth > 0;
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            width: this.video?.videoWidth || 0,
            height: this.video?.videoHeight || 0,
            facingMode: this.constraints.video.facingMode
        };
    }
}

// Export for use in other modules
window.CameraManager = CameraManager;
