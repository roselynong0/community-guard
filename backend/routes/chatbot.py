"""
AI Chatbot Routes
Conversational AI endpoints for system information, Q&A, and report analytics
"""

from flask import Blueprint, request, jsonify
from middleware.auth import token_required
from utils import supabase
import logging
from datetime import datetime, timedelta
from collections import defaultdict, Counter

logger = logging.getLogger(__name__)

# Create blueprint
chatbot_bp = Blueprint('chatbot', __name__)


# System knowledge base
SYSTEM_KNOWLEDGE = {
    "name": "Community Guard",
    "purpose": "Community Guard is a comprehensive community safety and incident reporting platform designed to empower residents, barangay officials, and responders to collaborate in creating safer neighborhoods.",
    "goal": "Our goal is to provide a unified platform for reporting, tracking, and responding to community incidents in real-time, fostering transparency, accountability, and community engagement.",
    
    "features": {
        "incident_reporting": "Users can report various types of incidents including crime, hazards, accidents, harassment, vandalism, and lost & found items with detailed descriptions, images, and location data.",
        "ai_categorization": "AI-powered automatic categorization system that intelligently classifies incidents into appropriate categories (Crime, Hazard, Concern, Lost&Found, Others) to streamline reporting and response.",
        "real_time_mapping": "Interactive maps showing incident locations, allowing users to visualize safety trends and community hotspots across different barangays.",
        "notifications": "Real-time notifications for incident updates, official responses, and community alerts to keep users informed about incidents in their area.",
        "community_feed": "A social feed where community members can discuss, share updates, and provide mutual support regarding local incidents and safety.",
        "admin_dashboard": "Comprehensive analytics and reporting dashboard for admins to monitor community safety metrics, incident trends, and system performance.",
        "barangay_management": "Tools for barangay officials to manage incidents, respond to reports, and coordinate with responders in their jurisdiction.",
        "responder_coordination": "Specialized tools for emergency responders to access incident data, communicate with residents, and track response status.",
        "user_roles": "Multiple user roles including Residents, Barangay Officials, Responders, and Admins with role-specific features and permissions.",
        "safety_tips": "Educational content providing safety guidelines and best practices for community members.",
    },
    
    "incident_categories": {
        "Crime": "Includes theft, robbery, violence, assault, harassment, vandalism, and other criminal activities",
        "Hazard": "Infrastructure problems, fire, flooding, accidents, and environmental hazards",
        "Concern": "General concerns, suspicious activities, and unusual occurrences that need attention",
        "Lost&Found": "Reports for lost or found items including wallets, phones, bags, keys, and other personal belongings",
        "Others": "Any incident type that doesn't fit into the above categories",
    },
    
    "user_types": {
        "Resident": "Regular community members who can report incidents, view community feed, and receive safety alerts",
        "Barangay Official": "Barangay administrators with access to barangay-specific dashboards and incident management tools",
        "Responder": "Emergency responders who can view incident details, provide updates, and coordinate response efforts",
        "Admin": "System administrators with full access to all features, user management, and system analytics",
    },
    
    "capabilities": [
        "Report incidents with photos, GPS location, and detailed descriptions",
        "View incident history and trends on interactive maps",
        "Receive real-time notifications about incidents in your area",
        "AI-powered automatic incident categorization",
        "Participate in community discussions and safety forums",
        "Track incident resolution status and official responses",
        "Access safety tips and emergency guidelines",
        "Generate comprehensive analytics and safety reports",
        "Coordinate emergency response with multiple teams",
    ],
    
    "ai_features": {
        "automatic_categorization": "AI system automatically analyzes incident descriptions and assigns appropriate categories with confidence scores",
        "real_time_suggestions": "As you type your incident report, the AI provides category suggestions to help you classify correctly",
        "confidence_scoring": "Each AI classification includes a confidence score indicating how certain the AI is about the categorization",
        "alternative_suggestions": "The AI provides alternative category suggestions in case the primary suggestion isn't accurate",
        "smart_detection": "Special detection for Lost & Found items, hazard types, and crime patterns",
    },
    
    "system_benefits": [
        "Faster incident reporting and response",
        "Better incident organization and categorization",
        "Improved community awareness and engagement",
        "Data-driven safety insights for barangay officials",
        "Enhanced emergency response coordination",
        "Transparent communication between residents and authorities",
        "Community empowerment through information sharing",
        "AI-assisted incident classification for accuracy",
    ],
    
    "emergency_guidance": {
        "emergency_contacts": "🚨 EMERGENCY CONTACTS\n\n📍 NATIONAL\n🚨 National Emergency Hotline: 911\n👮 Police: 117\n🚑 Medical Assistance: 8888\n\n📍 OLONGAPO CITY\n🏛️ City Hall / General City Offices: (047) 222-2565 | 611-4800\n🚨 DRRMO / Olongapo Rescue: 0998-593-7446\n🚒 Fire & Rescue – Central: 223-1415\n🚒 Fire & Rescue – New Cabalan: 224-5414\n🚒 Fire & Rescue – Gordon Heights: 223-5497\n🩸 Philippine Red Cross (Olongapo): 0917-889-2783 | 222-2181",
        
        "quick_report": "📋 QUICK REPORT SUBMISSION\n\nYou can quickly report an incident:\n\n1. Go to 'Reports' section\n2. Click 'Create New Report'\n3. Select incident category (Crime, Hazard, Concern, Lost&Found)\n4. Add description and location\n5. Upload photos/evidence\n6. Submit - Instant notification to authorities\n\nEmergency reports are prioritized and reach responders immediately!",
        
        "safety_tips_fire": "🔥 FIRE SAFETY TIPS\n\n• Keep fire extinguishers accessible and know how to use them\n• Never leave cooking unattended\n• Install smoke detectors on every level\n• Create and practice evacuation plans\n• Keep exits clear and unlocked\n• Don't overload electrical outlets\n• Store flammable materials safely\n• Know your nearest emergency exit\n• In case of fire: EVACUATE FIRST, call 911 from a safe location",
        
        "safety_tips_crime": "🚨 CRIME SAFETY TIPS\n\n✅ HOME SAFETY\n• Lock all doors and windows\n• Do not share travel plans on social media\n• Know your neighbors; build awareness\n• Install CCTV or smart doorbells if possible\n• Keep valuables out of sight from windows\n• Ensure gates, fences, and garages are secured\n• Report unfamiliar or suspicious visitors\n\n✅ PERSONAL SAFETY OUTSIDE\n• Stay in well-lit areas\n• Avoid using phones while walking\n• Report suspicious behavior immediately\n• Walk confidently and stay aware of surroundings\n• Use trusted transportation services only\n• Carry a whistle or small alarm\n• Avoid traveling alone late at night",
        
        "safety_tips_health": "⚕️ HEALTH EMERGENCY TIPS\n\n• Know CPR basics - can save a life\n• Keep a first aid kit at home and work\n• Learn recovery position for unconscious patients\n• Call emergency services if someone is unresponsive\n• Stay calm and follow dispatcher instructions\n• Keep emergency contact numbers accessible\n• Don't move patients with suspected spinal injuries\n• Apply pressure to stop bleeding\n• Never give food/water to unconscious people\n• Note time of incident for medical professionals",
        
        "safety_tips_earthquake": "🏚️ EARTHQUAKE SAFETY TIPS\n\n✅ BEFORE AN EARTHQUAKE\n• Know safe spots in each room (under tables, against interior walls)\n• Practice \"Drop, Cover, Hold On\" drills regularly\n• Secure heavy furniture and appliances to walls\n• Store breakable items on lower shelves\n• Keep emergency kit easily accessible\n• Know how to turn off gas, water, and electricity\n• Create a family communication plan\n\n✅ DURING AN EARTHQUAKE\n• DROP to hands and knees immediately\n• COVER your head and neck under sturdy desk/table\n• HOLD ON until shaking stops (usually 30-60 seconds)\n• If outdoors: Move away from buildings and power lines\n• If in a vehicle: Pull over safely, stay inside with seatbelt on\n• If in an elevator: Press all floor buttons and exit when possible\n\n✅ AFTER AN EARTHQUAKE\n• Check yourself and others for injuries\n• Exit building only if it's safe (watch for falling debris)\n• Listen to official emergency broadcasts\n• Use phone only for emergencies\n• Expect aftershocks and remain alert\n• Stay out of damaged buildings\n• Report hazards to authorities",
        
        "safety_tips_flood": "🌊 FLOOD SAFETY TIPS\n\n✅ BEFORE A FLOOD\n• Know your area's flood risk and evacuation routes\n• Prepare emergency kit: water, food, medications, documents\n• Move valuable items to higher floors\n• Have insurance documents ready\n• Know how to turn off utilities if needed\n• Keep vehicle fueled (at least half tank)\n• Sign up for flood alerts and warnings\n\n✅ DURING A FLOOD\n• Move to higher ground immediately\n• Never drive through flooded roads (6 inches can sweep away cars)\n• Don't touch electrical equipment if wet\n• Avoid floodwaters (may contain contaminants)\n• Listen to official evacuation orders\n• Help others evacuate if safe to do so\n• Call 911 if trapped\n\n✅ AFTER A FLOOD\n• Return home only when authorities say it's safe\n• Document damage with photos for insurance\n• Dispose of contaminated food and water\n• Boil water before drinking until cleared\n• Wear protective gear when cleaning\n• Watch for weakened structures and debris\n• Report utilities damage to appropriate agencies\n• Apply for disaster assistance if eligible",
    },
}


