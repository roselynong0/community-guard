#!/bin/bash
pip3 install -r requirements.txt
cd backend
gunicorn --bind 0.0.0.0:$PORT "app:create_app()"
