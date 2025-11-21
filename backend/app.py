import os
import sys
import re
from flask import Flask, jsonify, send_from_directory
try:
    from flask_cors import CORS
except Exception:
    CORS = None
from flask_caching import Cache
from flask_compress import Compress
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

    # Use Flask-CORS when available to ensure preflight and credentialed
    # requests are handled correctly for both local dev and deployed origins.
        if CORS:
            # Build a dynamic allowlist from common local dev origins, config and env.
            allowed = set([
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:5000",
                "http://127.0.0.1:5000",
            ])

            # Add FRONTEND_URL from Config if present (supports full origin or URL)
            frontend_origin = None
            try:
                frontend_url = getattr(Config, 'FRONTEND_URL', None)
                if frontend_url:
                    frontend_origin = re.sub(r"/*$", "", frontend_url)
                    allowed.add(frontend_origin)
            except Exception:
                frontend_origin = None

            # Allow additional origins via ALLOWED_ORIGINS env (comma-separated)
            extra = os.getenv('ALLOWED_ORIGINS')
            if extra:
                for part in extra.split(','):
                    p = part.strip()
                    if p:
                        allowed.add(p)

            # Optionally enable a vercel wildcard for preview subdomains when set
            allow_vercel_wildcard = os.getenv('ALLOW_VERCEL_WILDCARD', '0') in ('1', 'true', 'True')

            # Optionally allow all origins (use with caution)
            allow_all = os.getenv('ALLOW_ALL_ORIGINS', '0') in ('1', 'true', 'True')

            # Normalize allowed origins (strip trailing slash)
            normalized_allowed = set([re.sub(r"/*$", "", a) for a in allowed if a])

            # Create a callable origin checker so rules can be dynamic and pattern-based
            def _origin_checker(origin):
                if allow_all:
                    return True
                if not origin:
                    return False
                # normalize
                o = origin.rstrip('/')
                # localhost / 127.0.0.1 any port
                if re.match(r'^https?://(localhost|127\.0\.0\.1)(:\d+)?$', o):
                    return True
                # vercel wildcard support
                if allow_vercel_wildcard and o.endswith('.vercel.app'):
                    return True
                # match configured frontend origin
                if frontend_origin and (o == frontend_origin or o.startswith(frontend_origin)):
                    return True
                # direct match against normalized allowlist
                if o in normalized_allowed:
                    return True
                return False

            CORS(app, resources={r"/api/*": {"origins": _origin_checker}}, supports_credentials=True)

    # ✅ Enable CORS - Use wildcard for Vercel subdomains
    from flask import request
    
    from flask import make_response

    def _is_allowed_origin(origin: str) -> bool:
        if not origin:
            return False

        # Allow all origins when explicitly requested (dangerous in production)
        if os.getenv('ALLOW_ALL_ORIGINS', '0') in ('1', 'true', 'True'):
            return True

        o = origin.rstrip('/')

        # localhost / 127.0.0.1 any port
        if re.match(r'^https?://(localhost|127\.0\.0\.1)(:\d+)?$', o):
            return True

        # Allow vercel subdomains when the env flag is set, or allow when it's a community-guard subdomain
        allow_vercel_wildcard = os.getenv('ALLOW_VERCEL_WILDCARD', '0') in ('1', 'true', 'True')
        if allow_vercel_wildcard and o.endswith('.vercel.app'):
            return True
        if '.vercel.app' in o and 'community-guard' in o:
            return True

        # Allow configured frontend URL if present
        try:
            frontend_url = getattr(Config, 'FRONTEND_URL', None)
            if frontend_url:
                frontend_origin = re.sub(r"/*$", "", frontend_url)
                if o == frontend_origin or o.startswith(frontend_origin):
                    return True
        except Exception:
            pass

        # Allow list via ALLOWED_ORIGINS
        extra = os.getenv('ALLOWED_ORIGINS')
        if extra:
            for part in extra.split(','):
                p = part.strip().rstrip('/')
                if p and p == o:
                    return True

        # Backwards compatibility: original explicit Render origin
        if o == 'https://community-guard-1.onrender.com':
            return True

        return False

    @app.before_request
    def handle_preflight():
        # Respond to CORS preflight (OPTIONS) requests early with the proper headers
        if request.method == 'OPTIONS':
            origin = request.headers.get('Origin')
            resp = make_response('', 200)
            if _is_allowed_origin(origin):
                resp.headers['Access-Control-Allow-Origin'] = origin
                resp.headers['Access-Control-Allow-Credentials'] = 'true'
            resp.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,Accept'
            resp.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS,HEAD'
            resp.headers['Access-Control-Expose-Headers'] = 'Content-Type,Authorization'
            return resp

    @app.after_request
    def after_request(response):
        origin = request.headers.get('Origin')
        if origin and _is_allowed_origin(origin):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'

        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,Accept'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS,HEAD'
        response.headers['Access-Control-Expose-Headers'] = 'Content-Type,Authorization'
        return response

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
        return jsonify({
            "status": "ok", 
            "message": "Community Guard API is running",
            "version": "v2.0-cors-fixed",
            "cors_enabled": True
        }), 200
    
    # CORS test endpoint
    @app.route("/api/cors-test")
    def cors_test():
        from flask import request
        return jsonify({
            "message": "CORS is working!",
            "origin": request.headers.get('Origin', 'No origin header'),
            "version": "v2.0-cors-fixed"
        }), 200

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