def build_response_text(answer):
    """Build a friendly response text"""
    return {
        "status": "success",
        "response": answer,
        "type": "information"
    }


def search_knowledge_base(query):
    """Search the knowledge base for relevant information with specific keyword matching"""
    query_lower = query.lower()
    
    # ============ SYSTEM NAME QUERY - "name" + "system" ============
    if "name" in query_lower and "system" in query_lower:
        return [f"The system is called: {SYSTEM_KNOWLEDGE['name']}"]
    
    # ============ SYSTEM PURPOSE QUERY - Only "purpose" ============
    purpose_keywords = ["what is the purpose", "purpose", "what's the purpose"]
    if any(phrase in query_lower for phrase in purpose_keywords):
        # But exclude incident-specific purpose queries
        if "incident" not in query_lower and "reporting" not in query_lower:
            return [f"🎯 {SYSTEM_KNOWLEDGE['purpose']}"]
    
    # ============ SYSTEM GOAL QUERY - Only "goal" ============
    if "goal" in query_lower:
        return [f"🎯 {SYSTEM_KNOWLEDGE['goal']}"]
    
    # ============ GENERAL "WHAT IS COMMUNITY GUARD" - Name + purpose + goal ============
    what_is_keywords = ["what is community guard", "tell me about community guard", "community guard"]
    if any(phrase in query_lower for phrase in what_is_keywords):
        return [f"{SYSTEM_KNOWLEDGE['name']}\n\n🎯 {SYSTEM_KNOWLEDGE['purpose']}\n\n🎯 {SYSTEM_KNOWLEDGE['goal']}"]
    
    # ============ SPECIFIC FEATURE QUERY - "incident" + feature name ============
    # e.g., "What is incident reporting?" → return ONLY incident_reporting description
    if "incident" in query_lower:
        feature_map = {
            "reporting": "incident_reporting",
            "ai_categorization": "ai_categorization",
            "categorization": "ai_categorization",
            "categoriz": "ai_categorization",
            "mapping": "real_time_mapping",
            "map": "real_time_mapping",
        }
        for keyword, feature_key in feature_map.items():
            if keyword in query_lower:
                feature_value = SYSTEM_KNOWLEDGE["features"].get(feature_key, "")
                if feature_value:
                    feature_name = feature_key.replace('_', ' ').title()
                    return [f"{feature_name}\n\n{feature_value}"]
    
    # ============ SPECIFIC CATEGORY QUERY - e.g., "What is crime?" or just "crime" ============
    # Check if asking for a specific category
    category_map = {"crime": "Crime", "hazard": "Hazard", "concern": "Concern", "lost": "Lost&Found", "found": "Lost&Found"}
    for keyword, category_name in category_map.items():
        if keyword in query_lower and query_lower.count(keyword) == 1:  # Exact match, not part of broader query
            # Exclude if asking for all categories
            if "categories" not in query_lower and "all" not in query_lower:
                category_desc = SYSTEM_KNOWLEDGE["incident_categories"].get(category_name, "")
                if category_desc:
                    emojis = {"Crime": "🚨", "Hazard": "⚠️", "Concern": "❓", "Lost&Found": "🔍"}
                    emoji = emojis.get(category_name, "•")
                    return [f"{emoji} {category_name}\n{category_desc}"]
    
    # ============ SPECIFIC USER ROLE QUERY - e.g., "What is a resident?" or just "resident" ============
    # Check if asking for a specific role
    role_map = {
        "resident": "Resident",
        "admin": "Admin",
        "responder": "Responder",
        "barangay official": "Barangay Official",
        "barangay": "Barangay Official"
    }
    for keyword, role_name in role_map.items():
        if keyword in query_lower and query_lower.count(keyword) == 1:  # Exact match
            # Exclude if asking for all roles
            if "role" not in query_lower or ("user role" in query_lower and keyword not in query_lower):
                if "role" not in query_lower or "all" not in query_lower:
                    role_desc = SYSTEM_KNOWLEDGE["user_types"].get(role_name, "")
                    if role_desc:
                        role_emojis = {"Resident": "👤", "Barangay Official": "🏛️", "Responder": "🚑", "Admin": "⚙️"}
                        emoji = role_emojis.get(role_name, "•")
                        return [f"{emoji} {role_name}\n{role_desc}"]
    
    # ============ ALL FEATURES QUERY ============
    if any(word in query_lower for word in ["features", "feature"]):
        features_text = "SYSTEM FEATURES\n\n"
        for i, (k, v) in enumerate(SYSTEM_KNOWLEDGE["features"].items(), 1):
            feature_name = k.replace('_', ' ').title()
            features_text += f"{i}. {feature_name}\n{v}\n\n"
        return [features_text]
    
    # ============ CAPABILITIES QUERY ============
    capability_keywords = ["capability", "capabilit", "able to", "can do", "can i", "can you"]
    if any(word in query_lower for word in capability_keywords):
        capabilities_text = "SYSTEM CAPABILITIES\n\n"
        for i, cap in enumerate(SYSTEM_KNOWLEDGE["capabilities"], 1):
            capabilities_text += f"{i}. {cap}\n"
        return [capabilities_text]
    
    # ============ BENEFITS QUERY ============
    benefit_keywords = ["benefit", "advantage", "advantag", "why", "good for"]
    if any(word in query_lower for word in benefit_keywords):
        benefits_text = "SYSTEM BENEFITS\n\n"
        for i, benefit in enumerate(SYSTEM_KNOWLEDGE["system_benefits"], 1):
            benefits_text += f"{i}. {benefit}\n"
        return [benefits_text]
    
    # ============ AI FEATURES QUERY ============
    ai_keywords = ["ai feature", "ai", "artificial intellig", "categoriz", "classification", "automat", "confidence", "suggestion", "detection", "smart"]
    if any(word in query_lower for word in ai_keywords):
        ai_text = "AI FEATURES\n\n"
        for i, (k, v) in enumerate(SYSTEM_KNOWLEDGE["ai_features"].items(), 1):
            ai_name = k.replace('_', ' ').title()
            ai_text += f"{i}. {ai_name}\n{v}\n\n"
        return [ai_text]
    
    # ============ EMERGENCY GUIDANCE QUERY ============
    emergency_keywords = ["emergency", "urgent", "help", "sos", "emergency contact", "emergency number", "quick report", "safety tip", "fire", "crime", "health emergency", "earthquake", "flood"]
    if any(word in query_lower for word in emergency_keywords):
        # Specific emergency type queries
        if "contact" in query_lower or "number" in query_lower or "phone" in query_lower:
            return [SYSTEM_KNOWLEDGE["emergency_guidance"]["emergency_contacts"]]
        elif "quick report" in query_lower or "submit report" in query_lower or "report quick" in query_lower:
            return [SYSTEM_KNOWLEDGE["emergency_guidance"]["quick_report"]]
        elif "fire" in query_lower or "flames" in query_lower or "burning" in query_lower:
            return [SYSTEM_KNOWLEDGE["emergency_guidance"]["safety_tips_fire"]]
        elif "crime" in query_lower or "robbery" in query_lower or "theft" in query_lower or "assault" in query_lower or "violence" in query_lower:
            return [SYSTEM_KNOWLEDGE["emergency_guidance"]["safety_tips_crime"]]
        elif "health" in query_lower or "medical" in query_lower or "injury" in query_lower or "sick" in query_lower:
            return [SYSTEM_KNOWLEDGE["emergency_guidance"]["safety_tips_health"]]
        elif "earthquake" in query_lower or "quake" in query_lower or "tremor" in query_lower:
            return [SYSTEM_KNOWLEDGE["emergency_guidance"]["safety_tips_earthquake"]]
        elif "flood" in query_lower or "flooding" in query_lower or "water" in query_lower or "storm" in query_lower:
            return [SYSTEM_KNOWLEDGE["emergency_guidance"]["safety_tips_flood"]]
        else:
            # General emergency guidance
            emergency_text = "🆘 EMERGENCY GUIDANCE\n\n"
            emergency_text += "I can help you with:\n\n"
            emergency_text += "📞 Emergency Contacts - Police, Fire, Ambulance, Hotlines\n"
            emergency_text += "📋 Quick Report Submission - How to report incidents\n"
            emergency_text += "🔥 Fire Safety Tips - Prevention and response\n"
            emergency_text += "🚨 Crime Safety Tips - Prevention and personal safety\n"
            emergency_text += "⚕️ Health Emergency Tips - First aid and CPR basics\n"
            emergency_text += "🏚️ Earthquake Safety Tips - Before, during, and after\n"
            emergency_text += "🌊 Flood Safety Tips - Preparation and response\n\n"
            emergency_text += "Ask me: 'emergency contacts', 'quick report', 'fire safety', 'crime safety', 'health emergency', 'earthquake safety', or 'flood safety'"
            return [emergency_text]
    
    # ============ COMMUNITY FEED QUERY ============
    feed_keywords = ["community feed", "feed", "discuss", "social"]
    if any(phrase in query_lower for phrase in feed_keywords):
        feed_text = SYSTEM_KNOWLEDGE["features"]["community_feed"]
        return [f"COMMUNITY FEED\n\n{feed_text}"]
    
    # ============ ALL INCIDENT CATEGORIES QUERY ============
    category_keywords = ["incident categor", "report categor", "all categories", "all category"]
    if any(word in query_lower for word in category_keywords):
        categories_text = "INCIDENT CATEGORIES\n\n"
        emojis = {"Crime": "🚨", "Hazard": "⚠️", "Concern": "❓", "Lost&Found": "🔍", "Others": "📌"}
        for k, v in SYSTEM_KNOWLEDGE["incident_categories"].items():
            emoji = emojis.get(k, "•")
            categories_text += f"{emoji} {k}\n{v}\n\n"
        return [categories_text]
    
    # ============ ALL USER ROLES QUERY ============
    if "user role" in query_lower or ("role" in query_lower and "all" in query_lower):
        roles_text = "USER ROLES\n\n"
        role_emojis = {"Resident": "👤", "Barangay Official": "🏛️", "Responder": "🚑", "Admin": "⚙️"}
        for k, v in SYSTEM_KNOWLEDGE["user_types"].items():
            emoji = role_emojis.get(k, "•")
            roles_text += f"{emoji} {k}\n{v}\n\n"
        return [roles_text]
    
    return []


