# Marion Web OS - Docker Image
# Multi-stage build for minimal image size

# ============================================================================
# Stage 1: Build frontend
# ============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Copy all source files and build
COPY . .
RUN npm run build

# ============================================================================
# Stage 2: Python runtime
# ============================================================================
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY franck_server.py config.py crypto_utils.py ./
COPY database/ ./database/
COPY api/ ./api/
COPY services/ ./services/

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/.dist ./.dist

# Copy static assets
COPY public/ ./public/

# Create data directory for persistent storage
RUN mkdir -p /data

# Non-root user for security
RUN useradd --create-home --shell /bin/bash marion && \
    chown -R marion:marion /app /data
USER marion

# Environment variables for production
ENV FLASK_ENV=production \
    ENV=production \
    PORT=5003 \
    HOST=0.0.0.0 \
    DATA_PATH=/data \
    DATABASE_URL=sqlite:////data/marion.db \
    STATIC_FOLDER=.dist \
    PYTHONUNBUFFERED=1 \
    LOG_LEVEL=WARNING

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:5003/api/v1/health || exit 1

# Expose port
EXPOSE 5003

# Volume for persistent data (database, uploads, etc.)
VOLUME ["/data"]

# Run with gunicorn in production
CMD ["gunicorn", "franck_server:app", \
     "--bind", "0.0.0.0:5003", \
     "--workers", "2", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
