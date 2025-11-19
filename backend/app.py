import os
import sys
import re
from flask import Flask, jsonify, send_from_directory
from flask_caching import Cache
from flask_compress import Compress
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
import traceback

# Add backend directory to path
sys.path.insert(0, os.path.dirname(__file__))

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
    from routes.ai_endpoints import ai_bp
    from routes.chatbot import chatbot_bp
    from routes.ollama_internal import ollama_internal_bp  # Internal API for Ollama
    from routes.maps import maps_bp  # Maps, hotspots, and safezones
    
    print("✅ All blueprints imported successfully")
    print(f"✅ AI blueprint: {ai_bp.name}, prefix: {ai_bp.url_prefix}")
    print(f"✅ Chatbot blueprint: {chatbot_bp.name}, prefix: {chatbot_bp.url_prefix}")
except ImportError as e:
    print(f"❌ Import error: {e}")
    traceback.print_exc()
    raise

# ✅ Create Flask app factory
def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # ✅ Enable CORS properly - Allow localhost dev and production URLs
    def check_origin(origin):
        """Allow localhost and all Vercel deployment URLs"""
        if not origin:
            return False
        
        allowed_patterns = [
            r'^http://localhost:\d+$',
            r'^http://127\.0\.0\.1:\d+$',
            r'^https://community-guard.*\.vercel\.app$',
            r'^https://community-guard-1\.onrender\.com$'
        ]
        
        for pattern in allowed_patterns:
            if re.match(pattern, origin):
                print(f"✅ CORS: Allowed origin: {origin}")
                return True
        
        print(f"❌ CORS: Blocked origin: {origin}")
        return False
    
    CORS(
        app,
        origins=check_origin,
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "Accept"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
        expose_headers=["Content-Type", "Authorization"]
    )

    # ✅ Optional caching + compression
    cache = Cache(app, config={
        'CACHE_TYPE': Config.CACHE_TYPE,
        'CACHE_DEFAULT_TIMEOUT': Config.CACHE_DEFAULT_TIMEOUT
    })
    Compress(app)

    # ✅ Register all blueprints under /api
    app.register_blueprint(auth_bp, url_prefix='/api')
    print("✅ Registered: auth_bp")
    app.register_blueprint(profile_bp, url_prefix='/api')
    print("✅ Registered: profile_bp")
    app.register_blueprint(sessions_bp, url_prefix='/api')
    print("✅ Registered: sessions_bp")
    app.register_blueprint(verification_bp, url_prefix='/api')
    print("✅ Registered: verification_bp")
    app.register_blueprint(reports_bp, url_prefix='/api')
    print("✅ Registered: reports_bp")
    app.register_blueprint(admin_bp, url_prefix='/api')
    print("✅ Registered: admin_bp")
    app.register_blueprint(notifications_bp, url_prefix='/api')
    print("✅ Registered: notifications_bp")
    app.register_blueprint(community_feed_bp, url_prefix='/api')
    print("✅ Registered: community_feed_bp")
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    print("✅ Registered: ai_bp at /api/ai")
    app.register_blueprint(maps_bp, url_prefix='/api')
    print("✅ Registered: maps_bp at /api (hotspots, safezones)")
    
    # Register Ollama internal API (for Premium AI to access system data)
    app.register_blueprint(ollama_internal_bp, url_prefix='/api/ollama')
    print("✅ Registered: ollama_internal_bp at /api/ollama (Internal API)")
    
    # Register standard chatbot
    app.register_blueprint(chatbot_bp, url_prefix='/api')
    print("✅ Registered: chatbot_bp at /api/chat")

    # ✅ Health check
    @app.route("/")
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

    # ✅ Serve frontend static files (SPA fallback) when the built frontend exists
    # This prevents 404s when refreshing client-side routes (React Router BrowserRouter)
    try:
        frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist'))
        if os.path.isdir(frontend_dist):
            print(f"📦 Serving frontend from: {frontend_dist}")

            @app.route('/', defaults={'path': ''})
            @app.route('/<path:path>')
            def serve_frontend(path):
                # If the requested resource exists in the dist, serve it directly
                requested = os.path.join(frontend_dist, path)
                if path and os.path.exists(requested) and os.path.isfile(requested):
                    return send_from_directory(frontend_dist, path)
                # Otherwise return index.html so the client-side router can handle the route
                return send_from_directory(frontend_dist, 'index.html')
    except Exception:
        # Non-fatal: if something goes wrong, don't break the API
        print("⚠️ Failed to enable frontend static serving (frontend build may be missing)")

    # ✅ Global exception handler
    @app.errorhandler(Exception)
    def handle_global_exception(e):
        if isinstance(e, HTTPException):
            return jsonify({"status": "error", "message": e.description}), e.code
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
    traceback.print_exc()
    app = Flask(__name__)
    @app.route("/")
    @app.route("/api/<path:path>")
    def error_fallback(path=""):
        return jsonify({
            "status": "error",
            "message": f"Failed to initialize app: {str(e)}",
            "error_type": type(e).__name__
        }), 500

# ✅ Ensure uploads directory exists
os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)

if __name__ == "__main__":
    app.run(debug=Config.DEBUG, port=Config.PORT, host='0.0.0.0')