# ============ REPORT ANALYTICS FUNCTIONS ============

def get_all_reports():
    """Fetch all reports from database"""
    try:
        response = supabase.table("reports").select("*").is_("deleted_at", "null").execute()
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"Error fetching reports: {e}")
        return []


def analyze_reports_comprehensive():
    """Generate comprehensive report analysis"""
    try:
        reports = get_all_reports()
        
        if not reports:
            return {
                "total_reports": 0,
                "message": "No reports found in the system yet."
            }
        
        # Basic stats
        total_reports = len(reports)
        
        # Category breakdown
        categories = Counter()
        barangay_stats = defaultdict(lambda: {"total": 0, "categories": Counter()})
        status_counts = Counter()
        
        for report in reports:
            category = report.get("category", "Others")
            barangay = report.get("address_barangay", "Unknown")
            status = report.get("status", "pending")
            
            categories[category] += 1
            barangay_stats[barangay]["total"] += 1
            barangay_stats[barangay]["categories"][category] += 1
            status_counts[status] += 1
        
        # Find highest report barangay
        highest_barangay = max(barangay_stats.items(), key=lambda x: x[1]["total"])
        
        # Build response
        analysis = {
            "total_reports": total_reports,
            "overall_stats": {
                "by_category": dict(categories),
                "by_status": dict(status_counts),
            },
            "highest_report_barangay": {
                "name": highest_barangay[0],
                "total_reports": highest_barangay[1]["total"],
                "categories": dict(highest_barangay[1]["categories"])
            },
            "barangay_breakdown": {}
        }
        
        # Add all barangay stats
        for barangay, stats in sorted(barangay_stats.items(), key=lambda x: x[1]["total"], reverse=True):
            analysis["barangay_breakdown"][barangay] = {
                "total": stats["total"],
                "categories": dict(stats["categories"]),
                "percentage": round((stats["total"] / total_reports) * 100, 1)
            }
        
        return analysis
    
    except Exception as e:
        logger.error(f"Error analyzing reports: {e}")
        return {"error": str(e)}


