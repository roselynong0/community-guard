"""
Main Flask Application
Community Guard Backend API
"""
import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_caching import Cache
from flask_compress import Compress
from werkzeug.exceptions import HTTPException
import traceback

from config import Config
from routes.auth import auth_bp
from routes.profile import profile_bp
from routes.sessions import sessions_bp
from routes.verification import verification_bp
from routes.reports import reports_bp
from routes.admin import admin_bp
from routes.notifications import notifications_bp


def create_app():
    """Application factory"""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(Config)
    
    # Initialize CORS with proper configuration for Vercel
    CORS(app, 
         resources={r"/*": {"origins": "*"}},
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    
    cache = Cache(app, config={
        'CACHE_TYPE': Config.CACHE_TYPE,
        'CACHE_DEFAULT_TIMEOUT': Config.CACHE_DEFAULT_TIMEOUT
    })
    Compress(app)
    
    # Register blueprints with /api prefix
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(profile_bp, url_prefix='/api')
    app.register_blueprint(sessions_bp, url_prefix='/api')
    app.register_blueprint(verification_bp, url_prefix='/api')
    app.register_blueprint(reports_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(notifications_bp, url_prefix='/api')
    
    # Health check endpoint
    @app.route("/api/health")
    def health_check():
        return jsonify({"status": "ok", "message": "Community Guard API is running"}), 200
    
    # Serve uploaded files
    @app.route("/api/uploads/<filename>")
    def uploaded_file(filename):
        return send_from_directory(Config.UPLOAD_FOLDER, filename)
    
    # Backwards-compatible alias: some clients request /uploads/<filename> (without /api prefix)
    @app.route("/uploads/<filename>")
    def uploaded_file_public(filename):
        return send_from_directory(Config.UPLOAD_FOLDER, filename)
    
    # Global error handler
    @app.errorhandler(Exception)
    def handle_global_exception(e):
        if isinstance(e, HTTPException):
            return jsonify({
                "status": "error",
                "message": e.description
            }), e.code

        print("\n=== Global exception ===")
        print(traceback.format_exc())
        return jsonify({"status": "error", "message": "Unexpected error occurred"}), 500
    
    return app


# Create app instance
app = create_app()


if __name__ == "__main__":
    # Ensure uploads directory exists
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    
    # Run the application
    app.run(
        debug=Config.DEBUG,
        port=Config.PORT,
        host='0.0.0.0'
    )
