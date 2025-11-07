#!/bin/bash
# Railway Launch Script

cd backend

# Install deps if needed
pip install -r requirements.txt

# Run the app
gunicorn app:app --bind 0.0.0.0:$PORT
    