def format_analysis_report(analysis):
    """Format analysis data into readable text"""
    if "error" in analysis:
        return f"Error analyzing reports: {analysis['error']}"
    
    if analysis.get("total_reports") == 0:
        return analysis["message"]
    
    report_text = f"COMPREHENSIVE REPORT ANALYSIS\n\n"
    report_text += f"📊 Overall Statistics:\n"
    report_text += f"  Total Reports: {analysis['total_reports']}\n"
    report_text += f"  Categories: {', '.join([f'{k}: {v}' for k, v in analysis['overall_stats']['by_category'].items()])}\n"
    report_text += f"  Status: {', '.join([f'{k}: {v}' for k, v in analysis['overall_stats']['by_status'].items()])}\n\n"
    
    report_text += f"🏆 Highest Report Barangay:\n"
    report_text += f"  {analysis['highest_report_barangay']['name']}: {analysis['highest_report_barangay']['total_reports']} reports\n"
    report_text += f"  Categories: {', '.join([f'{k}: {v}' for k, v in analysis['highest_report_barangay']['categories'].items()])}\n\n"
    
    report_text += f"📍 Barangay Breakdown:\n\n"
    
    for barangay, stats in analysis['barangay_breakdown'].items():
        report_text += f"  {barangay}: {stats['total']} reports ({stats['percentage']}%)\n"
        report_text += f"    Categories: {', '.join([f'{k}: {v}' for k, v in stats['categories'].items()])}\n"
    
    return report_text


