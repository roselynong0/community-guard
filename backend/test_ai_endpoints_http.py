#!/usr/bin/env python
"""Quick HTTP tests for AI endpoints using Flask test client"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import app

print('=== Testing /api/ai/categories ===')
with app.test_client() as client:
    resp = client.get('/api/ai/categories')
    print('Status:', resp.status_code)
    print('JSON keys:', list(resp.json.keys()) if resp.is_json else resp.data[:200])

print('\n=== Testing /api/ai/categorize/suggestions ===')
with app.test_client() as client:
    resp = client.post('/api/ai/categorize/suggestions', json={'text': 'I lost my wallet and phone'})
    print('Status:', resp.status_code)
    print('JSON:', resp.json)

print('\n=== Testing /api/ai/categorize (no token) ===')
with app.test_client() as client:
    resp = client.post('/api/ai/categorize', json={'description': 'Car accident on Main Street', 'images': 0})
    print('Status:', resp.status_code)
    print('JSON:', resp.json)
