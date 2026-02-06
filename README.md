# OjosParaCiego - Asistente Visual para Personas Ciegas

Aplicación PWA que utiliza gafas inteligentes Bluetooth y Claude Vision AI para asistir a personas ciegas con navegación y búsqueda de objetos.

## Características

- **Modo Navegación**: Detecta obstáculos en tiempo real mientras el usuario camina
- **Modo Búsqueda**: Localiza objetos específicos por comando de voz
- **Audio en tiempo real**: Instrucciones habladas usando Google Cloud TTS
- **PWA**: Funciona en Android e iOS como aplicación instalable

## Requisitos

- Python 3.11+
- Node.js (opcional, para desarrollo)
- Docker y Docker Compose
- API Key de Anthropic (Claude)
- Credenciales de Google Cloud (TTS)
- VPS con dominio y SSL

## Instalación Rápida

### 1. Clonar y configurar

```bash
cd /opt
git clone <repository-url> ojosparaciego
cd ojosparaciego

# Copiar archivo de configuración
cp .env.example .env
nano .env  # Editar con tus credenciales
```

### 2. Configurar credenciales de Google Cloud

```bash
mkdir -p credentials
# Copiar tu archivo de credenciales de Google Cloud
cp /path/to/google-credentials.json credentials/
```

### 3. Configurar SSL con Let's Encrypt

```bash
# Reemplazar yourdomain.com con tu dominio real
export DOMAIN=yourdomain.com
export EMAIL=tu@email.com

# Crear directorios para certificados
mkdir -p certbot/conf certbot/www

# Obtener certificado inicial (sin Docker primero)
docker run -it --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/certbot/www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d $DOMAIN --email $EMAIL --agree-tos --no-eff-email
```

### 4. Actualizar configuración de Nginx

Editar `nginx/nginx.conf` y reemplazar `yourdomain.com` con tu dominio real.

### 5. Iniciar servicios

```bash
docker-compose up -d
```

### 6. Verificar funcionamiento

```bash
# Ver logs
docker-compose logs -f

# Verificar estado
curl https://tudominio.com/health
```

## Desarrollo Local

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# o: venv\Scripts\activate  # Windows

pip install -r requirements.txt

# Crear archivo .env
cp .env.example .env
# Editar .env con tus API keys

# Ejecutar
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

Para desarrollo local, puedes servir los archivos estáticos con cualquier servidor HTTP:

```bash
cd frontend
python -m http.server 3000
```

**Nota**: Para probar cámara y micrófono en desarrollo, necesitas HTTPS o usar localhost.

## Uso

1. **Conectar gafas**: Empareja las gafas inteligentes con tu teléfono via Bluetooth
2. **Abrir la app**: Navega a https://tudominio.com en el navegador del teléfono
3. **Permitir acceso**: Concede permisos de cámara y micrófono
4. **Colocar teléfono**: Coloca el teléfono en un soporte colgante con la cámara frontal apuntando al frente
5. **Iniciar navegación**: Toca el botón "Navegación" para comenzar

### Controles de voz

- "Buscar vaso" - Busca un vaso en la escena
- "Buscar puerta" - Localiza una puerta
- "Buscar [objeto]" - Busca cualquier objeto

### Controles de las gafas

- **Doble toque derecho**: Activa el asistente de voz
- **Presionar 2 seg izquierdo**: Análisis instantáneo
- **Toque simple**: Pausar/reanudar

## Estructura del Proyecto

```
ojosparaciego/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app
│   │   ├── config.py         # Configuración
│   │   ├── services/
│   │   │   ├── vision.py     # Claude Vision
│   │   │   └── tts.py        # Google TTS
│   │   └── models/
│   │       └── schemas.py    # Modelos Pydantic
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── index.html            # PWA principal
│   ├── css/styles.css        # Estilos accesibles
│   ├── js/
│   │   ├── app.js            # Lógica principal
│   │   ├── camera.js         # Captura de cámara
│   │   ├── speech.js         # STT y audio
│   │   └── websocket.js      # Comunicación
│   ├── manifest.json         # PWA manifest
│   └── sw.js                 # Service Worker
├── nginx/
│   └── nginx.conf            # Configuración Nginx
├── docker-compose.yml
└── README.md
```

## API Endpoints

- `GET /` - Estado del servidor
- `GET /health` - Health check
- `WS /ws` - WebSocket para comunicación en tiempo real

## Solución de Problemas

### La cámara no funciona
- Verifica que estás usando HTTPS
- Revisa los permisos del navegador
- Intenta con otro navegador

### No hay audio
- Verifica la conexión Bluetooth de las gafas
- Aumenta el volumen del teléfono
- Revisa que Google Cloud TTS esté configurado

### Error de conexión WebSocket
- Verifica que el backend está corriendo
- Revisa los logs: `docker-compose logs backend`
- Comprueba la configuración de Nginx

## Licencia

MIT License - Ver archivo LICENSE para detalles.
