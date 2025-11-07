#!/bin/bash
# Railway Launch Script

cd backend

# Install dependencies
pip install -r requirements.txt

# Run using Gunicorn + factory pattern
gunicorn --bind 0.0.0.0:$PORT "app:create_app()"