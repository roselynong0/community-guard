"""
Test Suite for Lean AI Server
Run: python test_ai_lean.py
"""

import requests
import json
import time
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"
FLASK_URL = "http://localhost:5000"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def test_health():
    """Test AI health check."""
    print_section("1️⃣  HEALTH CHECK")
    try:
        resp = requests.get(f"{BASE_URL}/api/ai/health", timeout=5)
        result = resp.json()
        print(json.dumps(result, indent=2))
        assert resp.status_code == 200, f"Status {resp.status_code}"
        print("✅ PASS: Health check passed")
        return True
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False

def test_status():
    """Test AI status endpoint."""
    print_section("2️⃣  AI STATUS")
    try:
        resp = requests.get(f"{BASE_URL}/api/ai/status", timeout=5)
        result = resp.json()
        print(json.dumps(result, indent=2))
        assert resp.status_code == 200
        assert "ollama_connected" in result
        print("✅ PASS: Status retrieved")
        return True
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False

def test_categorize():
    """Test LLM categorization."""
    print_section("3️⃣  CATEGORIZATION")
    try:
        payload = {
            "text": "There was a robbery at the convenience store on Main Street",
            "location": "Main Street, Olongapo"
        }
        resp = requests.post(
            f"{BASE_URL}/api/ai/categorize",
            json=payload,
            timeout=30
        )
        result = resp.json()
        print(json.dumps(result, indent=2))
        assert resp.status_code == 200
        assert result.get("data", {}).get("category") in ["crime", "other"]
        print("✅ PASS: Categorization succeeded")
        return True
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False

def test_process_incident():
    """Test full incident processing."""
    print_section("4️⃣  FULL INCIDENT PROCESSING")
    try:
        payload = {
            "text": "A serious fire broke out at an apartment complex. There are people trapped inside.",
            "location": "Downtown Olongapo"
        }
        resp = requests.post(
            f"{BASE_URL}/api/ai/process",
            json=payload,
            timeout=30
        )
        result = resp.json()
        print(json.dumps(result, indent=2))
        assert resp.status_code == 200
        assert "data" in result
        assert "guidance" in result["data"]
        print("✅ PASS: Incident processing succeeded")
        return True
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False

def test_guidance():
    """Test emergency guidance."""
    print_section("5️⃣  EMERGENCY GUIDANCE")
    try:
        for category in ["fire", "crime", "medical"]:
            resp = requests.get(f"{BASE_URL}/api/ai/guidance/{category}", timeout=5)
            result = resp.json()
            print(f"\n{category.upper()}:")
            print(json.dumps(result, indent=2))
            assert resp.status_code == 200
        print("\n✅ PASS: Guidance retrieval succeeded")
        return True
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False

def test_contacts():
    """Test emergency contacts."""
    print_section("6️⃣  EMERGENCY CONTACTS")
    try:
        resp = requests.get(f"{BASE_URL}/api/ai/contacts", timeout=5)
        result = resp.json()
        print(json.dumps(result, indent=2))
        assert resp.status_code == 200
        assert "hotlines" in result
        print("✅ PASS: Contacts retrieved")
        return True
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False

def test_models():
    """Test available models info."""
    print_section("7️⃣  AVAILABLE MODELS")
    try:
        resp = requests.get(f"{BASE_URL}/api/ai/models", timeout=5)
        result = resp.json()
        print(json.dumps(result, indent=2))
        assert resp.status_code == 200
        assert "llm" in result
        assert "embeddings" in result
        print("✅ PASS: Models info retrieved")
        return True
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False

def test_trends():
    """Test trend analysis."""
    print_section("8️⃣  TREND ANALYSIS")
    try:
        # Mock incidents
        incidents = [
            {"category": "crime", "location": "Main St", "created_at": (datetime.now() - timedelta(days=1)).isoformat()},
            {"category": "crime", "location": "Main St", "created_at": datetime.now().isoformat()},
            {"category": "fire", "location": "Downtown", "created_at": datetime.now().isoformat()},
        ]
        payload = {
            "incidents": incidents,
            "days": 7
        }
        resp = requests.post(
            f"{BASE_URL}/api/ai/trends",
            json=payload,
            timeout=10
        )
        result = resp.json()
        print(json.dumps(result, indent=2))
        assert resp.status_code == 200
        assert "trends" in result
        print("✅ PASS: Trend analysis succeeded")
        return True
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False

def test_risk_assessment():
    """Test risk assessment."""
    print_section("9️⃣  RISK ASSESSMENT")
    try:
        incidents = [
            {"category": "fire"},
            {"category": "medical"},
            {"category": "crime"},
        ]
        payload = {"incidents": incidents}
        resp = requests.post(
            f"{BASE_URL}/api/ai/risk-assessment",
            json=payload,
            timeout=10
        )
        result = resp.json()
        print(json.dumps(result, indent=2))
        assert resp.status_code == 200
        assert "risk_assessment" in result
        print("✅ PASS: Risk assessment succeeded")
        return True
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False

def test_hotspots():
    """Test hotspot identification."""
    print_section("🔟 HOTSPOT IDENTIFICATION")
    try:
        incidents = [
            {"category": "crime", "location": "Main St"},
            {"category": "crime", "location": "Main St"},
            {"category": "fire", "location": "Downtown"},
        ]
        payload = {"incidents": incidents}
        resp = requests.post(
            f"{BASE_URL}/api/ai/hotspots",
            json=payload,
            timeout=10
        )
        result = resp.json()
        print(json.dumps(result, indent=2))
        assert resp.status_code == 200
        assert "hotspots" in result
        print("✅ PASS: Hotspot identification succeeded")
        return True
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False

def test_flask_isolated():
    """Verify Flask chatbot still works (isolation test)."""
    print_section("🔐 ISOLATION TEST: Flask Chatbot (Port 5000)")
    try:
        resp = requests.get(f"{FLASK_URL}/api/ai/health", timeout=5)
        result = resp.json()
        print(json.dumps(result, indent=2))
        assert resp.status_code == 200
        print("✅ PASS: Flask chatbot still working (isolation maintained)")
        return True
    except Exception as e:
        print(f"⚠️  Flask not running (OK if running separately)")
        return False

def main():
    print("\n" + "="*60)
    print("  LEAN AI TEST SUITE")
    print("  Community Guard - Ollama + ChromaDB + ML")
    print("="*60)
    
    # Wait for server
    print("\n⏳ Waiting for FastAPI server to start...")
    for i in range(10):
        try:
            requests.get(f"{BASE_URL}/", timeout=1)
            print("✅ Server ready\n")
            break
        except:
            time.sleep(1)
    else:
        print("❌ Server not responding. Start with: python ai_app_lean.py")
        return
    
    # Run tests
    tests = [
        test_health,
        test_status,
        test_categorize,
        test_process_incident,
        test_guidance,
        test_contacts,
        test_models,
        test_trends,
        test_risk_assessment,
        test_hotspots,
        test_flask_isolated,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ Test error: {e}")
            failed += 1
    
    # Summary
    print_section("TEST SUMMARY")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📊 Total: {passed + failed}")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print(f"\n⚠️  {failed} tests failed. Check errors above.")

if __name__ == "__main__":
    main()
