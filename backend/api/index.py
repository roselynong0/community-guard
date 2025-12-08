"""
Vercel Serverless Function Entry Point
Minimal test version to debug issues
"""
import sys
import os
from flask import Flask, jsonify

# Create a simple test app
app = Flask(__name__)

@app.route('/api/health')
def health():
    return jsonify({
        "status": "ok",
        "message": "API is working!",
        "python_version": sys.version,
        "cwd": os.getcwd()
    })

@app.route('/')
def root():
    return jsonify({"status": "ok", "message": "Root endpoint"})

# Try to import the real app
try:
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    from app import create_app
    app = create_app()
    print("✅ Successfully loaded full app")
except Exception as e:
    print(f"⚠️ Using minimal test app due to error: {e}")
    import traceback
    traceback.print_exc()
