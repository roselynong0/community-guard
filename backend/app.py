"""
Main Flask Application
Community Guard Backend API
"""
import os
import sys

# Add the backend directory to the Python path for Vercel
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_caching import Cache
from flask_compress import Compress
from werkzeug.exceptions import HTTPException
import traceback

try:
    from config import Config
    from routes.auth import auth_bp
    from routes.profile import profile_bp
    from routes.sessions import sessions_bp
    from routes.verification import verification_bp
    from routes.reports import reports_bp
    from routes.admin import admin_bp
    from routes.notifications import notifications_bp
    from routes.community_feed import community_feed_bp
except ImportError as e:
    print(f"Import error: {e}")
    print(f"Python path: {sys.path}")
    print(f"Current directory: {os.getcwd()}")
    raise


def create_app():
    """Application factory"""
    app = Flask(__name__)

    # ✅ Load configuration
    app.config.from_object(Config)

    # ✅ Enable CORS for all origins (will be restricted in production)
    CORS(
        app,
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "Accept"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
        max_age=3600
    )

    # ✅ Handle OPTIONS requests explicitly
    @app.before_request
    def handle_preflight():
        from flask import request
        if request.method == "OPTIONS":
            response = jsonify({"status": "ok"})
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept'
            response.headers['Access-Control-Max-Age'] = '3600'
            return response, 200

    # ✅ Add explicit CORS headers to all responses
    @app.after_request
    def after_request(response):
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept'
        response.headers['Access-Control-Max-Age'] = '3600'
        return response

    # ✅ optional caching + compression
    cache = Cache(app, config={
        'CACHE_TYPE': Config.CACHE_TYPE,
        'CACHE_DEFAULT_TIMEOUT': Config.CACHE_DEFAULT_TIMEOUT
    })
    Compress(app)

    # ✅ Register blueprints under /api
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(profile_bp, url_prefix='/api')
    app.register_blueprint(sessions_bp, url_prefix='/api')
    app.register_blueprint(verification_bp, url_prefix='/api')
    app.register_blueprint(reports_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(notifications_bp, url_prefix='/api')
    app.register_blueprint(community_feed_bp, url_prefix='/api')

    # ✅ Health check
    @app.route("/api/health")
    def health_check():
        return jsonify({"status": "ok", "message": "Community Guard API is running"}), 200

    # ✅ Serve uploaded files
    @app.route("/api/uploads/<filename>")
    def uploaded_file(filename):
        return send_from_directory(Config.UPLOAD_FOLDER, filename)

    @app.route("/uploads/<filename>")
    def uploaded_file_public(filename):
        return send_from_directory(Config.UPLOAD_FOLDER, filename)

    # ✅ Global exception handler
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


# ✅ Create app instance
try:
    app = create_app()
    print("✅ Flask app created successfully")

except Exception as e:
    print(f"❌ Error creating Flask app: {e}")
    import traceback
    traceback.print_exc()

    from flask import Flask, jsonify
    app = Flask(__name__)

    @app.route("/")
    @app.route("/api/<path:path>")
    def error_fallback(path=""):
        return jsonify({
            "status": "error",
            "message": f"Failed to initialize app: {str(e)}",
            "error_type": type(e).__name__
        }), 500


if __name__ == "__main__":
    # ✅ Ensure uploads directory exists
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)

    app.run(
        debug=Config.DEBUG,
        port=Config.PORT,
        host='0.0.0.0'
    )
