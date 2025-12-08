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

    # Enhanced priority mapping with numeric scores for precise ranking
    # Score: 1-10 scale where 10 = most critical/urgent
    # Priority values are CAPITALIZED to match frontend filter options exactly
    CATEGORY_PRIORITY = {
        'Crime': {'level': 'Critical', 'score': 10, 'color': '#c0392b', 'label': '🔴 Critical'},
        'Hazard': {'level': 'High', 'score': 8, 'color': '#d35400', 'label': '🟠 High'},
        'Concern': {'level': 'Medium', 'score': 5, 'color': '#95a5a6', 'label': '⚪ Medium'},
        'Lost&Found': {'level': 'Low', 'score': 2, 'color': '#95a5a6', 'label': '⚪ Low'},
        'Others': {'level': 'Low', 'score': 1, 'color': '#95a5a6', 'label': '⚪ Low'},
    }
    
    # Sub-category priority modifiers (adjusts base priority score)
    # Positive = higher priority, Negative = lower priority
    SUBCATEGORY_PRIORITY_MODIFIERS = {
        'violence': 2,      # Violence is most critical crime
        'theft': 0,         # Standard crime severity
        'harassment': -1,   # Slightly less urgent than physical crimes
        'vandalism': -2,    # Property crime, lower priority
        'fire': 2,          # Fire is most critical hazard
        'flood': 1,         # Flood is high priority
        'hazard': 0,        # Standard hazard
        'accident': 1,      # Accidents need quick response
        'suspicious': 0,    # Standard concern
        'lostfound': 0,     # Standard low priority
        'other': 0,         # Baseline
    }

    # Enhanced weighted keywords with urgency indicators
    # critical = 5 points (life-threatening), high = 4 points, medium = 2 points, low = 1 point
    WEIGHTED_KEYWORDS = {
        'theft': {
            'critical': ['armed robbery', 'robbery at gunpoint', 'holdup', 'kidnapping', 'carjacking', 'home invasion'],
            'high': ['robbery', 'burglary', 'carnapping', 'mugging', 'heist', 'break-in', 'forced entry'],
            'medium': ['stolen', 'steal', 'stole', 'theft', 'robbed', 'snatching', 'pickpocket', 'shoplifting', 'took my'],
            'low': ['intruder', 'trespassing', 'missing items', 'items gone', 'belongings missing']
        },
        'fire': {
            'critical': ['building on fire', 'house fire', 'trapped in fire', 'explosion', 'gas explosion', 'inferno', 'engulfed'],
            'high': ['fire', 'blaze', 'ablaze', 'burning building', 'fire spreading', 'flames everywhere'],
            'medium': ['smoke', 'burning', 'flames', 'combustion', 'on fire', 'fire alarm', 'smell of burning'],
            'low': ['smoldering', 'spark', 'overheating', 'electrical smell']
        },
        'flood': {
            'critical': ['flash flood', 'people stranded', 'cars submerged', 'rising water level', 'flood emergency'],
            'high': ['flood', 'flooding', 'deluge', 'inundated', 'severe flooding', 'water rising fast'],
            'medium': ['waterlogged', 'submerged', 'overflow', 'water rising', 'heavy rain flooding'],
            'low': ['water damage', 'wet floor', 'puddle', 'drainage issue', 'minor flooding']
        },
        'accident': {
            'critical': ['fatal accident', 'multiple casualties', 'hit and run', 'pedestrian hit', 'serious collision', 'unconscious'],
            'high': ['car crash', 'collision', 'vehicular accident', 'motorcycle accident', 'major accident', 'severely injured'],
            'medium': ['accident', 'crash', 'injured', 'wounded', 'emergency', 'wreck', 'traffic accident'],
            'low': ['minor accident', 'fender bender', 'traffic incident', 'slight damage', 'small collision']
        },
        'violence': {
            'critical': ['murder', 'stabbing', 'shooting', 'gunfire', 'killed', 'shot', 'knife attack', 'deadly assault', 'hostage'],
            'high': ['assault', 'attack', 'beaten', 'physical assault', 'violent attack', 'badly hurt', 'bleeding'],
            'medium': ['violence', 'fight', 'fighting', 'aggressive', 'struck', 'punched', 'hit someone', 'attacked'],
            'low': ['altercation', 'confrontation', 'scuffle', 'pushing', 'shoving', 'verbal threat']
        },
        'harassment': {
            'critical': ['sexual assault', 'attempted rape', 'sexual harassment', 'child abuse', 'domestic violence'],
            'high': ['stalking', 'death threat', 'intimidation', 'severe harassment', 'threatening with weapon'],
            'medium': ['harassment', 'bullying', 'threatening', 'threat', 'harassed', 'molested', 'following me'],
            'low': ['pestered', 'annoying', 'unwanted attention', 'rude behavior', 'verbal harassment']
        },
        'vandalism': {
            'critical': ['arson', 'building destroyed', 'vehicle destroyed', 'massive property damage'],
            'high': ['vandalism', 'destroyed', 'smashed', 'major damage', 'completely wrecked'],
            'medium': ['graffiti', 'defaced', 'damaged property', 'spray paint', 'broken windows', 'slashed tires'],
            'low': ['scratched', 'minor damage', 'littering', 'small graffiti', 'minor vandalism']
        },
        'suspicious': {
            'critical': ['suspicious package', 'bomb threat', 'armed person', 'terrorist activity', 'unknown armed individual'],
            'high': ['suspicious person', 'prowler', 'unknown person lurking', 'watching children', 'casing the area'],
            'medium': ['suspicious', 'strange', 'loitering', 'trespassing', 'watching', 'following', 'strange behavior'],
            'low': ['unusual', 'weird', 'unfamiliar person', 'acting odd', 'strange activity']
        },
        'hazard': {
            'critical': ['gas leak', 'electrocution', 'building collapse', 'landslide', 'exposed live wire', 'toxic spill'],
            'high': ['major pothole', 'dangerous intersection', 'broken infrastructure', 'fallen power line', 'sinkhole'],
            'medium': ['hazard', 'danger', 'pothole', 'unsafe', 'broken utility', 'road damage'],
            'low': ['streetlight out', 'minor debris', 'obstruction', 'drainage problem', 'cracked sidewalk']
        },
        'lostfound': {
            'critical': ['lost child', 'missing child', 'missing person', 'missing elderly', 'lost senior citizen'],
            'high': ['found child', 'found elderly', 'lost pet', 'missing pet', 'found person'],
            'medium': ['lost', 'found', 'missing', 'wallet', 'phone', 'keys', 'bag', 'dog', 'cat', 'purse'],
            'low': ['misplaced', 'left behind', 'forgotten item', 'found item']
        },
        'other': {
            'critical': [],
            'high': [],
            'medium': ['other', 'misc', 'issue', 'concern', 'general', 'report'],
            'low': ['help', 'inquiry', 'question', 'request', 'information']
        }
    }
    
    # Context modifiers that boost confidence when present
    CONTEXT_BOOSTERS = {
        'urgency_words': {
            'words': ['urgent', 'emergency', 'immediately', 'help', 'please help', 'asap', 'right now', 'quickly', 'hurry'],
            'boost': 0.05
        },
        'time_indicators': {
            'words': ['just happened', 'happening now', 'ongoing', 'currently', 'right now', 'in progress', 'just saw'],
            'boost': 0.04
        },
        'location_specificity': {
            'words': ['at the', 'near the', 'in front of', 'behind', 'beside', 'corner of', 'intersection', 'street', 'avenue', 'road'],
            'boost': 0.03
        },
        'witness_indicators': {
            'words': ['i saw', 'i witnessed', 'i noticed', 'we saw', 'someone saw', 'caught on camera', 'cctv', 'video evidence'],
            'boost': 0.04
        }
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
                'severity': str (critical/high/medium/low),
                'severity_score': int (1-10),
                'severity_label': str (emoji + label),
                'alternative_categories': list,
                'method': str ('ml' or 'keyword')
            }
        """
        if not description or len(description.strip()) < 5:
            return {
                'category': 'other',
                'frontend_category': 'Others',
                'confidence': 0.0,
                'confidence_percent': 0,
                'priority': 'Low',  # Capitalized for frontend filter match
                'priority_score': 1,
                'priority_label': '⚪ Low',
                'severity': 'low',  # Backward compatibility
                'severity_score': 1,
                'severity_label': '⚪ Low',
                'alternative_categories': [],
                'method': 'default',
                'reason': 'Description too short'
            }

        # Clean and lowercase text
        clean_text = description.lower().strip()

        # Helper to get priority info for a category
        def get_priority_for_category(ai_cat, frontend_cat):
            priority_info = self.CATEGORY_PRIORITY.get(frontend_cat, {'level': 'Low', 'score': 1, 'label': '⚪ Low'})
            priority_modifier = self.SUBCATEGORY_PRIORITY_MODIFIERS.get(ai_cat, 0)
            adjusted_score = max(1, min(10, priority_info['score'] + priority_modifier))
            return {
                'priority': priority_info['level'],  # Capitalized: Critical/High/Medium/Low
                'priority_score': adjusted_score,
                'priority_label': priority_info.get('label', '⚪ Low'),
                # Keep severity for backward compatibility
                'severity': priority_info['level'].lower(),
                'severity_score': adjusted_score,
                'severity_label': priority_info.get('label', '⚪ Low')
            }

        # 1. PHRASE PATTERN DETECTION (highest priority for accuracy)
        # Check multi-word phrases first as they're highly contextual
        for category, phrases in self.phrase_patterns.items():
            for phrase in phrases:
                if phrase.lower() in clean_text:
                    frontend_cat = self._map_to_frontend_category(category)
                    pri = get_priority_for_category(category, frontend_cat)
                    return {
                        'category': category,
                        'frontend_category': frontend_cat,
                        'confidence': 0.92,
                        'confidence_percent': 92,
                        'priority': pri['priority'],
                        'priority_score': pri['priority_score'],
                        'priority_label': pri['priority_label'],
                        'severity': pri['severity'],
                        'severity_score': pri['severity_score'],
                        'severity_label': pri['severity_label'],
                        'alternative_categories': [],
                        'method': 'phrase_pattern',
                        'reason': f'Matched phrase pattern: "{phrase}"'
                    }

        # 2. HEURISTIC RULES for high-confidence keyword categories
        #  - Lost & Found: explicit object words + lost/found indicators
        lost_indicators = ['lost', 'found', 'missing', 'lost & found', 'lost and found', 'locate']
        lost_objects = ['wallet', 'phone', 'bag', 'purse', 'keys', 'backpack', 'id', 'passport', 'dog', 'cat', 'keychain']
        if any(ind in clean_text for ind in lost_indicators) and any(obj in clean_text for obj in lost_objects):
            frontend_cat = self._map_to_frontend_category('lostfound')
            pri = get_priority_for_category('lostfound', frontend_cat)
            return {
                'category': 'lostfound',
                'frontend_category': frontend_cat,
                'confidence': 0.95,
                'confidence_percent': 95,
                'priority': pri['priority'],
                'priority_score': pri['priority_score'],
                'priority_label': pri['priority_label'],
                'severity': pri['severity'],
                'severity_score': pri['severity_score'],
                'severity_label': pri['severity_label'],
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
                frontend_cat = self._map_to_frontend_category(cat)
                pri = get_priority_for_category(cat, frontend_cat)
                return {
                    'category': cat,
                    'frontend_category': frontend_cat,
                    'confidence': 0.90,
                    'confidence_percent': 90,
                    'priority': pri['priority'],
                    'priority_score': pri['priority_score'],
                    'priority_label': pri['priority_label'],
                    'severity': pri['severity'],
                    'severity_score': pri['severity_score'],
                    'severity_label': pri['severity_label'],
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

            # Get priority info for the category
            frontend_cat = self._map_to_frontend_category(category)
            priority_info = self.CATEGORY_PRIORITY.get(frontend_cat, {'level': 'Low', 'score': 1, 'label': '⚪ Low'})
            priority_modifier = self.SUBCATEGORY_PRIORITY_MODIFIERS.get(category, 0)
            adjusted_priority_score = max(1, min(10, priority_info['score'] + priority_modifier))

            return {
                'category': category,
                'frontend_category': frontend_cat,
                'confidence': confidence,
                'confidence_percent': int(round(confidence * 100)),
                'priority': priority_info['level'],  # Capitalized for frontend
                'priority_score': adjusted_priority_score,
                'priority_label': priority_info.get('label', '⚪ Low'),
                'severity': priority_info['level'].lower(),  # Backward compatibility
                'severity_score': adjusted_priority_score,
                'severity_label': priority_info.get('label', '⚪ Low'),
                'alternative_categories': alternatives,
                'method': 'ml',
                'reason': f'ML model prediction: {confidence:.2%} confidence'
            }
        except Exception as e:
            logger.error(f"ML categorization error: {e}")
            return self._keyword_categorize(text, num_images)

    def _keyword_categorize(self, text: str, num_images: int = 0) -> Dict[str, any]:
        """
        Advanced categorization using weighted keyword matching with severity scoring.
        Uses a multi-tier keyword system (critical/high/medium/low) for accurate confidence.
        """
        
        # Calculate word count for description quality assessment
        word_count = len(text.split())
        
        # Quality bonus based on description detail (0-12%)
        if word_count >= 50:
            length_bonus = 0.12
        elif word_count >= 30:
            length_bonus = 0.08
        elif word_count >= 15:
            length_bonus = 0.05
        elif word_count >= 8:
            length_bonus = 0.02
        else:
            length_bonus = 0.0
        
        # Context boost calculation
        context_boost = 0.0
        context_matches = []
        for booster_name, booster_data in self.CONTEXT_BOOSTERS.items():
            for word in booster_data['words']:
                if word.lower() in text:
                    context_boost += booster_data['boost']
                    context_matches.append(booster_name)
                    break  # Only count each category once
        context_boost = min(0.12, context_boost)  # Cap at 12%
        
        # Score each category using weighted keywords
        category_scores = {}
        category_details = {}
        
        for category, weight_groups in self.WEIGHTED_KEYWORDS.items():
            weighted_score = 0
            total_possible = 0
            matched_keywords = []
            severity_level = 'low'  # Track highest matched severity
            
            # Critical keywords (weight: 5) - life-threatening situations
            for kw in weight_groups.get('critical', []):
                total_possible += 5
                if kw.lower() in text:
                    weighted_score += 5
                    matched_keywords.append(f"[CRITICAL] {kw}")
                    severity_level = 'critical'
            
            # High priority keywords (weight: 4)
            for kw in weight_groups.get('high', []):
                total_possible += 4
                if kw.lower() in text:
                    weighted_score += 4
                    matched_keywords.append(f"[HIGH] {kw}")
                    if severity_level not in ['critical']:
                        severity_level = 'high'
            
            # Medium priority keywords (weight: 2)
            for kw in weight_groups.get('medium', []):
                total_possible += 2
                if kw.lower() in text:
                    weighted_score += 2
                    matched_keywords.append(f"[MED] {kw}")
                    if severity_level not in ['critical', 'high']:
                        severity_level = 'medium'
            
            # Low priority keywords (weight: 1)
            for kw in weight_groups.get('low', []):
                total_possible += 1
                if kw.lower() in text:
                    weighted_score += 1
                    matched_keywords.append(f"[LOW] {kw}")
            
            # Also check phrase patterns (weight: 6 - highest contextual priority)
            for phrase in self.phrase_patterns.get(category, []):
                if phrase.lower() in text:
                    weighted_score += 6
                    total_possible += 6
                    matched_keywords.append(f"[PHRASE] {phrase}")
                    if severity_level not in ['critical']:
                        severity_level = 'high'
            
            # Calculate raw score (0-1 range based on matches, not total possible)
            # This rewards having more keyword matches
            match_count = len(matched_keywords)
            if match_count > 0:
                # Score based on quality of matches (weighted score) and quantity
                raw_score = min(1.0, (weighted_score / max(total_possible, 1)) + (match_count * 0.05))
            else:
                raw_score = 0
            
            category_scores[category] = raw_score
            category_details[category] = {
                'weighted_score': weighted_score,
                'total_possible': total_possible,
                'matched': matched_keywords,
                'match_count': match_count,
                'severity_level': severity_level
            }
        
        # Find best matching category
        if max(category_scores.values()) > 0:
            best_category = max(category_scores, key=category_scores.get)
            raw_score = category_scores[best_category]
            details = category_details[best_category]
            match_count = details['match_count']
            severity_level = details['severity_level']
            
            # Calculate confidence using improved tiered formula
            # Base confidence depends on severity of matched keywords
            if severity_level == 'critical':
                base_confidence = 0.78  # Critical matches start high
            elif severity_level == 'high':
                base_confidence = 0.70  # High priority matches
            elif severity_level == 'medium':
                base_confidence = 0.62  # Medium matches
            else:
                base_confidence = 0.55  # Low priority matches
            
            # Keyword quality contribution (up to 15%)
            keyword_contribution = min(0.15, raw_score * 0.18)
            
            # Match quantity bonus (up to 8%)
            quantity_bonus = min(0.08, match_count * 0.015)
            
            # Image evidence bonus (up to 8% for 3+ images)
            image_bonus = min(0.08, num_images * 0.028)
            
            # Calculate final confidence
            confidence = base_confidence + keyword_contribution + quantity_bonus + length_bonus + context_boost + image_bonus
            
            # Apply category-specific adjustments
            if best_category in ['violence', 'fire']:
                confidence = min(0.98, confidence + 0.03)  # Boost for most critical
            elif best_category == 'other':
                confidence = min(0.72, confidence)  # Cap "other" category confidence
            
            # Clamp between 55-98%
            confidence = max(0.55, min(0.98, confidence))
            
            # Get priority info
            frontend_category = self._map_to_frontend_category(best_category)
            priority_info = self.CATEGORY_PRIORITY.get(frontend_category, {'level': 'Low', 'score': 1})
            
            # Apply subcategory priority modifier
            priority_modifier = self.SUBCATEGORY_PRIORITY_MODIFIERS.get(best_category, 0)
            adjusted_priority_score = max(1, min(10, priority_info['score'] + priority_modifier))
            
            # Map severity_level to capitalized priority for frontend
            priority_level_map = {'critical': 'Critical', 'high': 'High', 'medium': 'Medium', 'low': 'Low'}
            priority_from_matched = priority_level_map.get(severity_level, 'Low')

            # Get alternative categories
            sorted_categories = sorted(
                category_scores.items(),
                key=lambda x: x[1],
                reverse=True
            )
            alternatives = []
            for cat, score in sorted_categories[1:3]:
                if score > 0:
                    alt_details = category_details[cat]
                    alt_severity = alt_details['severity_level']
                    if alt_severity == 'critical':
                        alt_base = 0.75
                    elif alt_severity == 'high':
                        alt_base = 0.68
                    elif alt_severity == 'medium':
                        alt_base = 0.60
                    else:
                        alt_base = 0.55
                    alt_conf = max(0.55, min(0.90, alt_base + score * 0.15))
                    alternatives.append({
                        'category': cat,
                        'frontend_category': self._map_to_frontend_category(cat),
                        'confidence': round(alt_conf, 2),
                        'confidence_percent': int(round(alt_conf * 100))
                    })

            return {
                'category': best_category,
                'frontend_category': frontend_category,
                'confidence': round(confidence, 2),
                'confidence_percent': int(round(confidence * 100)),
                'priority': priority_from_matched,  # Capitalized for frontend filter
                'priority_score': adjusted_priority_score,
                'priority_label': priority_info.get('label', '⚪ Low'),
                'severity': severity_level,  # Backward compatibility (lowercase)
                'severity_score': adjusted_priority_score,
                'severity_label': priority_info.get('label', '⚪ Low'),
                'alternative_categories': alternatives,
                'method': 'weighted_keyword',
                'reason': f"Matched {match_count} keywords ({severity_level} priority) with {details['weighted_score']} weighted points",
                'matched_keywords': details['matched'][:6],  # Return top 6 matched keywords
                'context_factors': context_matches[:3] if context_matches else []
            }
        else:
            # No keywords matched, default to "other"
            base_confidence = 0.55 + length_bonus + context_boost + min(0.05, num_images * 0.02)
            return {
                'category': 'other',
                'frontend_category': 'Others',
                'confidence': round(max(0.55, min(0.68, base_confidence)), 2),
                'confidence_percent': int(round(max(0.55, min(0.68, base_confidence)) * 100)),
                'priority': 'Low',  # Capitalized for frontend filter
                'priority_score': 1,
                'priority_label': '⚪ Low',
                'severity': 'low',  # Backward compatibility
                'severity_score': 1,
                'severity_label': '⚪ Low',
                'alternative_categories': [],
                'method': 'default',
                'reason': 'No specific keywords matched - categorized as general report',
                'matched_keywords': [],
                'context_factors': context_matches[:3] if context_matches else []
            }

    def get_category_suggestions(self, partial_text: str) -> list:
        """
        Get real-time category suggestions while user types
        
        Args:
            partial_text (str): Partial incident description
            
        Returns:
            list: Suggested categories with scores and severity
        """
        if len(partial_text) < 3:
            return []

        result = self.categorize(partial_text)
        suggestions = [
            {
                'category': result['category'],
                'frontend_category': result.get('frontend_category', 'Others'),
                'confidence': result['confidence'],
                'confidence_percent': result.get('confidence_percent', int(round(result['confidence'] * 100))),
                'severity': result.get('severity', 'low'),
                'severity_score': result.get('severity_score', 1),
                'severity_label': result.get('severity_label', '⚪ Low')
            }
        ]

        if result['alternative_categories']:
            for alt in result['alternative_categories'][:2]:
                alt['confidence_percent'] = int(round(alt['confidence'] * 100))
                # Add severity info for alternatives
                alt_frontend = alt.get('frontend_category', 'Others')
                alt_severity = self.CATEGORY_SEVERITY.get(alt_frontend, {'level': 'low', 'score': 1, 'label': '⚪ Low'})
                alt['severity'] = alt_severity['level']
                alt['severity_score'] = alt_severity['score']
                alt['severity_label'] = alt_severity.get('label', '⚪ Low')
                suggestions.append(alt)

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
