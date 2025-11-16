# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy backend folder (including requirements.txt)
COPY backend/ ./backend

# Install dependencies
RUN pip install --upgrade pip
RUN pip install -r backend/requirements.txt
RUN pip install gunicorn

# Expose the port Railway will use
EXPOSE 8000

# Set environment variable for Flask (optional)
ENV FLASK_APP=app

# Start the app
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "backend.app:create_app()"]