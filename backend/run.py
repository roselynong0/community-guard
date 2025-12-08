"""
Backend Entry Point
Run this file to start the Flask application
Usage: python run.py
"""
import sys
import os

# Add the parent directory to Python path so we can import from backend package
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app

if __name__ == "__main__":
    app = create_app()
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )
