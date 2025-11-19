# Multi-stage build for Python 3.11.6 on Render
# Stage 1: Builder - compile dependencies
FROM python:3.11.6-slim as builder

WORKDIR /app

# Install build essentials needed for wheel compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first (better Docker caching)
COPY backend/requirements.txt .

# Create wheels in a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip and install wheels (with verbose output for debugging)
RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --prefer-binary -r requirements.txt

# Stage 2: Runtime - lean production image
FROM python:3.11.6-slim

WORKDIR /app

# Install only runtime dependencies (smaller image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Copy application code
COPY backend/ ./backend

# Set environment
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    FLASK_APP=backend.app

# Expose Render default port
EXPOSE 10000

# Health check for Render
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:10000/', timeout=2)"

# Start gunicorn with optimized worker configuration
CMD ["gunicorn", \
     "--bind", "0.0.0.0:10000", \
     "--workers", "2", \
     "--threads", "2", \
     "--worker-class", "gthread", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--chdir", "/app/backend", \
     "app:app"]