def get_trend_analysis():
    """Analyze trends in reports"""
    try:
        reports = get_all_reports()
        
        if not reports:
            return "No reports available for trend analysis."
        
        # Group by date
        daily_reports = defaultdict(int)
        
        for report in reports:
            created_at = report.get("created_at")
            if created_at:
                # Parse date
                date_str = created_at.split("T")[0] if "T" in created_at else created_at
                daily_reports[date_str] += 1
        
        # Find peak days
        if daily_reports:
            peak_day = max(daily_reports.items(), key=lambda x: x[1])
            avg_daily = len(reports) / len(daily_reports)
            
            trend_text = f"TREND ANALYSIS\n\n"
            trend_text += f"📈 Peak Report Day: {peak_day[0]} with {peak_day[1]} reports\n"
            trend_text += f"📊 Average Reports Per Day: {avg_daily:.1f}\n"
            trend_text += f"📅 Total Unique Days with Reports: {len(daily_reports)}\n"
            trend_text += f"📋 Total Reports: {len(reports)}\n\n"
            trend_text += f"Trend: {'📈 Increasing' if peak_day[1] > avg_daily else '📉 Stable or Decreasing'} incident reports"
            return trend_text
        
        return "Insufficient data for trend analysis."
    
    except Exception as e:
        logger.error(f"Error analyzing trends: {e}")
        return f"Error analyzing trends: {str(e)}"


def get_report_summary_stats():
    """Get report statistics like Home page dashboard (total, ongoing, resolved, pending)"""
    try:
        reports = get_all_reports()
        
        if not reports:
            return {
                "total_reports": 0,
                "ongoing": 0,
                "resolved": 0,
                "pending": 0,
                "categories": {}
            }
        
        # Count by status
        status_counts = Counter()
        category_counts = Counter()
        barangay_counts = Counter()
        
        for report in reports:
            status = report.get("status", "pending").lower()
            category = report.get("category", "Others")
            barangay = report.get("address_barangay", "Unknown")
            
            status_counts[status] += 1
            category_counts[category] += 1
            barangay_counts[barangay] += 1
        
        return {
            "total_reports": len(reports),
            "ongoing": status_counts.get("ongoing", 0),
            "resolved": status_counts.get("resolved", 0),
            "pending": status_counts.get("pending", 0),
            "categories": dict(category_counts),
            "barangays": dict(barangay_counts)
        }
    
    except Exception as e:
        logger.error(f"Error getting report summary stats: {e}")
        return {}


