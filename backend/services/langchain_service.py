"""
LangChain Integration Service
Implements chains for incident categorization, summarization, and Q&A
"""

import logging
from typing import Dict, Any, List, Optional
from langchain_ollama import OllamaLLM
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain.memory import ConversationBufferMemory
from services.ollama_service import get_ollama_service
from services.rag_service import get_rag_service

logger = logging.getLogger(__name__)


class LangChainService:
    """Service for LangChain chains and prompts"""
    
    def __init__(self):
        """Initialize LangChain service with Ollama LLM"""
        self.ollama = get_ollama_service()
        self.rag = get_rag_service()
        
        # Initialize LangChain LLM
        try:
            self.llm = OllamaLLM(
                model=self.ollama.llm_model,
                base_url=self.ollama.base_url,
                temperature=0.7,
            )
            logger.info(f"✓ LangChain LLM initialized with {self.ollama.llm_model}")
        except Exception as e:
            logger.error(f"Error initializing LangChain LLM: {e}")
            self.llm = None
        
        # Initialize conversation memory
        self.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
            max_token_limit=1000  # Limit memory to prevent token overflow
        )
        
        # Define prompt templates
        self._setup_prompts()
    
    def _setup_prompts(self):
        """Setup all prompt templates"""
        
        # Incident categorization prompt
        self.categorization_prompt = PromptTemplate(
            input_variables=["description"],
            template="""You are an incident categorization expert. Categorize this incident into ONE category:

Categories: Theft/Robbery, Fire/Explosion, Flood/Water, Accident, Violence/Assault, Harassment, Vandalism, Suspicious Activity, Lost & Found, Hazard/Infrastructure, Cybercrime, Other

Incident Description: {description}

Respond in this format:
CATEGORY: [category]
CONFIDENCE: [0.0-1.0]
REASONING: [brief explanation]
PRIORITY: [critical/high/medium/low]
GUIDANCE: [2-3 sentence guidance]"""
        )
        
        # Incident summarization prompt
        self.summarization_prompt = PromptTemplate(
            input_variables=["description"],
            template="""Summarize this incident report in 1-2 sentences, capturing key details:

{description}

Summary:"""
        )
        
        # Emergency guidance prompt
        self.guidance_prompt = PromptTemplate(
            input_variables=["incident_type", "context"],
            template="""You are an emergency response expert. Provide specific, actionable guidance for this incident:

Incident Type: {incident_type}
Context: {context}

Provide guidance in this format:
1. IMMEDIATE ACTIONS: [list 2-3 immediate steps]
2. EMERGENCY CONTACTS: [relevant phone numbers]
3. SAFETY TIPS: [2-3 important tips]"""
        )
        
        # Q&A prompt with RAG context
        self.qa_prompt = PromptTemplate(
            input_variables=["context", "question"],
            template="""You are Community Helper, an AI assistant for the Community Guard system.
Use the provided context to answer the user's question accurately and helpfully.

Context from knowledge base:
{context}

User Question: {question}

Provide a clear, helpful answer. If the answer is not in the context, say so."""
        )
    
    def categorize_incident(self, description: str) -> Dict[str, Any]:
        """
        Categorize an incident using LLM chain
        
        Args:
            description: Incident description
        
        Returns:
            Dict with category, confidence, reasoning, priority, guidance
        """
        try:
            if not self.llm:
                return {"error": "LLM not initialized", "category": "Other"}
            
            chain = LLMChain(llm=self.llm, prompt=self.categorization_prompt)
            response = chain.run(description=description)
            
            # Parse response
            result = {
                "category": "Other",
                "confidence": 0.5,
                "reasoning": "",
                "priority": "medium",
                "guidance": "",
                "raw_response": response
            }
            
            lines = response.split("\n")
            for line in lines:
                if "CATEGORY:" in line:
                    result["category"] = line.split("CATEGORY:")[-1].strip()
                elif "CONFIDENCE:" in line:
                    try:
                        conf_str = line.split("CONFIDENCE:")[-1].strip()
                        result["confidence"] = float(conf_str.split()[0])
                    except (ValueError, IndexError):
                        result["confidence"] = 0.5
                elif "REASONING:" in line:
                    result["reasoning"] = line.split("REASONING:")[-1].strip()
                elif "PRIORITY:" in line:
                    result["priority"] = line.split("PRIORITY:")[-1].strip().lower()
                elif "GUIDANCE:" in line:
                    result["guidance"] = line.split("GUIDANCE:")[-1].strip()
            
            logger.info(f"Categorized incident: {result['category']} ({result['confidence']:.0%})")
            return result
            
        except Exception as e:
            logger.error(f"Error categorizing incident: {e}")
            return {
                "error": str(e),
                "category": "Other",
                "confidence": 0.0
            }
    
    def summarize_incident(self, description: str) -> str:
        """
        Summarize an incident report
        
        Args:
            description: Full incident description
        
        Returns:
            Summarized text
        """
        try:
            if not self.llm:
                return "Unable to summarize: LLM not initialized"
            
            chain = LLMChain(llm=self.llm, prompt=self.summarization_prompt)
            summary = chain.run(description=description)
            
            return summary.strip()
            
        except Exception as e:
            logger.error(f"Error summarizing incident: {e}")
            return f"Error: {str(e)}"
    
    def get_emergency_guidance(self, incident_type: str, context: str = "") -> str:
        """
        Get emergency guidance for incident type
        
        Args:
            incident_type: Type of incident
            context: Additional context
        
        Returns:
            Formatted guidance
        """
        try:
            if not self.llm:
                return "Unable to get guidance: LLM not initialized"
            
            # Search RAG for relevant guidance
            rag_results = self.rag.search_emergency(incident_type, num_results=2)
            rag_context = "\n".join([r["document"] for r in rag_results]) if rag_results else ""
            
            chain = LLMChain(llm=self.llm, prompt=self.guidance_prompt)
            guidance = chain.run(incident_type=incident_type, context=context or rag_context)
            
            return guidance.strip()
            
        except Exception as e:
            logger.error(f"Error getting emergency guidance: {e}")
            return f"Error: {str(e)}"
    
    def answer_question(self, question: str, search_emergency: bool = False) -> str:
        """
        Answer a question using RAG context
        
        Args:
            question: User question
            search_emergency: Whether to search emergency collection
        
        Returns:
            Answer text
        """
        try:
            if not self.llm:
                return "Unable to answer: LLM not initialized"
            
            # Search appropriate collection
            if search_emergency or any(word in question.lower() for word in 
                                      ["emergency", "urgent", "help", "sos", "danger"]):
                rag_results = self.rag.search_emergency(question, num_results=3)
            else:
                rag_results = self.rag.search_knowledge(question, num_results=3)
            
            # Build context from RAG results
            context_text = "\n".join([f"- {r['document']}" for r in rag_results]) if rag_results else \
                          "No specific guidance found in knowledge base."
            
            chain = LLMChain(llm=self.llm, prompt=self.qa_prompt)
            answer = chain.run(context=context_text, question=question)
            
            # Add source info if available
            if rag_results:
                source_categories = set(r.get("metadata", {}).get("category", "general") 
                                       for r in rag_results)
                answer += f"\n\n_Source: {', '.join(source_categories)}_"
            
            return answer.strip()
            
        except Exception as e:
            logger.error(f"Error answering question: {e}")
            return f"Error: {str(e)}"
    
    def extract_entities_from_report(self, report_text: str) -> Dict[str, List[str]]:
        """
        Extract entities from incident report
        
        Args:
            report_text: Report text
        
        Returns:
            Dict with extracted entities
        """
        prompt = PromptTemplate(
            input_variables=["text"],
            template="""Extract the following entities from this incident report:
- People mentioned (names, descriptions)
- Locations (addresses, landmarks)
- Times (dates, times)
- Objects (vehicles, items)
- Phone numbers
- Email addresses

Report: {text}

Format response as:
PEOPLE: [list]
LOCATIONS: [list]
TIMES: [list]
OBJECTS: [list]
PHONE_NUMBERS: [list]
EMAILS: [list]"""
        )
        
        try:
            if not self.llm:
                return {}
            
            chain = LLMChain(llm=self.llm, prompt=prompt)
            response = chain.run(text=report_text)
            
            result = {
                "people": [],
                "locations": [],
                "times": [],
                "objects": [],
                "phone_numbers": [],
                "emails": []
            }
            
            # Parse response
            for line in response.split("\n"):
                if "PEOPLE:" in line:
                    result["people"] = [x.strip() for x in line.split("PEOPLE:")[-1].split(",")]
                elif "LOCATIONS:" in line:
                    result["locations"] = [x.strip() for x in line.split("LOCATIONS:")[-1].split(",")]
                elif "TIMES:" in line:
                    result["times"] = [x.strip() for x in line.split("TIMES:")[-1].split(",")]
                elif "OBJECTS:" in line:
                    result["objects"] = [x.strip() for x in line.split("OBJECTS:")[-1].split(",")]
                elif "PHONE_NUMBERS:" in line:
                    result["phone_numbers"] = [x.strip() for x in line.split("PHONE_NUMBERS:")[-1].split(",")]
                elif "EMAILS:" in line:
                    result["emails"] = [x.strip() for x in line.split("EMAILS:")[-1].split(",")]
            
            return result
            
        except Exception as e:
            logger.error(f"Error extracting entities: {e}")
            return {}
    
    def add_to_memory(self, role: str, content: str):
        """Add message to conversation memory"""
        self.memory.save_context({"input": content if role == "user" else ""}, 
                                {"output": content if role == "assistant" else ""})
    
    def get_memory_summary(self) -> str:
        """Get summary of conversation memory"""
        return self.memory.buffer


# Global instance
_langchain_service = None

def get_langchain_service() -> LangChainService:
    """Get or create global LangChain service instance"""
    global _langchain_service
    if _langchain_service is None:
        _langchain_service = LangChainService()
    return _langchain_service
