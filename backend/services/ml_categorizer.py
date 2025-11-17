"""
ML Categorizer Service
Provides AI-powered incident categorization using natural language processing
Integrates with trained ML models for intelligent report classification
"""

import os
import json
import logging
from typing import Dict, Tuple, Optional
import numpy as np

# Optional ML libraries (install with: pip install scikit-learn numpy)
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.naive_bayes import MultinomialNB
    HAS_ML = True
except ImportError:
    HAS_ML = False
    logging.warning("scikit-learn not installed. Using fallback categorization.")

logger = logging.getLogger(__name__)

class IncidentCategorizer:
    """
    AI-powered incident categorizer using machine learning
    Supports both trained models and keyword-based fallback
    Maps AI categories to frontend categories for seamless integration
    """

    # Mapping from AI categories to frontend categories
    AI_TO_FRONTEND_MAP = {
        'theft': 'Crime',           # Theft/Robbery -> Crime
        'fire': 'Hazard',           # Fire/Explosion -> Hazard
        'flood': 'Hazard',          # Flood/Water -> Hazard
        'accident': 'Concern',      # Accident -> Concern
        'violence': 'Crime',        # Violence/Assault -> Crime
        'harassment': 'Crime',      # Harassment -> Crime
        'vandalism': 'Crime',       # Vandalism -> Crime
        'suspicious': 'Concern',    # Suspicious Activity -> Concern
        'hazard': 'Hazard',         # Hazard/Infrastructure -> Hazard
        'other': 'Others',          # Other -> Others
        'lostfound': 'Lost&Found',  # Lost & Found -> Lost&Found
    }

    # Severity mapping for frontend display (used for highlight colors)
    CATEGORY_SEVERITY = {
        'Crime': 'critical',        # Red: violence, harassment, theft, vandalism
        'Hazard': 'high',           # Orange: fire, flood, accidents
        'Concern': 'medium',        # Gray: suspicious, general concerns
        'Lost&Found': 'low',        # Gray: lost items
        'Others': 'low',            # Gray: others
    }

    def __init__(self):
        # Enhanced keyword dictionary with better coverage
        self.categories = {
            'theft': ['theft', 'robbery', 'burglary', 'shoplifting', 'stealing', 'pickpocket', 'mugging', 'robbed', 'stole', 'stolen', 'heist', 'larceny'],
            'fire': ['fire', 'explosion', 'burn', 'blaze', 'combustion', 'smoke', 'flames', 'burning', 'ablaze', 'explosive', 'inferno'],
            'flood': ['flood', 'flooding', 'water', 'rain', 'overflow', 'waterlogged', 'inundated', 'submerged', 'deluge', 'overflowing'],
            'accident': ['accident', 'crash', 'collision', 'hit', 'injured', 'wounded', 'emergency', 'wreck', 'trauma', 'casualty'],
            'violence': ['violence', 'assault', 'attack', 'beating', 'fight', 'stabbed', 'shot', 'gunfire', 'aggressive', 'struck'],
            'harassment': ['harassment', 'bullying', 'threatening', 'threat', 'intimidation', 'stalking', 'harassed', 'molested', 'pestered'],
            'vandalism': ['vandalism', 'damage', 'broken', 'graffiti', 'defaced', 'destroyed', 'smashed', 'spray paint'],
            'suspicious': ['suspicious', 'suspicious activity', 'strange', 'weird', 'unknown person', 'prowler', 'loitering', 'trespassing'],
            'hazard': ['hazard', 'danger', 'hole', 'broken', 'infrastructure', 'streetlight', 'pothole', 'dangerous', 'unsafe', 'obstruction'],
            'lostfound': ['lost', 'found', 'lost wallet', 'found wallet', 'lost phone', 'found phone', 'lost item', 'found item', 'lost & found', 'missing', 'located'],
        }
        
        # Multi-word phrases for better context detection
        self.phrase_patterns = {
            'theft': ['car theft', 'home theft', 'jewelry stolen', 'bag stolen', 'break in', 'break-in', 'burglary', 'shoplifting', 'grand theft'],
            'fire': ['house fire', 'car fire', 'building fire', 'gas explosion', 'electrical fire', 'structure fire'],
            'flood': ['flash flood', 'river flooding', 'water rising', 'flooded area', 'heavy flooding', 'water damage'],
            'accident': ['car accident', 'traffic accident', 'hit and run', 'car crash', 'pedestrian hit', 'motor accident'],
            'violence': ['physical assault', 'armed attack', 'violent crime', 'aggravated assault', 'sexual assault'],
            'harassment': ['sexual harassment', 'workplace harassment', 'online harassment', 'phone harassment', 'threatening behavior'],
            'vandalism': ['property damage', 'graffiti vandalism', 'car vandalism', 'public property damage', 'tire slashing'],
            'suspicious': ['suspicious person', 'strange activity', 'unknown individual', 'suspicious vehicle', 'strange behavior'],
            'hazard': ['street hazard', 'safety hazard', 'infrastructure damage', 'broken utility', 'road obstruction'],
            'lostfound': ['lost wallet', 'lost phone', 'found wallet', 'found phone', 'lost keys', 'found keys', 'lost dog', 'lost item', 'found item']
        }

        self.model = None
        self.vectorizer = None
        self.category_list = list(self.categories.keys())

        # Load trained model if available
        if HAS_ML:
            self._load_or_train_model()

    def _map_to_frontend_category(self, ai_category: str) -> str:
        """
        Convert AI category to frontend category
        
        Args:
            ai_category (str): AI category name
            
        Returns:
            str: Frontend category name
        """
        return self.AI_TO_FRONTEND_MAP.get(ai_category, 'Others')

    def _load_or_train_model(self):
        """Load pre-trained model or train a new one"""
        try:
            model_path = os.path.join(os.path.dirname(__file__), 'models', 'incident_classifier.pkl')
            if os.path.exists(model_path):
                import pickle
                with open(model_path, 'rb') as f:
                    self.model = pickle.load(f)
                logger.info("Loaded pre-trained incident classifier model")
            else:
                self._train_model()
        except Exception as e:
            logger.error(f"Error loading model: {e}. Using keyword-based categorization.")
            self.model = None

    def _train_model(self):
        """Train a new incident classifier using realistic training data"""
        try:
            # Generate comprehensive training data with realistic sentences
            training_data = {
                'theft': [
                    'Someone stole my car', 'My wallet was stolen', 'Burglary in my house',
                    'Stolen phone', 'Someone stole my bike', 'Car break-in and theft', 'Pickpocketed in the market',
                    'Someone broke into my home and took my things', 'Pickpocket stole my phone',
                    'My bicycle was stolen from the garage', 'Shoplifting at the store',
                    'Someone robbed me at gunpoint', 'My laptop was stolen'
                ],
                'fire': [
                    'Building is on fire', 'House fire emergency', 'Fire in the kitchen',
                    'Explosion at the factory', 'Car fire on the highway', 'Forest fire spreading',
                    'Electrical fire in the apartment', 'Gas leak causing fire', 'Fire alarm going off'
                ],
                'flood': [
                    'Street is flooded', 'Flooding in the area', 'Water everywhere after rain',
                    'Basement flooded with water', 'River overflowing', 'Flash flood warning',
                    'Heavy rain causing flooding', 'Water damage in my home', 'Flood waters rising'
                ],
                'accident': [
                    'Car accident on Main Street', 'Two cars collided', 'Pedestrian hit by car',
                    'Motorcycle accident', 'Truck overturned on highway', 'Hit and run incident',
                    'Someone injured in accident', 'Traffic accident blocking road', 'Car crash'
                ],
                'violence': [
                    'Someone attacked me', 'Physical assault in the park', 'Fight breaking out',
                    'Domestic violence incident', 'Someone threatened me with a weapon',
                    'Assault and battery', 'Violent confrontation', 'Person injured in attack'
                ],
                'harassment': [
                    'Someone is harassing me', 'Stalking incident', 'Unwanted attention',
                    'Harassing phone calls', 'Cyberbullying online', 'Intimidation at work',
                    'Threatening messages', 'Harassment complaint', 'Being followed',
                    'Repeat harasser', 'Sexual harassment', 'Harassed at work', 'Receiving threats', 'Aggressive messages'
                ],
                'vandalism': [
                    'Graffiti on the wall', 'Property damaged', 'Windows smashed',
                    'Car tires slashed', 'Vandalism in the neighborhood', 'Broken windows',
                    'Property defaced', 'Damage to public property', 'Spray paint everywhere'
                ],
                'suspicious': [
                    'Strange person in the area', 'Suspicious activity', 'Unknown person lurking',
                    'Weird behavior observed', 'Suspicious package found', 'Person acting strangely',
                    'Unusual activity at night', 'Someone watching the house', 'Suspicious individual'
                ],
                'hazard': [
                    'Broken street light', 'Pothole on the road', 'Dangerous intersection',
                    'Hazardous conditions', 'Infrastructure problem', 'Road hazard',
                    'Broken utility pole', 'Hazardous waste spill', 'Dangerous obstruction'
                ],
                'lostfound': [
                    'I lost my wallet', 'I lost my phone', 'Found a phone on the road',
                    'Found a wallet', 'Lost and found', 'I lost my keys', 'Found keys in the park',
                    'Lost my bag', 'Found a bag', 'Found a set of keys', 'Lost my ID', 'Found ID card',
                    'Found a passport', 'Lost backpack', 'Found a backpack', 'Found a wallet near the market',
                    'Someone found my phone', 'Found a keychain', 'Lost and found post', 'Lost item found',
                    'Missing wallet', 'Found wallet in taxi', 'Lost my purse', 'Found a purse',
                    'Lost my bag at the market', 'Found a set of keys near the mall', 'Lost dog, please help',
                    'Found a wallet near the bus stop', 'Lost my phone on the bus', 'Lost & found center report'
                ],
                'other': [
                    'General complaint', 'Miscellaneous issue', 'Other problem',
                    'Not sure what category', 'Unusual occurrence', 'Something else',
                    'Different kind of issue', 'Various concerns', 'Other matters'
                ]
            }

            training_texts = []
            training_labels = []

            for category, examples in training_data.items():
                for example in examples:
                    training_texts.append(example)
                    training_labels.append(category)

            # Oversample smaller/critical categories
            for category in ['lostfound', 'harassment', 'violence']:
                if category in training_data:
                    for _ in range(3):  # Add 3x more copies
                        for example in training_data[category]:
                            training_texts.append(example)
                            training_labels.append(category)

            # Add individual keywords for better coverage
            for category, keywords in self.categories.items():
                for keyword in keywords:
                    training_texts.append(keyword)
                    training_labels.append(category)
            
            # Add phrase patterns for context awareness
            for category, phrases in self.phrase_patterns.items():
                for phrase in phrases:
                    training_texts.append(phrase)
                    training_labels.append(category)

            # Train vectorizer and classifier
            self.vectorizer = TfidfVectorizer(lowercase=True, ngram_range=(1, 2), stop_words='english')
            X = self.vectorizer.fit_transform(training_texts)

            self.model = MultinomialNB()
            self.model.fit(X, training_labels)

            logger.info(f"Trained incident classifier model with {len(training_texts)} examples")
        except Exception as e:
            logger.error(f"Error training model: {e}")
            self.model = None

    def categorize(self, description: str, num_images: int = 0) -> Dict[str, any]:
        """
        Categorize an incident based on description and images
        Enhanced with phrase pattern detection and better confidence calibration
        
        Args:
            description (str): Incident description text
            num_images (int): Number of images attached
            
        Returns:
            dict: {
                'category': str (AI category),
                'frontend_category': str (mapped frontend category),
                'confidence': float (0-1),
                'alternative_categories': list,
                'method': str ('ml' or 'keyword')
            }
        """
        if not description or len(description.strip()) < 5:
            return {
                'category': 'other',
                'frontend_category': 'Others',
                'confidence': 0.0,
                'alternative_categories': [],
                'method': 'default',
                'reason': 'Description too short'
            }

        # Clean and lowercase text
        clean_text = description.lower().strip()

        # 1. PHRASE PATTERN DETECTION (highest priority for accuracy)
        # Check multi-word phrases first as they're highly contextual
        for category, phrases in self.phrase_patterns.items():
            for phrase in phrases:
                if phrase.lower() in clean_text:
                    return {
                        'category': category,
                        'frontend_category': self._map_to_frontend_category(category),
                        'confidence': 0.92,
                        'alternative_categories': [],
                        'method': 'phrase_pattern',
                        'reason': f'Matched phrase pattern: "{phrase}"'
                    }

        # 2. HEURISTIC RULES for high-confidence keyword categories
        #  - Lost & Found: explicit object words + lost/found indicators
        lost_indicators = ['lost', 'found', 'missing', 'lost & found', 'lost and found', 'locate']
        lost_objects = ['wallet', 'phone', 'bag', 'purse', 'keys', 'backpack', 'id', 'passport', 'dog', 'cat', 'keychain']
        if any(ind in clean_text for ind in lost_indicators) and any(obj in clean_text for obj in lost_objects):
            return {
                'category': 'lostfound',
                'frontend_category': self._map_to_frontend_category('lostfound'),
                'confidence': 0.95,
                'alternative_categories': [],
                'method': 'keyword',
                'reason': 'Heuristic matched Lost & Found'
            }

        # 3. QUICK KEYWORD HEURISTICS for other high-confidence event types
        heuristics = [
            ('theft', ['stole', 'stolen', 'robbery', 'robbed', 'burglary', 'pickpocket', 'shoplifting', 'heist', 'larceny']),
            ('fire', ['fire', 'blaze', 'explosion', 'smoke', 'burn', 'on fire', 'burning', 'inferno']),
            ('flood', ['flood', 'flooding', 'water everywhere', 'inundated', 'heavy rain', 'flash flood', 'submerged']),
            ('accident', ['accident', 'crash', 'collision', 'hit and run', 'hit by', 'car crash', 'wreck']),
            ('hazard', ['pothole', 'hole', 'broken street light', 'dangerous intersection', 'hazardous', 'road hazard']),
            ('suspicious', ['suspicious', 'strange person', 'unknown person', 'suspicious activity', 'prowler', 'loitering']),
            ('violence', ['violence', 'assault', 'attack', 'beating', 'fight', 'stabbed', 'shot', 'gunfire', 'aggressive']),
            ('harassment', ['harassment', 'bullying', 'threatening', 'threat', 'intimidation', 'stalking', 'harassed']),
            ('vandalism', ['vandalism', 'graffiti', 'damage', 'smashed', 'spray paint', 'defaced', 'destroyed'])
        ]

        for cat, keywords in heuristics:
            if any(k in clean_text for k in keywords):
                return {
                    'category': cat,
                    'frontend_category': self._map_to_frontend_category(cat),
                    'confidence': 0.90,
                    'alternative_categories': [],
                    'method': 'keyword',
                    'reason': f'Heuristic matched {cat}'
                }

        # 4. ML-based categorization with keyword fallback
        if HAS_ML and self.model and self.vectorizer:
            ml_result = self._ml_categorize(clean_text, num_images)
            kw_result = self._keyword_categorize(clean_text, num_images)
            try:
                # Favor keyword classification when confidence gap is significant
                if (kw_result.get('confidence', 0) - ml_result.get('confidence', 0)) > 0.2:
                    return kw_result
            except Exception:
                pass
            return ml_result
        else:
            # Fall back to keyword-based categorization
            return self._keyword_categorize(clean_text, num_images)

    def _ml_categorize(self, text: str, num_images: int = 0) -> Dict[str, any]:
        """Categorize using trained ML model"""
        try:
            X = self.vectorizer.transform([text])
            predictions = self.model.predict_proba(X)[0]
            category_idx = np.argmax(predictions)

            category = self.category_list[category_idx]
            confidence = float(predictions[category_idx])

            # Get alternative categories
            sorted_indices = np.argsort(predictions)[::-1]
            alternatives = [
                {
                    'category': self.category_list[idx],
                    'frontend_category': self._map_to_frontend_category(self.category_list[idx]),
                    'confidence': float(predictions[idx])
                }
                for idx in sorted_indices[1:3]  # Top 2 alternatives
                if predictions[idx] > 0.1
            ]

            # Boost confidence if images provided (images often contain critical information)
            if num_images > 0:
                confidence = min(1.0, confidence + (0.1 * num_images))

            return {
                'category': category,
                'frontend_category': self._map_to_frontend_category(category),
                'confidence': confidence,
                'alternative_categories': alternatives,
                'method': 'ml',
                'reason': f'ML model prediction: {confidence:.2%} confidence'
            }
        except Exception as e:
            logger.error(f"ML categorization error: {e}")
            return self._keyword_categorize(text, num_images)

    def _keyword_categorize(self, text: str, num_images: int = 0) -> Dict[str, any]:
        """Categorize using keyword matching with weighted scoring"""
        keyword_scores = {category: 0 for category in self.categories}
        phrase_scores = {category: 0 for category in self.phrase_patterns}

        # Score each category based on keyword matches (weight: 1 point each)
        for category, keywords in self.categories.items():
            for keyword in keywords:
                if keyword in text:
                    keyword_scores[category] += 1

        # Score phrase patterns more heavily (weight: 3 points each for better accuracy)
        for category, phrases in self.phrase_patterns.items():
            for phrase in phrases:
                if phrase in text:
                    phrase_scores[category] += 3

        # Combine scores (phrase + keyword)
        combined_scores = {}
        for category in self.categories:
            combined_scores[category] = keyword_scores.get(category, 0) + phrase_scores.get(category, 0)

        # Find best match
        if max(combined_scores.values()) > 0:
            best_category = max(combined_scores, key=combined_scores.get)
            score_value = combined_scores[best_category]
            
            # Confidence calculation: base on weighted score
            # Phrases are worth more, so max is typically 3+1=4 per hit
            confidence = min(0.95, 0.4 + (score_value * 0.15))  # Scale 0.4 → 0.95

            # Get alternatives
            sorted_categories = sorted(
                combined_scores.items(),
                key=lambda x: x[1],
                reverse=True
            )
            alternatives = [
                {
                    'category': cat,
                    'frontend_category': self._map_to_frontend_category(cat),
                    'confidence': min(0.95, 0.4 + (score * 0.15))
                }
                for cat, score in sorted_categories[1:3]
                if score > 0
            ]

            # Boost confidence if images provided
            if num_images > 0:
                confidence = min(1.0, confidence + (0.05 * num_images))

            return {
                'category': best_category,
                'frontend_category': self._map_to_frontend_category(best_category),
                'confidence': confidence,
                'alternative_categories': alternatives,
                'method': 'keyword',
                'reason': f'Keyword matching: {score_value} scoring points'
            }
        else:
            # No keywords matched, default to "other"
            return {
                'category': 'other',
                'frontend_category': 'Others',
                'confidence': 0.3,
                'alternative_categories': [],
                'method': 'default',
                'reason': 'No specific keywords matched'
            }

    def get_category_suggestions(self, partial_text: str) -> list:
        """
        Get real-time category suggestions while user types
        
        Args:
            partial_text (str): Partial incident description
            
        Returns:
            list: Suggested categories with scores
        """
        if len(partial_text) < 3:
            return []

        result = self.categorize(partial_text)
        suggestions = [
            {
                'category': result['category'],
                'frontend_category': result.get('frontend_category', 'Others'),
                'confidence': result['confidence']
            }
        ]

        if result['alternative_categories']:
            suggestions.extend(result['alternative_categories'][:2])

        return suggestions


