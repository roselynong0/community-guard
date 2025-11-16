# Use Python 3.11.6 slim image explicitly
FROM python:3.11.6-slim

# Set working directory
WORKDIR /app

# Copy backend folder
COPY backend/ ./backend

# Upgrade pip and install dependencies in one layer
RUN pip install --upgrade pip \
    && pip install -r backend/requirements.txt \
    && pip install gunicorn

# Expose Render default port
EXPOSE 10000

# Set environment variable for Flask (optional)
ENV FLASK_APP=backend.app

# Start the app using Gunicorn and Flask factory
CMD ["gunicorn", "--bind", "0.0.0.0:10000", "backend.app:create_app()"]