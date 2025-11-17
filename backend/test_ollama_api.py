"""
Test Suite for Ollama AI API
Purpose: Validate all endpoints and functionality
Run: python test_ollama_api.py
"""

import requests
import json
import time
from typing import Dict, Any

# Configuration
BASE_URL = "http://localhost:8000"
AI_API = f"{BASE_URL}/api/ai"

# Color output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def print_test(name: str):
    """Print test name"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}Testing: {name}{Colors.RESET}")
    print("-" * 50)


def print_success(msg: str):
    """Print success message"""
    print(f"{Colors.GREEN}✓ {msg}{Colors.RESET}")


def print_error(msg: str):
    """Print error message"""
    print(f"{Colors.RED}✗ {msg}{Colors.RESET}")


def print_info(msg: str):
    """Print info message"""
    print(f"{Colors.YELLOW}ℹ {msg}{Colors.RESET}")


def print_response(response: Dict[str, Any], truncate: bool = True):
    """Print formatted response"""
    text = json.dumps(response, indent=2, default=str)
    if truncate and len(text) > 500:
        text = text[:500] + f"\n... ({len(text)-500} more characters)"
    print(text)


# ============================================================================
# TEST FUNCTIONS
# ============================================================================

def test_root():
    """Test root endpoint"""
    print_test("Root Endpoint")
    
    try:
        response = requests.get(f"{BASE_URL}/")
        response.raise_for_status()
        data = response.json()
        
        print_success(f"Status: {response.status_code}")
        print_success(f"Service: {data.get('service')}")
        print_response(data, truncate=True)
        
    except Exception as e:
        print_error(f"Failed: {str(e)}")
        return False
    
    return True


def test_health():
    """Test health endpoint"""
    print_test("Health Check")
    
    try:
        response = requests.get(f"{AI_API}/health", timeout=10)
        response.raise_for_status()
        data = response.json()
        
        print_success(f"Status: {response.status_code}")
        print_success(f"Health: {data.get('status')}")
        print_success(f"Ollama components: {data.get('ollama')}")
        
    except requests.exceptions.ConnectTimeout:
        print_error("Connection timeout - ensure FastAPI server running on port 8000")
        return False
    except requests.exceptions.ConnectionError:
        print_error("Connection refused - is the server running?")
        return False
    except requests.exceptions.HTTPError as e:
        print_error(f"HTTP Error {response.status_code}")
        print_response(response.json())
        return False
    except Exception as e:
        print_error(f"Failed: {str(e)}")
        return False
    
    return True


def test_status():
    """Test status endpoint"""
    print_test("Status Check")
    
    try:
        response = requests.get(f"{AI_API}/status")
        response.raise_for_status()
        data = response.json()
        
        print_success(f"Status: {response.status_code}")
        print_success(f"Initialized: {data.get('initialized')}")
        print_success(f"LLM Model: {data.get('models', {}).get('llm')}")
        print_success(f"Embeddings Model: {data.get('models', {}).get('embeddings')}")
        print_response(data)
        
    except Exception as e:
        print_error(f"Failed: {str(e)}")
        return False
    
    return True


def test_categorization():
    """Test incident categorization"""
    print_test("Categorization - Crime/Theft")
    
    payload = {
        "text": "A robbery occurred at the convenience store on Main Street. The robber took cash and fled in a dark sedan.",
        "location": "Main Street, Olongapo City"
    }
    
    try:
        response = requests.post(f"{AI_API}/test-categorization", json=payload, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        print_success(f"Status: {response.status_code}")
        print_success(f"Category: {data.get('category')}")
        print_success(f"Priority: {data.get('priority')}")
        print_success(f"Confidence: {data.get('confidence'):.2%}")
        print_response(data, truncate=True)
        
    except requests.exceptions.Timeout:
        print_error("Request timeout - LLM inference taking too long")
        return False
    except Exception as e:
        print_error(f"Failed: {str(e)}")
        return False
    
    return True


def test_process_incident():
    """Test full incident processing with guidance"""
    print_test("Process Incident - Medical Emergency")
    
    payload = {
        "text": "A person collapsed in front of the mall with severe chest pain and difficulty breathing. People nearby are unsure how to help.",
        "location": "SM City Olongapo"
    }
    
    try:
        print_info("Processing incident (this may take 5-10 seconds)...")
        start = time.time()
        
        response = requests.post(f"{AI_API}/process", json=payload, timeout=20)
        response.raise_for_status()
        data = response.json()
        
        elapsed = time.time() - start
        
        print_success(f"Status: {response.status_code}")
        print_success(f"Category: {data.get('category')}")
        print_success(f"Priority: {data.get('priority')}")
        print_success(f"Confidence: {data.get('confidence'):.2%}")
        print_success(f"Response time: {elapsed:.2f}s")
        
        if data.get('guidance'):
            print_success("Guidance retrieved successfully")
            print_info(f"Guidance preview: {data['guidance'][:200]}...")
        
        print_response(data, truncate=True)
        
    except requests.exceptions.Timeout:
        print_error("Request timeout - ensure Ollama is running and responsive")
        return False
    except Exception as e:
        print_error(f"Failed: {str(e)}")
        return False
    
    return True


def test_trends():
    """Test trends analysis"""
    print_test("Trends Analysis - 7 Days")
    
    try:
        response = requests.get(f"{AI_API}/trends?days=7", timeout=10)
        response.raise_for_status()
        data = response.json()
        
        print_success(f"Status: {response.status_code}")
        print_success(f"Total incidents: {data.get('total_incidents', 0)}")
        print_success(f"Categories: {data.get('by_category', {})}")
        print_success(f"Avg confidence: {data.get('avg_confidence', 0):.2%}")
        print_response(data)
        
    except Exception as e:
        print_error(f"Failed: {str(e)}")
        return False
    
    return True


def test_predict_risk():
    """Test risk prediction"""
    print_test("Risk Prediction")
    
    try:
        response = requests.get(f"{AI_API}/predict-risk", timeout=10)
        response.raise_for_status()
        data = response.json()
        
        print_success(f"Status: {response.status_code}")
        print_success(f"Risk level: {data.get('risk_level')}")
        print_success(f"High-risk count: {data.get('high_risk_count', 0)}")
        print_response(data)
        
    except Exception as e:
        print_error(f"Failed: {str(e)}")
        return False
    
    return True


def test_report():
    """Test report generation"""
    print_test("Report Generation - 7 Days")
    
    try:
        print_info("Generating report (this may take 5-10 seconds)...")
        start = time.time()
        
        response = requests.get(f"{AI_API}/report?days=7", timeout=20)
        response.raise_for_status()
        data = response.json()
        
        elapsed = time.time() - start
        
        print_success(f"Status: {response.status_code}")
        print_success(f"Generated at: {data.get('generated_at')}")
        print_success(f"Period: {data.get('period_days')} days")
        print_success(f"Response time: {elapsed:.2f}s")
        print_response(data, truncate=True)
        
    except Exception as e:
        print_error(f"Failed: {str(e)}")
        return False
    
    return True


def test_guidance():
    """Test emergency guidance retrieval"""
    print_test("Emergency Guidance - Fire")
    
    try:
        response = requests.get(f"{AI_API}/guidance/fire", timeout=10)
        response.raise_for_status()
        data = response.json()
        
        print_success(f"Status: {response.status_code}")
        print_success(f"Category: {data.get('category')}")
        
        if data.get('guidance'):
            print_success("Guidance retrieved successfully")
            print_info(f"Preview: {data['guidance'][:300]}...")
        
        print_response(data, truncate=True)
        
    except Exception as e:
        print_error(f"Failed: {str(e)}")
        return False
    
    return True


def test_incidents_list():
    """Test incidents list endpoint"""
    print_test("List Recent Incidents")
    
    try:
        response = requests.get(f"{AI_API}/incidents?limit=5", timeout=10)
        response.raise_for_status()
        data = response.json()
        
        print_success(f"Status: {response.status_code}")
        print_success(f"Incidents count: {data.get('count', 0)}")
        print_response(data)
        
    except Exception as e:
        print_error(f"Failed: {str(e)}")
        return False
    
    return True


def test_docs():
    """Test interactive documentation"""
    print_test("Interactive Documentation (Swagger UI)")
    
    try:
        response = requests.get(f"{BASE_URL}/docs")
        response.raise_for_status()
        
        print_success(f"Status: {response.status_code}")
        print_success("Swagger UI available at: http://localhost:8000/docs")
        
    except Exception as e:
        print_error(f"Failed: {str(e)}")
        return False
    
    return True


# ============================================================================
# TEST RUNNER
# ============================================================================

def run_all_tests():
    """Run all tests"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}")
    print("=" * 50)
    print("Community Guard - Ollama AI Test Suite")
    print("=" * 50)
    print(f"{Colors.RESET}")
    
    tests = [
        ("Root Endpoint", test_root),
        ("Health Check", test_health),
        ("Status Check", test_status),
        ("Categorization", test_categorization),
        ("Process Incident", test_process_incident),
        ("Trends Analysis", test_trends),
        ("Risk Prediction", test_predict_risk),
        ("Report Generation", test_report),
        ("Emergency Guidance", test_guidance),
        ("Incidents List", test_incidents_list),
        ("Documentation", test_docs),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except KeyboardInterrupt:
            print_error("Tests interrupted by user")
            break
        except Exception as e:
            print_error(f"Unexpected error: {str(e)}")
            results[test_name] = False
    
    # Summary
    print(f"\n{Colors.BOLD}{Colors.BLUE}")
    print("=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)
    print(f"{Colors.RESET}")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = f"{Colors.GREEN}PASS{Colors.RESET}" if result else f"{Colors.RED}FAIL{Colors.RESET}"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} passed")
    
    if passed == total:
        print(f"\n{Colors.GREEN}{Colors.BOLD}✓ All tests passed!{Colors.RESET}")
        return True
    else:
        print(f"\n{Colors.YELLOW}{Colors.BOLD}⚠ Some tests failed{Colors.RESET}")
        return False


if __name__ == "__main__":
    try:
        success = run_all_tests()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Tests interrupted{Colors.RESET}")
        exit(1)