# Global categorizer instance
_categorizer = None


def get_categorizer() -> IncidentCategorizer:
    """Get or create the global categorizer instance"""
    global _categorizer
    if _categorizer is None:
        _categorizer = IncidentCategorizer()
    return _categorizer


def categorize_incident(description: str, num_images: int = 0) -> Dict[str, any]:
    """
    Convenience function to categorize an incident
    
    Args:
        description (str): Incident description
        num_images (int): Number of attached images
        
    Returns:
        dict: Categorization result
    """
    categorizer = get_categorizer()
    return categorizer.categorize(description, num_images)


if __name__ == '__main__':
    # Test the categorizer
    categorizer = IncidentCategorizer()

    test_cases = [
        "A car hit another vehicle on Main Street, both drivers injured",
        "Someone broke into my house and stole my laptop",
        "There's a fire in the apartment building downtown",
        "The street is completely flooded after heavy rain",
        "I saw someone acting suspicious near the park",
        "The streetlight has been broken for weeks",
    ]

    print("Testing Incident Categorizer\n" + "=" * 50)
    for test in test_cases:
        result = categorizer.categorize(test)
        print(f"\nInput: {test}")
        print(f"Category: {result['category'].title()}")
        print(f"Confidence: {result['confidence']:.2%}")
        print(f"Method: {result['method']}")
