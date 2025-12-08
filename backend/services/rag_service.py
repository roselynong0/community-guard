"""
RAG (Retrieval-Augmented Generation) Service
Uses ChromaDB for vector storage and semantic search
"""

import os
import logging
from typing import List, Dict, Any, Optional, Tuple
import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv
from services.ollama_service import get_ollama_service

load_dotenv()
logger = logging.getLogger(__name__)


class RAGService:
    """Service for managing vector database and semantic search"""
    
    def __init__(self, persist_directory: str = None):
        """
        Initialize RAG service with ChromaDB
        
        Args:
            persist_directory: Directory to persist vector database
        """
        if persist_directory is None:
            backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            persist_directory = os.path.join(backend_dir, "chroma_db")
        
        self.persist_directory = persist_directory
        
        # Create directory if it doesn't exist
        os.makedirs(persist_directory, exist_ok=True)
        
        # Initialize ChromaDB client with persistence
        settings = Settings(
            chroma_db_impl="duckdb+parquet",
            persist_directory=persist_directory,
            anonymized_telemetry=False,
        )
        
        try:
            self.client = chromadb.Client(settings)
            logger.info(f"✓ ChromaDB initialized with persistence at {persist_directory}")
        except Exception as e:
            logger.error(f"✗ Failed to initialize ChromaDB: {e}")
            raise
        
        # Initialize Ollama service for embeddings
        self.ollama = get_ollama_service()
        
        # Collections dictionary
        self.collections = {}
        self._load_collections()
    
    def _load_collections(self):
        """Load or create default collections"""
        try:
            # Emergency guidance collection
            self.collections["emergency"] = self.client.get_or_create_collection(
                name="emergency_guidance",
                metadata={"description": "Emergency response guidance and contacts"},
                embedding_function=self._embed_function
            )
            
            # General knowledge collection
            self.collections["knowledge"] = self.client.get_or_create_collection(
                name="general_knowledge",
                metadata={"description": "System information and FAQs"},
                embedding_function=self._embed_function
            )
            
            # Incident reports collection
            self.collections["incidents"] = self.client.get_or_create_collection(
                name="incident_data",
                metadata={"description": "Historical incident reports for analysis"},
                embedding_function=self._embed_function
            )
            
            logger.info("✓ ChromaDB collections loaded/created successfully")
        except Exception as e:
            logger.error(f"Error loading collections: {e}")
            raise
    
    def _embed_function(self, texts: List[str]) -> List[List[float]]:
        """
        Custom embedding function using Ollama
        Required by ChromaDB as embedding_function parameter
        """
        embeddings = []
        for text in texts:
            emb = self.ollama.embed(text)
            if emb:
                embeddings.append(emb)
            else:
                # Return zero vector if embedding fails
                embeddings.append([0.0] * 384)  # bge-m3 default dimension
        return embeddings
    
    def add_documents(
        self, 
        collection_name: str,
        documents: List[str],
        ids: List[str],
        metadatas: List[Dict] = None
    ) -> bool:
        """
        Add documents to a collection
        
        Args:
            collection_name: Name of collection (emergency, knowledge, incidents)
            documents: List of document texts
            ids: List of unique document IDs
            metadatas: List of metadata dicts for each document
        
        Returns:
            True if successful
        """
        try:
            if collection_name not in self.collections:
                logger.error(f"Collection not found: {collection_name}")
                return False
            
            collection = self.collections[collection_name]
            
            # Add documents with embeddings handled by ChromaDB
            collection.add(
                documents=documents,
                ids=ids,
                metadatas=metadatas or [{} for _ in documents]
            )
            
            logger.info(f"✓ Added {len(documents)} documents to {collection_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error adding documents: {e}")
            return False
    
    def search(
        self,
        collection_name: str,
        query: str,
        num_results: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search for similar documents in a collection
        
        Args:
            collection_name: Name of collection
            query: Search query text
            num_results: Number of results to return
        
        Returns:
            List of result dicts with document, id, distance, metadata
        """
        try:
            if collection_name not in self.collections:
                logger.error(f"Collection not found: {collection_name}")
                return []
            
            collection = self.collections[collection_name]
            
            # Query the collection
            results = collection.query(
                query_texts=[query],
                n_results=num_results
            )
            
            # Format results
            formatted_results = []
            if results and results.get("documents"):
                for i, doc in enumerate(results["documents"][0]):
                    formatted_results.append({
                        "document": doc,
                        "id": results["ids"][0][i] if results.get("ids") else None,
                        "distance": results["distances"][0][i] if results.get("distances") else None,
                        "metadata": results["metadatas"][0][i] if results.get("metadatas") else {}
                    })
            
            logger.debug(f"Found {len(formatted_results)} results in {collection_name}")
            return formatted_results
            
        except Exception as e:
            logger.error(f"Error searching: {e}")
            return []
    
    def search_emergency(self, query: str, num_results: int = 3) -> List[Dict]:
        """Search emergency guidance collection"""
        return self.search("emergency", query, num_results)
    
    def search_knowledge(self, query: str, num_results: int = 3) -> List[Dict]:
        """Search general knowledge collection"""
        return self.search("knowledge", query, num_results)
    
    def search_incidents(self, query: str, num_results: int = 5) -> List[Dict]:
        """Search incident reports collection"""
        return self.search("incidents", query, num_results)
    
    def initialize_emergency_guidance(self):
        """Initialize emergency guidance collection with default content"""
        emergency_docs = [
            # Theft/Robbery
            {
                "text": "Theft/Robbery: Priority - HIGH. Guidance: Secure the area, do not chase the suspect. Call PNP 117 or national emergency 911. Direct contact: (02) 8722-0650. Always note suspect description, vehicle details.",
                "id": "theft_001",
                "category": "theft",
                "priority": "high"
            },
            {
                "text": "Theft prevention tips: Lock doors and windows, use security cameras, report suspicious behavior, secure valuables in safe places, vary your routine.",
                "id": "theft_002",
                "category": "theft",
                "priority": "medium"
            },
            # Assault/Violence
            {
                "text": "Crime/Assault: Priority - HIGH. Guidance: Seek immediate medical help. Preserve evidence. Call PNP 117 or 911. Victim support: DSWD (02) 8931-8101 to 07 or 0917-110-5686.",
                "id": "assault_001",
                "category": "assault",
                "priority": "high"
            },
            {
                "text": "Personal safety outside: Avoid walking alone at night, stay in well-lit areas, be aware of surroundings, trust your instincts, carry emergency numbers.",
                "id": "assault_002",
                "category": "assault",
                "priority": "high"
            },
            # Medical Emergency
            {
                "text": "Medical Emergency: Priority - CRITICAL. Guidance: Check ABC (Airway/Breathing/Circulation), call ambulance immediately. Contacts: 911, Red Cross 143, Hospital: (02) 527-0000.",
                "id": "medical_001",
                "category": "medical",
                "priority": "critical"
            },
            {
                "text": "First aid basics: CPR steps (30 compressions, 2 breaths), recovery position, wound care, shock management, do not move spinal injuries.",
                "id": "medical_002",
                "category": "medical",
                "priority": "critical"
            },
            # Fire
            {
                "text": "Fire Emergency: Priority - CRITICAL. Guidance: Evacuate low to avoid smoke, stay low and crawl, use wet cloth over mouth. Call BFP 911 or (02) 8426-5901 to 09.",
                "id": "fire_001",
                "category": "fire",
                "priority": "critical"
            },
            {
                "text": "Fire prevention: Check electrical appliances, keep fire extinguisher accessible, clear escape routes, have emergency numbers posted, practice evacuation.",
                "id": "fire_002",
                "category": "fire",
                "priority": "high"
            },
            # Flood/Disaster
            {
                "text": "Flood/Disaster: Priority - HIGH. Guidance: Move to higher ground immediately. Do not cross flooded areas. Call MMDA 136. Weather alerts: PAGASA (02) 8284-0800 or pagasa.dost.gov.ph.",
                "id": "flood_001",
                "category": "flood",
                "priority": "high"
            },
            {
                "text": "Flood preparation: Secure valuables, prepare emergency kit, know evacuation routes, keep important documents in waterproof containers.",
                "id": "flood_002",
                "category": "flood",
                "priority": "high"
            },
            # Cybercrime
            {
                "text": "Cybercrime: Priority - MEDIUM. Guidance: Change passwords immediately, report online. Contacts: NBI Cybercrime (02) 8523-8481 or cybercrime@doj.gov.ph; PNP ACG (02) 8723-0401 ext. 7491.",
                "id": "cyber_001",
                "category": "cybercrime",
                "priority": "medium"
            },
            # Earthquake
            {
                "text": "Earthquake Safety: If indoors - DROP, COVER, HOLD under desk/table. If outdoors - move away from buildings and hazards. Do not use elevators.",
                "id": "earthquake_001",
                "category": "earthquake",
                "priority": "critical"
            },
        ]
        
        documents = [doc["text"] for doc in emergency_docs]
        ids = [doc["id"] for doc in emergency_docs]
        metadatas = [{"category": doc["category"], "priority": doc["priority"]} for doc in emergency_docs]
        
        return self.add_documents("emergency", documents, ids, metadatas)
    
    def initialize_knowledge_base(self):
        """Initialize general knowledge collection"""
        knowledge_docs = [
            {
                "text": "Community Guard is a community-driven incident reporting system designed to enhance public safety and foster community engagement.",
                "id": "system_intro",
                "type": "system"
            },
            {
                "text": "Incident categories: Theft, Fire, Flood, Accident, Violence, Harassment, Vandalism, Suspicious Activity, Lost & Found, Hazard, Other.",
                "id": "categories",
                "type": "system"
            },
            {
                "text": "You can create incident reports with photos, description, location, and category. Reports help authorities and the community stay informed.",
                "id": "reporting",
                "type": "system"
            },
            {
                "text": "Emergency contacts: PNP 117, Fire 911, Ambulance 911, MMDA 136, Red Cross 143. Regional variations may apply.",
                "id": "contacts_general",
                "type": "system"
            },
        ]
        
        documents = [doc["text"] for doc in knowledge_docs]
        ids = [doc["id"] for doc in knowledge_docs]
        metadatas = [{"type": doc["type"]} for doc in knowledge_docs]
        
        return self.add_documents("knowledge", documents, ids, metadatas)
    
    def get_collection_stats(self, collection_name: str = None) -> Dict[str, Any]:
        """Get statistics about collections"""
        if collection_name and collection_name in self.collections:
            collection = self.collections[collection_name]
            return {
                "collection": collection_name,
                "count": collection.count()
            }
        
        # Return stats for all collections
        stats = {}
        for name, collection in self.collections.items():
            stats[name] = collection.count()
        
        return stats
    
    def delete_collection(self, collection_name: str) -> bool:
        """Delete and recreate a collection"""
        try:
            if collection_name in self.collections:
                self.client.delete_collection(collection_name)
                del self.collections[collection_name]
                logger.info(f"Deleted collection: {collection_name}")
            return True
        except Exception as e:
            logger.error(f"Error deleting collection: {e}")
            return False


# Global instance
_rag_service = None

def get_rag_service() -> RAGService:
    """Get or create global RAG service instance"""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
