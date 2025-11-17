"""
Ollama Integration Service
Handles connections to local Ollama models for LLM and embeddings
"""

import os
import logging
import json
import requests
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class OllamaService:
    """Service for interacting with Ollama models"""
    
    def __init__(self):
        """Initialize Ollama service with configuration"""
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.llm_model = os.getenv("LLM_MODEL", "phi4:mini-q4_0")
        self.embed_model = os.getenv("EMBED_MODEL", "bge-m3")
        self.timeout = 120  # Increased timeout for LLM responses
        
        logger.info(f"Ollama Service initialized with LLM: {self.llm_model}, Embed: {self.embed_model}")
        
        # Check connection on init
        self._verify_connection()
    
    def _verify_connection(self) -> bool:
        """Verify Ollama server is running and accessible"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                logger.info("✓ Ollama server connected successfully")
                return True
        except Exception as e:
            logger.error(f"✗ Failed to connect to Ollama: {e}")
            logger.warning(f"  Make sure Ollama is running at {self.base_url}")
            return False
    
    def verify_models(self) -> Dict[str, bool]:
        """Verify that required models are available"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code != 200:
                return {"llm": False, "embed": False, "error": "Cannot reach Ollama"}
            
            models = response.json().get("models", [])
            model_names = [m.get("name", "").split(":")[0] for m in models]
            
            llm_available = self.llm_model.split(":")[0] in model_names
            embed_available = self.embed_model.split(":")[0] in model_names
            
            result = {
                "llm": llm_available,
                "embed": embed_available,
                "available_models": [m.get("name") for m in models]
            }
            
            if llm_available:
                logger.info(f"✓ LLM model available: {self.llm_model}")
            else:
                logger.warning(f"✗ LLM model not found: {self.llm_model}")
            
            if embed_available:
                logger.info(f"✓ Embedding model available: {self.embed_model}")
            else:
                logger.warning(f"✗ Embedding model not found: {self.embed_model}")
            
            return result
        except Exception as e:
            logger.error(f"Error verifying models: {e}")
            return {"llm": False, "embed": False, "error": str(e)}
    
    def generate(self, prompt: str, stream: bool = False, **kwargs) -> str:
        """
        Generate text using LLM model
        
        Args:
            prompt: Input prompt for the model
            stream: Whether to stream the response
            **kwargs: Additional parameters (temperature, top_p, etc.)
        
        Returns:
            Generated text response
        """
        try:
            url = f"{self.base_url}/api/generate"
            
            payload = {
                "model": self.llm_model,
                "prompt": prompt,
                "stream": False,  # We'll handle sync response for simplicity
                "temperature": kwargs.get("temperature", 0.7),
                "top_p": kwargs.get("top_p", 0.9),
                "num_ctx": kwargs.get("num_ctx", 2048),
            }
            
            response = requests.post(url, json=payload, timeout=self.timeout)
            response.raise_for_status()
            
            result = response.json()
            generated_text = result.get("response", "").strip()
            
            logger.debug(f"Generated text length: {len(generated_text)} chars")
            return generated_text
            
        except requests.Timeout:
            error_msg = f"Ollama request timeout after {self.timeout}s"
            logger.error(error_msg)
            return f"Error: {error_msg}"
        except Exception as e:
            logger.error(f"Error generating text: {e}")
            return f"Error: {str(e)}"
    
    def embed(self, text: str) -> Optional[List[float]]:
        """
        Generate embeddings for text using embedding model
        
        Args:
            text: Text to embed
        
        Returns:
            Embedding vector or None if failed
        """
        try:
            if not text or not text.strip():
                return None
            
            url = f"{self.base_url}/api/embed"
            
            payload = {
                "model": self.embed_model,
                "input": text,
            }
            
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            embeddings = result.get("embeddings", [])
            
            if embeddings and len(embeddings) > 0:
                return embeddings[0]
            
            logger.warning("No embeddings returned from Ollama")
            return None
            
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            return None
    
    def batch_embed(self, texts: List[str]) -> List[Optional[List[float]]]:
        """
        Generate embeddings for multiple texts
        
        Args:
            texts: List of texts to embed
        
        Returns:
            List of embedding vectors
        """
        embeddings = []
        for text in texts:
            emb = self.embed(text)
            embeddings.append(emb)
        return embeddings
    
    def chat(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """
        Chat with the model using message history
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            **kwargs: Additional parameters
        
        Returns:
            Model response
        """
        try:
            url = f"{self.base_url}/api/chat"
            
            payload = {
                "model": self.llm_model,
                "messages": messages,
                "stream": False,
                "temperature": kwargs.get("temperature", 0.7),
                "num_ctx": kwargs.get("num_ctx", 2048),
            }
            
            response = requests.post(url, json=payload, timeout=self.timeout)
            response.raise_for_status()
            
            result = response.json()
            assistant_message = result.get("message", {}).get("content", "").strip()
            
            return assistant_message
            
        except requests.Timeout:
            error_msg = f"Chat request timeout after {self.timeout}s"
            logger.error(error_msg)
            return f"Error: {error_msg}"
        except Exception as e:
            logger.error(f"Error in chat: {e}")
            return f"Error: {str(e)}"
    
    def summarize(self, text: str, max_length: int = 150) -> str:
        """
        Summarize text using LLM
        
        Args:
            text: Text to summarize
            max_length: Maximum summary length
        
        Returns:
            Summarized text
        """
        prompt = f"""Summarize the following text in {max_length} words or less. 
Be concise and capture the main points.

Text: {text}

Summary:"""
        
        return self.generate(prompt, temperature=0.5)
    
    def categorize_incident(self, description: str) -> Dict[str, Any]:
        """
        Categorize an incident using LLM with context
        
        Args:
            description: Incident description
        
        Returns:
            Dict with category, confidence, and reasoning
        """
        categories = [
            "Theft/Robbery", "Fire/Explosion", "Flood/Water",
            "Accident", "Violence/Assault", "Harassment",
            "Vandalism", "Suspicious Activity", "Lost & Found",
            "Hazard/Infrastructure", "Other"
        ]
        
        prompt = f"""You are an incident categorization AI. Categorize this incident into ONE of these categories:
{', '.join(categories)}

Incident Description: {description}

Respond in this exact format:
CATEGORY: [chosen category]
CONFIDENCE: [0.0-1.0]
REASONING: [brief explanation]"""
        
        response = self.generate(prompt, temperature=0.3)
        
        # Parse response
        result = {
            "category": "Other",
            "confidence": 0.5,
            "reasoning": "Unable to parse response",
            "raw_response": response
        }
        
        try:
            lines = response.split("\n")
            for line in lines:
                if "CATEGORY:" in line:
                    result["category"] = line.split("CATEGORY:")[-1].strip()
                elif "CONFIDENCE:" in line:
                    conf_str = line.split("CONFIDENCE:")[-1].strip()
                    result["confidence"] = float(conf_str.split()[0])
                elif "REASONING:" in line:
                    result["reasoning"] = line.split("REASONING:")[-1].strip()
        except Exception as e:
            logger.warning(f"Error parsing categorization response: {e}")
        
        return result
    
    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """
        Extract entities (people, locations, times) from text
        
        Args:
            text: Text to extract entities from
        
        Returns:
            Dict with entity types and values
        """
        prompt = f"""Extract named entities from this text. Return as JSON.
Look for: people, locations, dates/times, organizations, phone numbers, emails

Text: {text}

JSON Response with keys: people, locations, dates, organizations, contacts"""
        
        response = self.generate(prompt, temperature=0.1)
        
        try:
            # Try to parse JSON from response
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                return json.loads(json_str)
        except Exception as e:
            logger.warning(f"Error parsing entities: {e}")
        
        return {
            "people": [],
            "locations": [],
            "dates": [],
            "organizations": [],
            "contacts": []
        }
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about loaded models"""
        return {
            "base_url": self.base_url,
            "llm_model": self.llm_model,
            "embed_model": self.embed_model,
            "models_verified": self.verify_models()
        }


# Global instance
_ollama_service = None

def get_ollama_service() -> OllamaService:
    """Get or create global Ollama service instance"""
    global _ollama_service
    if _ollama_service is None:
        _ollama_service = OllamaService()
    return _ollama_service
