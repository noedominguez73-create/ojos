/**
 * WebSocket Manager for OjosParaCiego
 */

class WebSocketManager {
    constructor(url) {
        this.url = url;
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.pingInterval = null;
        this.onMessageCallback = null;
        this.onStatusChangeCallback = null;
    }

    connect() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }

        this.updateStatus('connecting');
        console.log('Connecting to WebSocket:', this.url);

        try {
            this.socket = new WebSocket(this.url);

            this.socket.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.updateStatus('connected');
                this.startPing();
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type !== 'pong' && this.onMessageCallback) {
                        this.onMessageCallback(data);
                    }
                } catch (e) {
                    console.error('Error parsing message:', e);
                }
            };

            this.socket.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                this.updateStatus('disconnected');
                this.stopPing();
                this.attemptReconnect();
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateStatus('disconnected');
            };

        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.updateStatus('disconnected');
            this.attemptReconnect();
        }
    }

    disconnect() {
        this.stopPing();
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.updateStatus('disconnected');
    }

    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
            return true;
        }
        console.warn('WebSocket not connected, cannot send message');
        return false;
    }

    sendFrame(imageBase64, mode = 'navigation', searchObject = null) {
        return this.send({
            type: 'frame',
            data: {
                image: imageBase64,
                mode: mode,
                searchObject: searchObject
            }
        });
    }

    sendCommand(command, searchObject = null) {
        return this.send({
            type: 'command',
            data: {
                command: command,
                searchObject: searchObject
            }
        });
    }

    startPing() {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            this.send({ type: 'ping' });
        }, 30000);
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Reconnecting attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay * this.reconnectAttempts);
    }

    updateStatus(status) {
        if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback(status);
        }
    }

    onMessage(callback) {
        this.onMessageCallback = callback;
    }

    onStatusChange(callback) {
        this.onStatusChangeCallback = callback;
    }

    isConnected() {
        return this.socket && this.socket.readyState === WebSocket.OPEN;
    }
}

// Export for use in other modules
window.WebSocketManager = WebSocketManager;