def format_report_summary_response(stats):
    """Format report statistics into readable response (like Home dashboard)"""
    if not stats or stats.get("total_reports", 0) == 0:
        return "📊 REPORT STATISTICS\n\nNo reports yet"
    
    response_text = "📊 REPORT STATISTICS\n\n"
    response_text += f"Community Reports: {stats['total_reports']}\n"
    response_text += f"Ongoing Cases: {stats['ongoing']}\n"
    response_text += f"Resolved Cases: {stats['resolved']}\n"
    response_text += f"Pending Reports: {stats['pending']}\n\n"
    
    # Category breakdown
    response_text += "REPORTS BY CATEGORY\n\n"
    if stats.get("categories"):
        for category, count in sorted(stats["categories"].items(), key=lambda x: x[1], reverse=True):
            response_text += f"  {category}: {count}\n"
    else:
        response_text += "  No categories yet\n"
    
    # Barangay breakdown - only show barangays with 1 or more reports
    response_text += "\nREPORTS BY BARANGAY\n\n"
    if stats.get("barangays"):
        for barangay, count in sorted(stats["barangays"].items(), key=lambda x: x[1], reverse=True):
            if count >= 1:  # Only show barangays with at least 1 report
                response_text += f"  {barangay}: {count}\n"
    else:
        response_text += "  No barangay data yet\n"
    
    return response_text


def get_user_summary_stats():
    """Get user statistics (total users, breakdown by role)"""
    try:
        users_response = supabase.table("users").select("*").execute()
        users = getattr(users_response, "data", []) or []
        
        if not users:
            return {
                "total_users": 0,
                "roles": {}
            }
        
        role_counts = Counter()
        for user in users:
            role = user.get("role", "Resident")
            role_counts[role] += 1
        
        return {
            "total_users": len(users),
            "roles": dict(role_counts)
        }
    
    except Exception as e:
        logger.error(f"Error getting user summary stats: {e}")
        return {}


def format_user_summary_response(stats):
    """Format user statistics into readable response"""
    if not stats or stats.get("total_users", 0) == 0:
        return "👥 USER STATISTICS\n\nNo users yet"
    
    response_text = f"👥 USER STATISTICS\n\n"
    response_text += f"Total Users: {stats['total_users']}\n\n"
    
    response_text += "USER ROLES BREAKDOWN\n\n"
    if stats.get("roles"):
        for role, count in sorted(stats["roles"].items(), key=lambda x: x[1], reverse=True):
            response_text += f"  {role}: {count}\n"
    else:
        response_text += "  No role data yet\n"
    
    return response_text


def get_report_summary_stats():
    """Get report statistics like Home page dashboard (total, ongoing, resolved, pending)"""
    try:
        reports = get_all_reports()
        
        if not reports:
            return {
                "total_reports": 0,
                "ongoing": 0,
                "resolved": 0,
                "pending": 0,
                "categories": {}
            }
        
        # Count by status
        status_counts = Counter()
        category_counts = Counter()
        barangay_counts = Counter()
        
        for report in reports:
            status = report.get("status", "pending").lower()
            category = report.get("category", "Others")
            barangay = report.get("address_barangay", "Unknown")
            
            status_counts[status] += 1
            category_counts[category] += 1
            barangay_counts[barangay] += 1
        
        return {
            "total_reports": len(reports),
            "ongoing": status_counts.get("ongoing", 0),
            "resolved": status_counts.get("resolved", 0),
            "pending": status_counts.get("pending", 0),
            "categories": dict(category_counts),
            "barangays": dict(barangay_counts)
        }
    
    except Exception as e:
        logger.error(f"Error getting report summary stats: {e}")
        return {}


def format_report_summary_response(stats):
    """Format report statistics into readable response (like Home dashboard)"""
    if not stats or stats.get("total_reports", 0) == 0:
        return "📊 REPORT STATISTICS\n\nNo reports yet"
    
    response_text = "📊 REPORT STATISTICS\n\n"
    response_text += f"Community Reports: {stats['total_reports']}\n"
    response_text += f"Ongoing Cases: {stats['ongoing']}\n"
    response_text += f"Resolved Cases: {stats['resolved']}\n"
    response_text += f"Pending Reports: {stats['pending']}\n\n"
    
    # Category breakdown
    response_text += "REPORTS BY CATEGORY\n\n"
    if stats.get("categories"):
        for category, count in sorted(stats["categories"].items(), key=lambda x: x[1], reverse=True):
            response_text += f"  {category}: {count}\n"
    else:
        response_text += "  No categories yet\n"
    
    # Barangay breakdown - only show barangays with 1 or more reports
    response_text += "\nREPORTS BY BARANGAY\n\n"
    if stats.get("barangays"):
        for barangay, count in sorted(stats["barangays"].items(), key=lambda x: x[1], reverse=True):
            if count >= 1:  # Only show barangays with at least 1 report
                response_text += f"  {barangay}: {count}\n"
    else:
        response_text += "  No barangay data yet\n"
    
    return response_text


def get_user_summary_stats():
    """Get user statistics (total users, breakdown by role)"""
    try:
        users_response = supabase.table("users").select("*").execute()
        users = getattr(users_response, "data", []) or []
        
        if not users:
            return {
                "total_users": 0,
                "roles": {}
            }
        
        role_counts = Counter()
        for user in users:
            role = user.get("role", "Resident")
            role_counts[role] += 1
        
        return {
            "total_users": len(users),
            "roles": dict(role_counts)
        }
    
    except Exception as e:
        logger.error(f"Error getting user summary stats: {e}")
        return {}


