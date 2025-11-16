#!/bin/bash
cd backend
gunicorn --bind 0.0.0.0:$PORT "app:create_app()"