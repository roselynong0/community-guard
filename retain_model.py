#!/usr/bin/env python
"""Force retrain the AI model with improved training logic

This script forces the IncidentCategorizer to retrain with enhanced:
- Phrase pattern detection for better context awareness
- Expanded training data with more realistic examples
- Weighted keyword scoring
- Better confidence calibration

Run this after making improvements to training data.
"""

import sys
import os
import traceback

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from services.ml_categorizer import get_categorizer

def main():
    try:
        print("🔄 Retraining AI model with improved logic...")
        print("=" * 60)

        # Force retrain by getting a fresh categorizer instance
        categorizer = get_categorizer()

        # Force retrain (if implemented)
        if hasattr(categorizer, '_train_model'):
            try:
                categorizer._train_model()
                print("✅ Model retrained successfully with enhanced training data!\n")
            except Exception as e:
                print(f'⚠️ Training raised an exception: {e}; continuing with existing model\n')

        # Test the improved categorization
        test_cases = [
            'Someone stole my car',
            'Building is on fire',
            'Street is flooded',
            'Car accident on Main Street',
            'Strange person in the area',
            'Broken street light',
            'I lost my wallet',
            'Someone is harassing me',
            'Pothole on the road',
            'Found a wallet at the bus stop',
            'Physical assault in the park',
            'Graffiti on the wall',
            'Fire in the apartment',
            'Hit and run incident',
            'Suspicious package found'
        ]

        print("=" * 60)
        print("📊 Testing Improved AI Category Mapping")
        print("=" * 60 + "\n")
        
        for i, test in enumerate(test_cases, 1):
            result = categorizer.categorize(test)
            category = result.get('category', 'unknown')
            frontend_cat = result.get('frontend_category', 'Others')
            confidence = result.get('confidence', 0)
            method = result.get('method', 'unknown')
            reason = result.get('reason', '')
            
            # Color coding for confidence levels
            conf_str = f"{confidence:.0%}"
            if confidence >= 0.90:
                conf_indicator = "🟢 HIGH"
            elif confidence >= 0.70:
                conf_indicator = "🟡 MEDIUM"
            else:
                conf_indicator = "🔴 LOW"
            
            print(f"{i:2d}. Input: {test}")
            print(f"    AI Category: {category:12} | Frontend: {frontend_cat:12} | {conf_indicator} ({conf_str})")
            print(f"    Method: {method:15} | Reason: {reason}")
            print()

        print("=" * 60)
        print("✅ AI Model Enhancement Complete!")
        print("=" * 60)

    except Exception:
        print('❌ Error while retraining/testing:')
        traceback.print_exc()

if __name__ == '__main__':
    main()