def format_user_summary_response(stats):
    """Format user statistics into readable response"""
    if not stats or stats.get("total_users", 0) == 0:
        return "👥 USER STATISTICS\n\nNo users yet"
    
    response_text = f"👥 USER STATISTICS\n\n"
    response_text += f"Total Users: {stats['total_users']}\n\n"
    
    response_text += "USER ROLES BREAKDOWN\n\n"
    if stats.get("roles"):
        for role, count in sorted(stats["roles"].items(), key=lambda x: x[1], reverse=True):
            response_text += f"  {role}: {count}\n"
    else:
        response_text += "  No role data yet\n"
    
    return response_text


def get_system_summary():
    """Get comprehensive system summary with all key metrics"""
    try:
        # Get reports
        reports = get_all_reports()
        total_reports = len(reports)
        
        # Get users
        users_response = supabase.table("users").select("*").execute()
        users = getattr(users_response, "data", []) or []
        total_users = len(users)
        
        # Count by user role
        role_counts = Counter()
        for user in users:
            role = user.get("role", "Resident")
            role_counts[role] += 1
        
        # Reports by barangay
        reports_by_barangay = Counter()
        for report in reports:
            barangay = report.get("address_barangay", "Unknown")
            reports_by_barangay[barangay] += 1
        
        # Users by barangay
        users_by_barangay = Counter()
        for user in users:
            barangay = user.get("barangay", "Unknown")
            if barangay:
                users_by_barangay[barangay] += 1
        
        # Categories breakdown
        category_counts = Counter()
        for report in reports:
            category = report.get("category", "Others")
            category_counts[category] += 1
        
        # Build summary with clean formatting
        summary_text = f"SYSTEM SUMMARY REPORT\n\n"
        summary_text += f"👥 Total Users: {total_users}\n"
        summary_text += f"📋 Total Reports: {total_reports}\n\n"
        
        summary_text += "USER ROLES BREAKDOWN\n\n"
        for role, count in role_counts.most_common():
            summary_text += f"  {role}: {count}\n"
        
        summary_text += "\nREPORTS BY CATEGORY\n\n"
        if category_counts:
            for category, count in category_counts.most_common():
                summary_text += f"  {category}: {count}\n"
        else:
            summary_text += "  No reports yet\n"
        
        summary_text += "\nREPORTS BY BARANGAY\n\n"
        if reports_by_barangay:
            for barangay, count in reports_by_barangay.most_common():
                users_in_barangay = users_by_barangay.get(barangay, 0)
                summary_text += f"  {barangay}\n"
                summary_text += f"    Reports: {count}\n"
                summary_text += f"    Users: {users_in_barangay}\n\n"
        else:
            summary_text += "  No reports yet\n"
        
        return summary_text
    
    except Exception as e:
        logger.error(f"Error generating system summary: {e}")
        return f"Error generating summary: {str(e)}"


