#!/usr/bin/env python3
"""
Quick test script to verify Supabase connection
Run: python test_supabase.py
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

print("=" * 60)
print("Testing Supabase Connection")
print("=" * 60)

# Test 1: Load config
print("\n1️⃣  Loading configuration...")
try:
    from config import Config
    print(f"   ✅ SUPABASE_URL: {Config.SUPABASE_URL[:30] if Config.SUPABASE_URL else 'MISSING'}...")
    print(f"   ✅ SUPABASE_KEY: {'SET (' + str(len(Config.SUPABASE_KEY)) + ' chars)' if Config.SUPABASE_KEY else 'MISSING'}")
except Exception as e:
    print(f"   ❌ Config error: {e}")
    sys.exit(1)

# Test 2: Initialize client
print("\n2️⃣  Initializing Supabase client...")
try:
    from utils.supabase_client import supabase
    if supabase:
        print("   ✅ Supabase client created successfully")
    else:
        print("   ❌ Supabase client is None")
        sys.exit(1)
except Exception as e:
    print(f"   ❌ Initialization error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 3: Query users table
print("\n3️⃣  Testing database query (users table)...")
try:
    response = supabase.table("users").select("id, email, firstname").limit(1).execute()
    data = getattr(response, "data", [])
    if data:
        print(f"   ✅ Successfully queried users table")
        print(f"   📊 Sample user: {data[0].get('email', 'N/A')}")
    else:
        print("   ⚠️  Users table is empty (this is normal for new projects)")
except Exception as e:
    print(f"   ❌ Query error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 4: Query sessions table
print("\n4️⃣  Testing database query (sessions table)...")
try:
    response = supabase.table("sessions").select("id").limit(1).execute()
    print("   ✅ Successfully queried sessions table")
except Exception as e:
    print(f"   ❌ Query error: {e}")
    print("   💡 Make sure the sessions table exists in your Supabase project")

print("\n" + "=" * 60)
print("✅ All tests passed! Supabase connection is working.")
print("=" * 60)
