FROM python:3.11-slim

WORKDIR /app

# Copy backend requirements and install
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy all application code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Set working directory to backend
WORKDIR /app/backend

# Railway uses dynamic PORT - default to 8080
ENV PORT=8080
EXPOSE 8080

# Run the application with dynamic port
CMD python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
