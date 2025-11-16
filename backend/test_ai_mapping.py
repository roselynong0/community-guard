#!/usr/bin/env python
"""Test AI categorization mapping"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from services.ml_categorizer import categorize_incident

# Test categorization
test_cases = [
    'Someone stole my car',
    'Building is on fire',
    'Street is flooded',
    'Car accident on Main Street',
    'Strange person in the area',
    'Broken street light',
    'I lost my wallet',
    'Someone is harassing me',
    'Pothole on the road'
]

print('=== Testing AI Category Mapping ===\n')
for test in test_cases:
    result = categorize_incident(test)
    print(f'Input: {test}')
    print(f'AI Category: {result["category"]} -> Frontend Category: {result["frontend_category"]}')
    print(f'Confidence: {result["confidence"]:.1%}')
    print(f'Source: {result["method"]}\n')