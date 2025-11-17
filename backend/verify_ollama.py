#!/usr/bin/env python3
"""
Ollama Integration Verification Script
Checks if all dependencies and services are properly configured
"""

import sys
import os
import logging
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_python_version():
    """Check Python version"""
    print("\n" + "="*60)
    print("PYTHON VERSION CHECK")
    print("="*60)
    
    version = sys.version_info
    required = (3, 11, 0)
    
    print(f"Current: Python {version.major}.{version.minor}.{version.micro}")
    print(f"Required: Python {required[0]}.{required[1]}+")
    
    if version >= required:
        print("✅ Python version OK")
        return True
    else:
        print("❌ Python version too old")
        return False

def check_dependencies():
    """Check if all required packages are installed"""
    print("\n" + "="*60)
    print("DEPENDENCY CHECK")
    print("="*60)
    
    required_packages = {
        "flask": "Flask",
        "flask_cors": "Flask-CORS",
        "langchain": "LangChain",
        "langchain_ollama": "LangChain-Ollama",
        "chromadb": "ChromaDB",
        "pandas": "Pandas",
        "numpy": "NumPy",
        "sklearn": "scikit-learn",
        "matplotlib": "Matplotlib",
        "dotenv": "python-dotenv",
        "requests": "Requests",
    }
    
    all_ok = True
    for module, name in required_packages.items():
        try:
            __import__(module)
            print(f"✅ {name}")
        except ImportError:
            print(f"❌ {name} - NOT INSTALLED")
            all_ok = False
    
    if not all_ok:
        print("\n⚠️  Missing packages. Install with:")
        print("   pip install -r requirements.txt")
    
    return all_ok

def check_ollama_connection():
    """Check if Ollama server is running"""
    print("\n" + "="*60)
    print("OLLAMA SERVER CHECK")
    print("="*60)
    
    try:
        import requests
        
        url = "http://localhost:11434/api/tags"
        print(f"Connecting to: {url}")
        
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            print("✅ Ollama server is running")
            models = response.json().get("models", [])
            print(f"   Found {len(models)} model(s)")
            for model in models:
                model_name = model.get("name", "unknown")
                model_size = model.get("size", 0) / (1024**3)  # Convert to GB
                print(f"   - {model_name} ({model_size:.1f}GB)")
            return True
        else:
            print(f"❌ Ollama returned status {response.status_code}")
            return False
            
    except requests.ConnectionError:
        print("❌ Cannot connect to Ollama at http://localhost:11434")
        print("\n   Make sure Ollama is running:")
        print("   - Windows: Start Ollama from Start Menu")
        print("   - macOS: ollama serve")
        print("   - Linux: ollama serve")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def check_required_models():
    """Check if required models are installed"""
    print("\n" + "="*60)
    print("REQUIRED MODELS CHECK")
    print("="*60)
    
    try:
        import requests
        
        url = "http://localhost:11434/api/tags"
        response = requests.get(url, timeout=5)
        
        if response.status_code != 200:
            print("❌ Cannot query Ollama")
            return False
        
        models = response.json().get("models", [])
        model_names = [m.get("name", "").split(":")[0] for m in models]
        
        required = {
            "phi4": "LLM Model (phi4:mini-q4_0)",
            "bge-m3": "Embedding Model (bge-m3)"
        }
        
        all_ok = True
        for model_key, model_desc in required.items():
            if model_key in model_names:
                print(f"✅ {model_desc}")
            else:
                print(f"❌ {model_desc} - NOT INSTALLED")
                all_ok = False
        
        if not all_ok:
            print("\n   Install missing models:")
            print("   - ollama pull phi4:mini-q4_0")
            print("   - ollama pull bge-m3")
        
        return all_ok
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def check_configuration():
    """Check .env configuration"""
    print("\n" + "="*60)
    print("CONFIGURATION CHECK")
    print("="*60)
    
    from dotenv import load_dotenv
    from config import Config
    
    load_dotenv()
    
    print(f"OLLAMA_BASE_URL: {Config.OLLAMA_BASE_URL}")
    print(f"LLM_MODEL: {Config.LLM_MODEL}")
    print(f"EMBED_MODEL: {Config.EMBED_MODEL}")
    
    # Verify these are reasonable
    if "localhost" in Config.OLLAMA_BASE_URL or "127.0.0.1" in Config.OLLAMA_BASE_URL:
        print("✅ Configuration OK")
        return True
    else:
        print("⚠️  Non-localhost Ollama URL - make sure it's accessible")
        return True

def check_services_init():
    """Try to initialize services"""
    print("\n" + "="*60)
    print("SERVICE INITIALIZATION CHECK")
    print("="*60)
    
    try:
        from services.ollama_service import get_ollama_service
        print("Loading Ollama service...")
        ollama = get_ollama_service()
        models = ollama.verify_models()
        if models.get("llm") and models.get("embed"):
            print("✅ Ollama service initialized")
        else:
            print("⚠️  Ollama service initialized but models not found")
            return False
    except Exception as e:
        print(f"❌ Error initializing Ollama service: {e}")
        return False
    
    try:
        from services.rag_service import get_rag_service
        print("Loading RAG service...")
        rag = get_rag_service()
        stats = rag.get_collection_stats()
        print(f"✅ RAG service initialized - {sum(stats.values())} documents in collections")
    except Exception as e:
        print(f"❌ Error initializing RAG service: {e}")
        return False
    
    try:
        from services.langchain_service import get_langchain_service
        print("Loading LangChain service...")
        langchain = get_langchain_service()
        if langchain.llm:
            print("✅ LangChain service initialized")
        else:
            print("⚠️  LangChain service initialized but LLM not ready")
            return False
    except Exception as e:
        print(f"❌ Error initializing LangChain service: {e}")
        return False
    
    try:
        from services.analytics_service import get_analytics_service
        print("Loading Analytics service...")
        analytics = get_analytics_service()
        print("✅ Analytics service initialized")
    except Exception as e:
        print(f"❌ Error initializing Analytics service: {e}")
        return False
    
    return True

def main():
    """Run all checks"""
    print("\n")
    print("╔" + "="*58 + "╗")
    print("║  COMMUNITY GUARD - OLLAMA INTEGRATION VERIFICATION      ║")
    print("║" + " "*58 + "║")
    print("║  Checking system configuration and dependencies         ║")
    print("╚" + "="*58 + "╝")
    
    checks = [
        ("Python Version", check_python_version),
        ("Dependencies", check_dependencies),
        ("Configuration", check_configuration),
        ("Ollama Server", check_ollama_connection),
        ("Required Models", check_required_models),
        ("Service Initialization", check_services_init),
    ]
    
    results = {}
    for name, check_func in checks:
        try:
            results[name] = check_func()
        except Exception as e:
            logger.error(f"Error in {name}: {e}", exc_info=True)
            results[name] = False
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    all_passed = all(results.values())
    
    for name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    if all_passed:
        print("\n" + "="*60)
        print("🎉 ALL CHECKS PASSED!")
        print("="*60)
        print("\nYour Ollama integration is ready!")
        print("\nTo start the application:")
        print("  python run.py")
        return 0
    else:
        print("\n" + "="*60)
        print("⚠️  SOME CHECKS FAILED")
        print("="*60)
        print("\nPlease fix the issues above before running the application.")
        print("\nCommon solutions:")
        print("  - Ensure Ollama is running: ollama serve")
        print("  - Pull models: ollama pull phi4:mini-q4_0 bge-m3")
        print("  - Install dependencies: pip install -r requirements.txt")
        print("  - Check .env configuration")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
