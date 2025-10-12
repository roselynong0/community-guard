#!/usr/bin/env python3
"""
Test script for Admin Users functionality.
Quick test to verify the admin users endpoint is working correctly.
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5000/api"
ADMIN_TOKEN = None  # Will be filled by login

def test_admin_login():
    """Test admin login to get token"""
    print("🔐 Testing Admin Login...")
    
    # You'll need to update these with actual admin credentials
    login_data = {
        "email": "admin@example.com",  # Change this
        "password": "password123",     # Change this  
        "role": "Admin"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/login", json=login_data)
        result = response.json()
        
        if response.status_code == 200 and result.get("status") == "success":
            token = result.get("session", {}).get("token")
            print(f"✅ Admin login successful! Token: {token[:20]}...")
            return token
        else:
            print(f"❌ Admin login failed: {result.get('message', 'Unknown error')}")
            return None
            
    except Exception as e:
        print(f"❌ Login request failed: {e}")
        return None

def test_fetch_users(token):
    """Test fetching users for verification"""
    print("\n👥 Testing Users Fetch...")
    
    if not token:
        print("❌ No token available for testing")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/users/verification", headers=headers)
        result = response.json()
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(result, indent=2)}")
        
        if response.status_code == 200 and result.get("status") == "success":
            users = result.get("users", [])
            print(f"✅ Users fetch successful!")
            print(f"   Found {len(users)} users")
            
            for i, user in enumerate(users[:3]):  # Show first 3 users
                print(f"   User {i+1}: {user.get('firstname')} {user.get('lastname')} - {user.get('role')} - {'Verified' if user.get('isverified') else 'Unverified'}")
            
            return users
        else:
            print(f"❌ Users fetch failed: {result.get('message', 'Unknown error')}")
            return []
            
    except Exception as e:
        print(f"❌ Users fetch request failed: {e}")
        return []

def test_user_info(token, users):
    """Test fetching detailed user info"""
    print("\n📋 Testing User Info Fetch...")
    
    if not token or not users:
        print("❌ No token or users available for testing")
        return
    
    # Get the first non-admin user
    test_user = None
    for user in users:
        if user.get('role') != 'Admin':
            test_user = user
            break
    
    if not test_user:
        print("❌ No non-admin users found for testing")
        return
    
    user_id = test_user.get('id')
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/users/{user_id}/info", headers=headers)
        result = response.json()
        
        print(f"Status Code: {response.status_code}")
        print(f"Testing user: {test_user.get('firstname')} {test_user.get('lastname')}")
        
        if response.status_code == 200 and result.get("status") == "success":
            info = result.get("info")
            print(f"✅ User info fetch successful!")
            if info:
                print(f"   Phone: {info.get('phone', 'Not provided')}")
                print(f"   Address: {info.get('address_street', '')}, {info.get('address_barangay', '')}")
                print(f"   Birthdate: {info.get('birthdate', 'Not provided')}")
            else:
                print("   No extended information available")
        else:
            print(f"❌ User info fetch failed: {result.get('message', 'Unknown error')}")
            
    except Exception as e:
        print(f"❌ User info fetch request failed: {e}")

if __name__ == "__main__":
    print("🧪 Admin Users Test Suite")
    print("=" * 50)
    
    # Test admin login
    token = test_admin_login()
    
    if token:
        # Test users fetch
        users = test_fetch_users(token)
        
        # Test user info fetch
        test_user_info(token, users)
    
    print("\n" + "=" * 50)
    print("🏁 Test Complete")
    
    if not token:
        print("\n💡 To run this test:")
        print("   1. Make sure the Flask server is running on localhost:5000")
        print("   2. Update the login credentials with a real admin account")
        print("   3. Ensure the admin user exists and is verified")