@chatbot_bp.route('/chat', methods=['POST'])
@token_required
def chat():
    """
    AI chatbot endpoint for system information Q&A
    
    Request JSON:
    {
        "message": "string - user question or message"
    }
    
    Response:
    {
        "status": "success",
        "response": "string - chatbot response",
        "type": "information|greeting|help|analytics|unknown"
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({
                "status": "error",
                "message": "Missing required field: message"
            }), 400
        
        user_message = data.get('message', '').strip()
        
        if not user_message:
            return jsonify({
                "status": "error",
                "message": "Message cannot be empty"
            }), 400
        
        user_message_lower = user_message.lower()
        
        # ============ COMPREHENSIVE SYSTEM SUMMARY ============
        comprehensive_keywords = ["comprehensive summary", "full summary", "complete summary", "give me everything", "system overview", "all data", "full report", "complete report", "everything"]
        if any(keyword in user_message_lower for keyword in comprehensive_keywords):
            summary_text = get_system_summary()
            response = {
                "status": "success",
                "response": summary_text,
                "type": "analytics"
            }
            logger.info(f"Chatbot comprehensive summary: {user_message}")
            return jsonify(response), 200
        
        # ============ REPORT SUMMARY - statistics dashboard style ============
        report_summary_keywords = ["report summary", "report stats", "report statistics", "report dashboard", "how many reports", "community reports", "reports summary", "summary report", "report summari"]
        if any(keyword in user_message_lower for keyword in report_summary_keywords):
            stats = get_report_summary_stats()
            response_text = format_report_summary_response(stats)
            response = {
                "status": "success",
                "response": response_text,
                "type": "analytics"
            }
            logger.info(f"Chatbot report summary: {user_message}")
            return jsonify(response), 200
        
        # ============ USER SUMMARY - user statistics ============
        user_summary_keywords = ["user summary", "user stats", "user statistics", "how many users", "user breakdown", "total users", "users summary"]
        if any(keyword in user_message_lower for keyword in user_summary_keywords):
            stats = get_user_summary_stats()
            response_text = format_user_summary_response(stats)
            response = {
                "status": "success",
                "response": response_text,
                "type": "analytics"
            }
            logger.info(f"Chatbot user summary: {user_message}")
            return jsonify(response), 200
        
        # ============ TREND ANALYSIS ============
        trend_keywords = ["trend", "trending", "trends analysis"]
        if any(keyword in user_message_lower for keyword in trend_keywords):
            response_text = get_trend_analysis()
            response = {
                "status": "success",
                "response": response_text,
                "type": "analytics"
            }
            logger.info(f"Chatbot trend analysis: {user_message}")
            return jsonify(response), 200
        
        # ============ GREETING RESPONSES - Check early for better UX ============
        greeting_keywords = ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening']
        if any(greeting in user_message_lower for greeting in greeting_keywords):
            response = {
                "status": "success",
                "response": "👋 Hello! I'm the Community Helper. I can help you learn about our incident reporting system, AI features, user roles, and more. What would you like to know?",
                "type": "greeting"
            }
            logger.info(f"Chatbot greeting: {user_message}")
            return jsonify(response), 200
        
        # ============ HELP REQUEST - when no knowledge base match ============
        help_keywords = ['help', 'what can you', 'what do you', 'tell me', 'how can i', 'guide', 'assist']
        if any(word in user_message_lower for word in help_keywords):
            response = {
                "status": "success",
                "response": "📚 I can help you with:\n\n"
                           "🎯 SYSTEM INFO:\n"
                           "  • What is Community Guard?\n"
                           "  • System purpose\n"
                           "  • System goal\n"
                           "  • System name\n"
                           "  • Features / Capabilities / Benefits\n\n"
                           "🤖 AI FEATURES:\n"
                           "  • AI features\n"
                           "  • Automatic categorization\n"
                           "  • Real-time suggestions\n"
                           "  • Confidence scoring\n"
                           "  • Smart detection\n\n"
                           "🆘 EMERGENCY GUIDANCE:\n"
                           "  • Emergency contacts\n"
                           "  • Quick report submission\n"
                           "  • Fire safety tips\n"
                           "  • Crime safety tips\n"
                           "  • Health emergency tips\n"
                           "  • Earthquake safety tips\n"
                           "  • Flood safety tips\n\n"
                           "📑 CATEGORIES & ROLES:\n"
                           "  • Incident categories (Crime, Hazard, Concern, Lost&Found)\n"
                           "  • User roles (Resident, Admin, Responder, Barangay Official)\n"
                           "  • What is [category/role]? for specific details\n\n"
                           "📊 ANALYTICS:\n"
                           "  • Report summary\n"
                           "  • User summary\n"
                           "  • Trend analysis\n"
                           "  • Comprehensive summary\n\n"
                           "What would you like to know?",
                "type": "help"
            }
            logger.info(f"Chatbot help request: {user_message}")
            return jsonify(response), 200
        
        # ============ KNOWLEDGE BASE SEARCH - Specific queries ============
        answers = search_knowledge_base(user_message)
        
        if answers:
            response = {
                "status": "success",
                "response": "\n\n".join(answers),
                "type": "information"
            }
            logger.info(f"Chatbot answered: {user_message}")
            return jsonify(response), 200
        
        # ============ UNKNOWN QUERY ============
        response = {
            "status": "success",
            "response": "I'm not sure about that. Here are things I can help with:\n\n"
                       "🎯 System Info\n"
                       "  • What is Community Guard?\n"
                       "  • Purpose / Goal / Features\n"
                       "  • Capabilities / Benefits\n\n"
                       "🤖 AI Features\n"
                       "  • AI features\n"
                       "  • Categorization\n"
                       "  • Smart detection\n\n"
                       "🆘 Emergency Guidance\n"
                       "  • Emergency contacts\n"
                       "  • Quick report\n"
                       "  • Fire / Crime / Health safety\n"
                       "  • Earthquake / Flood safety\n\n"
                       "📑 Categories & Roles\n"
                       "  • What is crime/hazard/etc?\n"
                       "  • What is a resident/admin/etc?\n\n"
                       "📊 Analytics\n"
                       "  • Report summary\n"
                       "  • User summary\n"
                       "  • Trend analysis\n\n"
                       "Type 'help' for more!",
            "type": "unknown"
        }
        logger.info(f"Chatbot could not answer: {user_message}")
        return jsonify(response), 200
    
    except Exception as e:
        logger.error(f"Chatbot error: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Error processing your message",
            "error": str(e)
        }), 500


@chatbot_bp.route('/chat/suggestions', methods=['GET'])
def get_chat_suggestions():
    """
    Get suggested questions for the chatbot (No auth required for better UX)
    
    Response:
    {
        "suggestions": [
            "What is Community Guard?",
            "Tell me about incident categories",
            ...
        ]
    }
    """
    try:
        suggestions = [
            "What is Community Guard?",
            "What are the main features?",
            "Tell me about the AI categorization system",
            "What user roles are available?",
            "What incident categories can I report?",
            "What are the system capabilities?",
            "Emergency contacts",
            "Quick report submission",
            "Fire safety tips",
            "Crime safety tips",
            "Health emergency tips",
            "Earthquake safety tips",
            "Flood safety tips",
            "What are the system benefits?",
            "How can I report an incident?",
        ]
        
        return jsonify({
            "status": "success",
            "suggestions": suggestions
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting chat suggestions: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Error retrieving suggestions"
        }), 500


@chatbot_bp.route('/system-info', methods=['GET'])
def get_system_info():
    """
    Get complete system information (No auth required)
    
    Response:
    {
        "name": "Community Guard",
        "purpose": "...",
        "features": {...},
        "incident_categories": {...},
        ...
    }
    """
    try:
        return jsonify({
            "status": "success",
            "system": SYSTEM_KNOWLEDGE
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting system info: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Error retrieving system information"
        }), 500