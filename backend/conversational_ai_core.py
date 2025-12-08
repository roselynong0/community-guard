"""
Conversational AI Core
Bridges chatbot.py analytics with lean AI for natural conversations
Provides system knowledge, analytics, and emergency guidance
"""

import logging
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from typing import Dict, List, Optional, Any
from ai_core_lean import get_ai_core
from utils import supabase

logger = logging.getLogger(__name__)


class ConversationalAICore:
    """Conversational AI with system knowledge and analytics"""
    
    def __init__(self):
        self.ai_core = get_ai_core()
        self.system_knowledge = self._load_system_knowledge()
        self.user_context = {}
        
    def _load_system_knowledge(self) -> Dict:
        """Load system knowledge base"""
        return {
            "name": "Community Guard",
            "purpose": "Community Guard is a comprehensive community safety and incident reporting platform designed to empower residents, barangay officials, and responders to collaborate in creating safer neighborhoods.",
            "goal": "Provide a unified platform for reporting, tracking, and responding to community incidents in real-time, fostering transparency, accountability, and community engagement.",
            
            "features": {
                "incident_reporting": "Report various types of incidents including crime, hazards, accidents, harassment, vandalism, and lost & found items with detailed descriptions, images, and location data.",
                "ai_categorization": "AI-powered automatic categorization system that intelligently classifies incidents into appropriate categories (Crime, Hazard, Concern, Lost&Found, Others).",
                "real_time_mapping": "Interactive maps showing incident locations, allowing users to visualize safety trends and community hotspots across different barangays.",
                "notifications": "Real-time notifications for incident updates, official responses, and community alerts.",
                "community_feed": "A social feed where community members can discuss, share updates, and provide mutual support regarding local incidents.",
                "admin_dashboard": "Comprehensive analytics and reporting dashboard for admins to monitor community safety metrics and incident trends.",
                "barangay_management": "Tools for barangay officials to manage incidents, respond to reports, and coordinate with responders.",
                "responder_coordination": "Specialized tools for emergency responders to access incident data and track response status.",
                "user_roles": "Multiple user roles including Residents, Barangay Officials, Responders, and Admins with role-specific features.",
                "safety_tips": "Educational content providing safety guidelines and best practices.",
            },
            
            "incident_categories": {
                "Crime": "Theft, robbery, violence, assault, harassment, vandalism, and other criminal activities",
                "Hazard": "Infrastructure problems, fire, flooding, accidents, and environmental hazards",
                "Concern": "General concerns, suspicious activities, and unusual occurrences",
                "Lost&Found": "Lost or found items including wallets, phones, bags, keys, and personal belongings",
                "Others": "Any incident type that doesn't fit into the above categories",
            },
            
            "user_roles": {
                "Resident": {"permissions": ["report", "view_feed", "receive_alerts"], "access_level": 1},
                "Responder": {"permissions": ["report", "view_all", "update_status", "coordinate"], "access_level": 2},
                "Barangay Official": {"permissions": ["report", "view_barangay", "manage_incidents", "analytics"], "access_level": 3},
                "Admin": {"permissions": ["all"], "access_level": 4},
            },
        }
    
    def set_user_context(self, user_id: str, user_role: str, barangay: str = ""):
        """Set user context for personalized responses"""
        self.user_context = {
            "user_id": user_id,
            "role": user_role,
            "barangay": barangay,
            "timestamp": datetime.now()
        }
    
    def get_system_analytics(self) -> Dict[str, Any]:
        """Fetch comprehensive system analytics"""
        try:
            # Get all reports
            reports_response = supabase.table("reports").select("*").is_("deleted_at", "null").execute()
            reports = reports_response.data if reports_response.data else []
            
            # Get all users
            users_response = supabase.table("users").select("*").execute()
            users = users_response.data if users_response.data else []
            
            # Analyze reports
            total_reports = len(reports)
            category_counts = Counter()
            status_counts = Counter()
            barangay_counts = Counter()
            hourly_distribution = Counter()
            
            for report in reports:
                category_counts[report.get("category", "Others")] += 1
                status_counts[report.get("status", "pending").lower()] += 1
                barangay_counts[report.get("address_barangay", "Unknown")] += 1
                
                # Analyze time distribution
                created_at = report.get("created_at", "")
                if created_at and "T" in created_at:
                    hour = int(created_at.split("T")[1].split(":")[0])
                    hourly_distribution[hour] += 1
            
            # Analyze users
            total_users = len(users)
            user_roles = Counter()
            verified_users = sum(1 for u in users if u.get("is_verified"))
            
            for user in users:
                user_roles[user.get("role", "Resident")] += 1
            
            # Calculate peak hour
            peak_hour = max(hourly_distribution.items(), key=lambda x: x[1])[0] if hourly_distribution else 0
            
            return {
                "total_reports": total_reports,
                "total_users": total_users,
                "verified_users": verified_users,
                "categories": dict(category_counts),
                "statuses": dict(status_counts),
                "barangays": dict(barangay_counts),
                "user_roles": dict(user_roles),
                "peak_hour": peak_hour,
                "hourly_distribution": dict(hourly_distribution),
            }
        except Exception as e:
            logger.error(f"Error getting system analytics: {e}")
            return {}
    
    def search_knowledge_base(self, query: str) -> Optional[str]:
        """Search system knowledge base for relevant information"""
        query_lower = query.lower()
        
        # System name queries
        if any(phrase in query_lower for phrase in ["what is community guard", "tell me about community guard", "community guard"]):
            return f"🛡️ **Community Guard**\n\n{self.system_knowledge['purpose']}\n\n**Goal:** {self.system_knowledge['goal']}"
        
        # Purpose queries
        if any(phrase in query_lower for phrase in ["purpose", "what's the purpose", "what is the purpose"]):
            return f"🎯 **System Purpose**\n\n{self.system_knowledge['purpose']}"
        
        # Features queries
        if any(word in query_lower for word in ["feature", "capability"]):
            features_text = "✨ **Key Features**\n\n"
            for name, desc in self.system_knowledge["features"].items():
                features_text += f"• **{name.replace('_', ' ').title()}**\n  {desc}\n\n"
            return features_text
        
        # Incident categories
        if any(word in query_lower for word in ["category", "categories", "types of incidents", "incident types"]):
            cat_text = "📋 **Incident Categories**\n\n"
            emojis = {"Crime": "🚨", "Hazard": "⚠️", "Concern": "❓", "Lost&Found": "🔍", "Others": "📌"}
            for cat, desc in self.system_knowledge["incident_categories"].items():
                emoji = emojis.get(cat, "•")
                cat_text += f"{emoji} **{cat}** - {desc}\n\n"
            return cat_text
        
        # User roles
        if any(phrase in query_lower for phrase in ["user role", "roles", "user types", "who can access"]):
            roles_text = "👥 **User Roles**\n\n"
            role_emojis = {"Resident": "👤", "Barangay Official": "🏛️", "Responder": "🚑", "Admin": "⚙️"}
            for role, perms in self.system_knowledge["user_roles"].items():
                emoji = role_emojis.get(role, "•")
                roles_text += f"{emoji} **{role}** - Access Level {perms['access_level']}\n"
                roles_text += f"  Permissions: {', '.join(perms['permissions'])}\n\n"
            return roles_text
        
        # Emergency contacts
        if any(word in query_lower for word in ["emergency", "contact", "hotline", "help", "911", "117"]):
            contacts = self.ai_core.kb.EMERGENCY_CONTACTS.get("PH_HOTLINES", {})
            contacts_text = "🚨 **Emergency Contacts**\n\n"
            for service, number in contacts.items():
                contacts_text += f"• **{service}**: {number}\n"
            return contacts_text
        
        return None
    
    def process_conversation(self, user_message: str, user_role: str = "Resident", include_analytics: bool = False) -> str:
        """Process user message with context awareness"""
        
        # Check if asking for system information
        kb_response = self.search_knowledge_base(user_message)
        if kb_response:
            response = kb_response
        else:
            # Use lean AI for general conversation
            try:
                result = self.ai_core.categorizer.categorize(user_message)
                response = f"**Incident Analysis**\n\nCategory: {result['category']}\nPriority: {result['priority']}\nConfidence: {result['confidence']:.0%}\n\nGuidance: {result.get('guidance', 'Stay safe and follow local guidelines.')}"
            except Exception as e:
                logger.error(f"Lean AI error: {e}")
                response = "I'm here to help! You can ask me about the Community Guard system, emergency guidance, or report incidents."
        
        # Add analytics if requested and user has permission
        if include_analytics and user_role in ["Barangay Official", "Responder", "Admin"]:
            analytics = self.get_system_analytics()
            if analytics:
                response += "\n\n📊 **System Insights**\n"
                response += f"• Total Reports: {analytics.get('total_reports', 0)}\n"
                response += f"• Total Users: {analytics.get('total_users', 0)}\n"
                response += f"• Verified Users: {analytics.get('verified_users', 0)}\n"
                
                if analytics.get("categories"):
                    response += f"• Top Category: {max(analytics['categories'].items(), key=lambda x: x[1])[0]}\n"
                
                if analytics.get("peak_hour"):
                    response += f"• Peak Hour: {analytics['peak_hour']}:00\n"
        
        return response
    
    def get_role_based_insights(self, user_role: str) -> str:
        """Get personalized insights based on user role"""
        analytics = self.get_system_analytics()
        
        if not analytics:
            return "System analytics unavailable at this time."
        
        insights = "📊 **Role-Based Insights**\n\n"
        
        if user_role == "Resident":
            insights += f"🏘️ **Your Community**\n"
            insights += f"• Total Community Reports: {analytics.get('total_reports', 0)}\n"
            insights += f"• Active Community Members: {analytics.get('total_users', 0)}\n"
            
            categories = analytics.get("categories", {})
            if categories:
                most_common = max(categories.items(), key=lambda x: x[1])
                insights += f"• Most Common Incident: {most_common[0]} ({most_common[1]} reports)\n"
        
        elif user_role == "Responder":
            insights += f"🚑 **Response Overview**\n"
            insights += f"• Active Reports: {analytics.get('total_reports', 0)}\n"
            statuses = analytics.get("statuses", {})
            insights += f"• Pending: {statuses.get('pending', 0)} | Ongoing: {statuses.get('ongoing', 0)} | Resolved: {statuses.get('resolved', 0)}\n"
            insights += f"• Peak Response Time: {analytics.get('peak_hour', 0)}:00\n"
        
        elif user_role == "Barangay Official":
            insights += f"🏛️ **Barangay Statistics**\n"
            insights += f"• Total Reports: {analytics.get('total_reports', 0)}\n"
            insights += f"• Registered Residents: {analytics.get('total_users', 0)}\n"
            
            barangays = analytics.get("barangays", {})
            if barangays:
                top_barangay = max(barangays.items(), key=lambda x: x[1])
                insights += f"• Highest Report Area: {top_barangay[0]} ({top_barangay[1]} reports)\n"
        
        elif user_role == "Admin":
            insights += f"⚙️ **System Overview**\n"
            insights += f"• Total Reports: {analytics.get('total_reports', 0)}\n"
            insights += f"• Total Users: {analytics.get('total_users', 0)}\n"
            insights += f"• Verified Users: {analytics.get('verified_users', 0)}\n"
            
            user_roles = analytics.get("user_roles", {})
            insights += f"• User Distribution: {', '.join([f'{k}: {v}' for k, v in user_roles.items()])}\n"
        
        return insights
    
    def get_peak_times_analysis(self) -> str:
        """Analyze peak times for incidents"""
        analytics = self.get_system_analytics()
        
        if not analytics.get("hourly_distribution"):
            return "Insufficient data for peak times analysis."
        
        hourly = analytics["hourly_distribution"]
        peak_hour = max(hourly.items(), key=lambda x: x[1])
        
        analysis = "📈 **Peak Times Analysis**\n\n"
        analysis += f"• Peak Hour: {peak_hour[0]:02d}:00 ({peak_hour[1]} incidents)\n"
        analysis += f"• Average Hourly Reports: {sum(hourly.values()) / len(hourly):.1f}\n"
        analysis += f"• Hours with Reports: {len(hourly)}/24\n"
        
        # Categorize times
        morning = sum(v for k, v in hourly.items() if 6 <= k < 12)
        afternoon = sum(v for k, v in hourly.items() if 12 <= k < 18)
        evening = sum(v for k, v in hourly.items() if 18 <= k < 24)
        night = sum(v for k, v in hourly.items() if 0 <= k < 6)
        
        analysis += f"\nBy Period:\n"
        analysis += f"• Morning (6-12): {morning} reports\n"
        analysis += f"• Afternoon (12-18): {afternoon} reports\n"
        analysis += f"• Evening (18-24): {evening} reports\n"
        analysis += f"• Night (0-6): {night} reports\n"
        
        return analysis


def get_conversational_ai() -> ConversationalAICore:
    """Get singleton instance of ConversationalAICore"""
    if not hasattr(get_conversational_ai, 'instance'):
        get_conversational_ai.instance = ConversationalAICore()
    return get_conversational_ai.instance
