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
        "smart_categorization": "Smart automatic categorization system that intelligently classifies incidents into appropriate categories (Crime, Hazard, Concern, Lost&Found, Others) to streamline reporting and response.",
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
        "Smart automatic incident categorization",
        "Participate in community discussions and safety forums",
        "Track incident resolution status and official responses",
        "Access safety tips and emergency guidelines",
        "Generate comprehensive analytics and safety reports",
        "Coordinate emergency response with multiple teams",
    ],
    
    "smart_features": {
        "automatic_categorization": "Smart system automatically analyzes incident descriptions and assigns appropriate categories with confidence scores",
        "real_time_suggestions": "As you type your incident report, the system provides category suggestions to help you classify correctly",
        "confidence_scoring": "Each smart classification includes a confidence score indicating how certain the system is about the categorization",
        "alternative_suggestions": "The system provides alternative category suggestions in case the primary suggestion isn't accurate",
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
        "Smart-assisted incident classification for accuracy",
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
            "smart_categorization": "smart_categorization",
            "categorization": "smart_categorization",
            "categoriz": "smart_categorization",
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
    
    # ============ SMART FEATURES QUERY ============
    smart_keywords = ["smart feature", "ai", "artificial intellig", "categoriz", "classification", "automat", "confidence", "suggestion", "detection", "smart"]
    if any(word in query_lower for word in smart_keywords):
        smart_text = "SMART FEATURES\n\n"
        for i, (k, v) in enumerate(SYSTEM_KNOWLEDGE["smart_features"].items(), 1):
            smart_name = k.replace('_', ' ').title()
            smart_text += f"{i}. {smart_name}\n{v}\n\n"
        return [smart_text]
    
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


@chatbot_bp.route('/generate-report', methods=['POST'])
@token_required
def generate_analytical_report():
    """
    Generate an analytical report using AI based on reports data.
    Supports various report types: summary, barangay, category, trends.
    """
    try:
        user_id = request.user_id
        data = request.get_json() or {}
        
        report_type = data.get("report_type", "summary")  # summary, barangay, category, trends
        days = int(data.get("days", 30))  # Time range in days
        barangay_filter = data.get("barangay")  # Optional barangay filter
        format_type = data.get("format", "text")  # text, json
        
        # Verify user has permission (Admin or Barangay Official)
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_role = getattr(user_resp, "data", [{}])[0].get("role")
        
        if user_role not in ["Admin", "Barangay Official"]:
            return jsonify({"status": "error", "message": "Access denied. Only Admin and Barangay Officials can generate reports."}), 403
        
        # Get barangay for Barangay Officials
        if user_role == "Barangay Official":
            info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).execute()
            user_barangay = getattr(info_resp, "data", [{}])[0].get("address_barangay")
            barangay_filter = user_barangay  # Force barangay filter for officials
        
        # Fetch reports based on filters
        from datetime import timedelta
        cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        
        query = supabase.table("reports").select("*").is_("deleted_at", "null").gte("created_at", cutoff_date)
        
        if barangay_filter:
            query = query.eq("address_barangay", barangay_filter)
        
        reports_resp = query.execute()
        reports = getattr(reports_resp, "data", []) or []
        
        if not reports:
            return jsonify({
                "status": "success",
                "report": {
                    "title": f"No Reports Found",
                    "summary": f"No reports found in the last {days} days{' for ' + barangay_filter if barangay_filter else ''}.",
                    "data": {}
                }
            }), 200
        
        # Analyze reports
        total_reports = len(reports)
        categories = {}
        statuses = {}
        barangays = {}
        priority_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
        daily_counts = {}
        
        for r in reports:
            cat = r.get("category", "Others")
            status = r.get("status", "Pending")
            brgy = r.get("address_barangay", "Unknown")
            created = r.get("created_at", "")[:10]
            
            categories[cat] = categories.get(cat, 0) + 1
            statuses[status] = statuses.get(status, 0) + 1
            barangays[brgy] = barangays.get(brgy, 0) + 1
            daily_counts[created] = daily_counts.get(created, 0) + 1
            
            # Priority mapping
            if cat == "Crime":
                priority_counts["Critical"] += 1
            elif cat == "Hazard":
                priority_counts["High"] += 1
            elif cat == "Concern":
                priority_counts["Medium"] += 1
            else:
                priority_counts["Low"] += 1
        
        # Build report based on type
        if report_type == "summary":
            report_content = {
                "title": f"📊 Community Safety Report - Last {days} Days",
                "subtitle": f"Generated for: {barangay_filter or 'All Barangays'}",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "summary": f"Total of {total_reports} reports recorded in the past {days} days.",
                "statistics": {
                    "total_reports": total_reports,
                    "by_category": categories,
                    "by_status": statuses,
                    "by_priority": priority_counts,
                    "resolution_rate": f"{round((statuses.get('Resolved', 0) / total_reports) * 100, 1)}%" if total_reports > 0 else "0%"
                },
                "top_barangays": sorted(barangays.items(), key=lambda x: x[1], reverse=True)[:5],
                "insights": []
            }
            
            # Generate insights
            if categories.get("Crime", 0) > total_reports * 0.3:
                report_content["insights"].append("⚠️ High crime rate detected - consider increased patrol")
            if categories.get("Hazard", 0) > total_reports * 0.2:
                report_content["insights"].append("🔧 Multiple hazard reports - infrastructure review recommended")
            if statuses.get("Pending", 0) > total_reports * 0.5:
                report_content["insights"].append("📋 Many reports pending - response time may need improvement")
            if statuses.get("Resolved", 0) > total_reports * 0.7:
                report_content["insights"].append("✅ Good resolution rate - keep up the effective response")
                
        elif report_type == "barangay":
            report_content = {
                "title": f"🏘️ Barangay Breakdown Report - Last {days} Days",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "barangays": {}
            }
            for brgy, count in sorted(barangays.items(), key=lambda x: x[1], reverse=True):
                brgy_reports = [r for r in reports if r.get("address_barangay") == brgy]
                brgy_categories = {}
                for r in brgy_reports:
                    cat = r.get("category", "Others")
                    brgy_categories[cat] = brgy_categories.get(cat, 0) + 1
                report_content["barangays"][brgy] = {
                    "total": count,
                    "percentage": f"{round((count / total_reports) * 100, 1)}%",
                    "categories": brgy_categories
                }
                
        elif report_type == "category":
            report_content = {
                "title": f"📂 Category Analysis Report - Last {days} Days",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "categories": {}
            }
            for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
                cat_reports = [r for r in reports if r.get("category") == cat]
                cat_statuses = {}
                for r in cat_reports:
                    s = r.get("status", "Pending")
                    cat_statuses[s] = cat_statuses.get(s, 0) + 1
                report_content["categories"][cat] = {
                    "total": count,
                    "percentage": f"{round((count / total_reports) * 100, 1)}%",
                    "statuses": cat_statuses,
                    "resolution_rate": f"{round((cat_statuses.get('Resolved', 0) / count) * 100, 1)}%" if count > 0 else "0%"
                }
                
        elif report_type == "trends":
            report_content = {
                "title": f"📈 Trend Analysis Report - Last {days} Days",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "daily_reports": sorted(daily_counts.items()),
                "peak_day": max(daily_counts.items(), key=lambda x: x[1]) if daily_counts else None,
                "average_per_day": round(total_reports / max(len(daily_counts), 1), 1),
                "trend": "increasing" if len(daily_counts) > 1 and list(daily_counts.values())[-1] > list(daily_counts.values())[0] else "stable"
            }
        else:
            report_content = {"error": "Invalid report type"}
        
        # Convert to text format if requested
        if format_type == "text":
            text_report = f"{'='*50}\n{report_content.get('title', 'Report')}\n{'='*50}\n\n"
            if report_content.get('subtitle'):
                text_report += f"{report_content['subtitle']}\n"
            text_report += f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
            
            if report_type == "summary":
                text_report += f"📊 SUMMARY\n{'-'*30}\n"
                text_report += f"Total Reports: {total_reports}\n"
                text_report += f"Resolution Rate: {report_content['statistics']['resolution_rate']}\n\n"
                text_report += f"📂 BY CATEGORY\n"
                for cat, count in report_content['statistics']['by_category'].items():
                    text_report += f"  • {cat}: {count}\n"
                text_report += f"\n📋 BY STATUS\n"
                for status, count in report_content['statistics']['by_status'].items():
                    text_report += f"  • {status}: {count}\n"
                if report_content['insights']:
                    text_report += f"\n💡 INSIGHTS\n"
                    for insight in report_content['insights']:
                        text_report += f"  {insight}\n"
            
            return jsonify({
                "status": "success",
                "report": report_content,
                "text_report": text_report
            }), 200
        
        return jsonify({
            "status": "success",
            "report": report_content
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating report: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": f"Error generating report: {str(e)}"
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


# =============================================================================
# AI AUTO-EVALUATION SYSTEM FOR PREMIUM USERS
# =============================================================================

def get_ai_evaluation_summary(user_id, user_barangay=None):
    """
    Generate AI auto-evaluation summary of reports by priority.
    This function analyzes pending/new reports and categorizes them by priority level.
    
    Returns summary of:
    - Critical priority reports (auto-responded)
    - High priority reports (auto-responded)
    - Medium priority reports (queued for evaluation)
    - Low priority reports (queued for evaluation)
    """
    from services.ml_categorizer import categorize_incident, get_categorizer
    from utils.notifications import get_priority_from_category, is_high_risk_report
    
    try:
        # Fetch recent pending reports (last 24 hours or since last check)
        now = datetime.now()
        yesterday = now - timedelta(days=1)
        
        query = supabase.table("reports").select("*").is_("deleted_at", "null").eq("is_rejected", False)
        
        # Filter by user's barangay if provided
        if user_barangay and user_barangay != "No barangay selected":
            query = query.eq("address_barangay", user_barangay)
        
        # Get reports from last 24 hours
        query = query.gte("created_at", yesterday.isoformat())
        query = query.order("created_at", desc=True)
        
        response = query.execute()
        reports = getattr(response, "data", []) or []
        
        if not reports:
            return {
                "status": "success",
                "has_evaluations": False,
                "message": "No new reports to evaluate in the last 24 hours.",
                "summary": {
                    "total_evaluated": 0,
                    "critical": {"count": 0, "auto_responded": True, "reports": []},
                    "high": {"count": 0, "auto_responded": True, "reports": []},
                    "medium": {"count": 0, "queued_for_evaluation": True, "reports": []},
                    "low": {"count": 0, "queued_for_evaluation": True, "reports": []}
                }
            }
        
        # Categorize and evaluate each report
        evaluation_results = {
            "critical": {"count": 0, "auto_responded": True, "reports": []},
            "high": {"count": 0, "auto_responded": True, "reports": []},
            "medium": {"count": 0, "queued_for_evaluation": True, "reports": []},
            "low": {"count": 0, "queued_for_evaluation": True, "reports": []}
        }
        
        categorizer = get_categorizer()
        
        for report in reports:
            report_id = report.get("id")
            title = report.get("title", "Untitled")
            description = report.get("description", "")
            category = report.get("category", "Others")
            barangay = report.get("address_barangay", "Unknown")
            status = report.get("status", "Pending")
            created_at = report.get("created_at", "")
            
            # Get AI categorization and priority
            ai_result = categorize_incident(description, 0)
            priority = ai_result.get("priority", "Low")
            priority_score = ai_result.get("priority_score", 1)
            confidence = ai_result.get("confidence", 0.5)
            
            # If no priority from AI, derive from category
            if not priority:
                priority = get_priority_from_category(category)
            
            priority_lower = priority.lower()
            
            report_summary = {
                "id": report_id,
                "title": title,
                "category": category,
                "barangay": barangay,
                "status": status,
                "priority": priority,
                "priority_score": priority_score,
                "confidence": round(confidence * 100, 1),
                "created_at": created_at,
                "is_high_risk": is_high_risk_report(priority, priority_score, category)
            }
            
            # Categorize by priority level
            if priority_lower == "critical":
                evaluation_results["critical"]["count"] += 1
                evaluation_results["critical"]["reports"].append(report_summary)
            elif priority_lower == "high":
                evaluation_results["high"]["count"] += 1
                evaluation_results["high"]["reports"].append(report_summary)
            elif priority_lower == "medium":
                evaluation_results["medium"]["count"] += 1
                evaluation_results["medium"]["reports"].append(report_summary)
            else:  # Low or Others
                evaluation_results["low"]["count"] += 1
                evaluation_results["low"]["reports"].append(report_summary)
        
        total_evaluated = len(reports)
        auto_responded = evaluation_results["critical"]["count"] + evaluation_results["high"]["count"]
        queued = evaluation_results["medium"]["count"] + evaluation_results["low"]["count"]
        
        return {
            "status": "success",
            "has_evaluations": total_evaluated > 0,
            "message": f"AI evaluated {total_evaluated} reports in the last 24 hours.",
            "summary": {
                "total_evaluated": total_evaluated,
                "auto_responded": auto_responded,
                "queued_for_evaluation": queued,
                **evaluation_results
            },
            "insights": generate_evaluation_insights(evaluation_results, total_evaluated)
        }
        
    except Exception as e:
        logger.error(f"Error in AI evaluation summary: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "message": f"Error generating evaluation summary: {str(e)}"
        }


def generate_evaluation_insights(results, total):
    """Generate insights from the evaluation results"""
    insights = []
    
    critical_count = results["critical"]["count"]
    high_count = results["high"]["count"]
    medium_count = results["medium"]["count"]
    low_count = results["low"]["count"]
    
    if critical_count > 0:
        insights.append(f"🚨 {critical_count} CRITICAL report(s) detected - Automatic urgent response triggered")
    
    if high_count > 0:
        insights.append(f"🟠 {high_count} HIGH priority report(s) - Responders and officials notified")
    
    if medium_count > 0:
        insights.append(f"⚪ {medium_count} MEDIUM priority report(s) - Queued for evaluation by officials")
    
    if low_count > 0:
        insights.append(f"⚪ {low_count} LOW priority report(s) - Added to assessment queue")
    
    # Calculate auto-response rate
    auto_responded = critical_count + high_count
    if total > 0:
        auto_rate = round((auto_responded / total) * 100, 1)
        if auto_rate > 50:
            insights.append(f"⚡ {auto_rate}% of reports received automatic priority response")
    
    return insights


def format_evaluation_summary_for_chat(summary_data):
    """Format the evaluation summary into a readable chat message"""
    if summary_data.get("status") != "success":
        return "❌ Unable to generate evaluation summary at this time."
    
    if not summary_data.get("has_evaluations"):
        return "✅ No new reports to evaluate in the last 24 hours. Your community is quiet!"
    
    summary = summary_data.get("summary", {})
    insights = summary_data.get("insights", [])
    
    text = "🤖 AI AUTO-EVALUATION SUMMARY\n"
    text += "=" * 35 + "\n\n"
    
    text += f"📊 Total Reports Evaluated: {summary.get('total_evaluated', 0)}\n\n"
    
    # Priority breakdown
    text += "📋 PRIORITY BREAKDOWN:\n\n"
    
    critical = summary.get("critical", {})
    if critical.get("count", 0) > 0:
        text += f"🔴 CRITICAL: {critical['count']} report(s)\n"
        text += "   → Automatic Response: ✅ TRIGGERED\n"
        for r in critical.get("reports", [])[:3]:  # Show max 3
            text += f"   • {r['title'][:30]}... ({r['barangay']})\n"
        if critical["count"] > 3:
            text += f"   + {critical['count'] - 3} more...\n"
        text += "\n"
    
    high = summary.get("high", {})
    if high.get("count", 0) > 0:
        text += f"🟠 HIGH: {high['count']} report(s)\n"
        text += "   → Automatic Response: ✅ TRIGGERED\n"
        for r in high.get("reports", [])[:3]:
            text += f"   • {r['title'][:30]}... ({r['barangay']})\n"
        if high["count"] > 3:
            text += f"   + {high['count'] - 3} more...\n"
        text += "\n"
    
    medium = summary.get("medium", {})
    if medium.get("count", 0) > 0:
        text += f"⚪ MEDIUM: {medium['count']} report(s)\n"
        text += "   → Status: 📋 Queued for Evaluation\n"
        for r in medium.get("reports", [])[:2]:
            text += f"   • {r['title'][:30]}... ({r['barangay']})\n"
        if medium["count"] > 2:
            text += f"   + {medium['count'] - 2} more...\n"
        text += "\n"
    
    low = summary.get("low", {})
    if low.get("count", 0) > 0:
        text += f"⚪ LOW: {low['count']} report(s)\n"
        text += "   → Status: 📋 Assessment Queue\n\n"
    
    # Add insights
    if insights:
        text += "💡 INSIGHTS:\n"
        for insight in insights:
            text += f"   {insight}\n"
    
    text += "\n✨ Premium AI Auto-Evaluation Complete"
    
    return text


@chatbot_bp.route('/auto-approve-priority-reports', methods=['POST'])
@token_required
def auto_approve_priority_reports():
    """
    Auto-approve HIGH and CRITICAL priority reports by setting is_approved=TRUE.
    
    This endpoint:
    1. Checks if user is premium or official (Admin, Barangay Official, Responder)
    2. Fetches all pending HIGH/CRITICAL reports
    3. Auto-approves them by updating is_approved = TRUE
    4. Returns summary of approved reports
    
    Request body (optional):
    {
        "barangay": "specific barangay to filter" (optional)
    }
    """
    user_id = request.user_id
    
    try:
        # Check user role and premium status
        user_resp = supabase.table("users").select("id, role, onpremium").eq("id", user_id).single().execute()
        user_data = getattr(user_resp, "data", None)
        
        if not user_data:
            return jsonify({
                "status": "error",
                "message": "User not found"
            }), 404
        
        user_role = user_data.get("role", "Resident")
        is_premium = user_data.get("onpremium", False)
        
        # Only allow officials and premium users
        allowed_roles = ["Admin", "Barangay Official", "Responder"]
        if user_role not in allowed_roles and not is_premium:
            return jsonify({
                "status": "error",
                "message": "Access denied. Only officials and premium users can auto-approve reports."
            }), 403
        
        # Get user's barangay for filtering (if Barangay Official)
        user_barangay = None
        try:
            info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).single().execute()
            info_data = getattr(info_resp, "data", None)
            if info_data:
                user_barangay = info_data.get("address_barangay")
        except:
            pass
        
        # Get barangay from request if provided
        data = request.get_json() or {}
        filter_barangay = data.get("barangay") or user_barangay
        
        # Find all HIGH and CRITICAL reports that are not yet approved
        query = supabase.table("reports").select(
            "id, title, category, description, address_barangay, priority, is_approved, created_at"
        ).is_("deleted_at", "null").eq("is_rejected", False).eq("is_approved", False)
        
        # Filter by barangay for Barangay Officials
        if user_role == "Barangay Official" and filter_barangay and filter_barangay != "No barangay selected":
            query = query.eq("address_barangay", filter_barangay)
        elif user_role not in ["Admin", "Responder"] and filter_barangay and filter_barangay != "No barangay selected":
            # For premium residents, only their barangay
            query = query.eq("address_barangay", filter_barangay)
        
        response = query.order("created_at", desc=True).execute()
        reports = getattr(response, "data", [])
        
        # Filter for HIGH and CRITICAL priority reports
        priority_mapping = {
            "Crime": "Critical",
            "Hazard": "High", 
            "Fire": "Critical",
            "Accident": "High",
            "Harassment": "High",
            "Vandalism": "Medium",
            "Concern": "Medium",
            "Lost&Found": "Low",
            "Others": "Low"
        }
        
        reports_to_approve = []
        for report in reports:
            # Check explicit priority field first
            priority = report.get("priority")
            if not priority:
                # Derive priority from category
                category = report.get("category", "Others")
                priority = priority_mapping.get(category, "Medium")
            
            # Only approve HIGH and CRITICAL
            if priority in ["Critical", "High"]:
                reports_to_approve.append(report)
        
        if not reports_to_approve:
            return jsonify({
                "status": "success",
                "message": "No HIGH or CRITICAL reports found to auto-approve.",
                "approved_count": 0,
                "approved_reports": []
            }), 200
        
        # Auto-approve the reports
        approved_count = 0
        approved_reports = []
        
        for report in reports_to_approve:
            try:
                update_resp = supabase.table("reports").update({
                    "is_approved": True
                }).eq("id", report["id"]).execute()
                
                if getattr(update_resp, "data", None):
                    approved_count += 1
                    priority = report.get("priority") or priority_mapping.get(report.get("category", "Others"), "Medium")
                    approved_reports.append({
                        "id": report["id"],
                        "title": report.get("title", "Untitled"),
                        "category": report.get("category", "Others"),
                        "priority": priority,
                        "barangay": report.get("address_barangay", "Unknown")
                    })
                    logger.info(f"Auto-approved report {report['id']} (Priority: {priority}) by user {user_id}")
            except Exception as e:
                logger.error(f"Failed to auto-approve report {report['id']}: {e}")
                continue
        
        # Create notification for the action
        try:
            notification_msg = f"🤖 AI Auto-Approved {approved_count} HIGH/CRITICAL priority report(s)"
            supabase.table("admin_notifications").insert({
                "user_id": user_id,
                "message": notification_msg,
                "type": "ai_auto_approve",
                "is_read": False
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to create notification: {e}")
        
        return jsonify({
            "status": "success",
            "message": f"Successfully auto-approved {approved_count} HIGH/CRITICAL priority reports.",
            "approved_count": approved_count,
            "approved_reports": approved_reports,
            "user_role": user_role,
            "barangay_filter": filter_barangay
        }), 200
        
    except Exception as e:
        logger.error(f"Error in auto-approve endpoint: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": f"Error: {str(e)}"
        }), 500


@chatbot_bp.route('/ai-evaluation-summary', methods=['GET'])
@token_required
def get_ai_evaluation_summary_endpoint():
    """
    Get AI auto-evaluation summary for premium users.
    
    This endpoint:
    1. Checks if user is premium (onpremium = true)
    2. Fetches recent reports (last 24 hours)
    3. Auto-evaluates them by priority (Critical, High, Medium, Low)
    4. Returns a summary for chatbot display
    
    Premium users get:
    - Automatic priority filtering
    - Summary of auto-responded (high-risk) reports
    - Summary of queued (lower-priority) reports for evaluation
    """
    user_id = request.user_id
    
    try:
        # Check if user is premium
        user_resp = supabase.table("users").select("id, role, onpremium").eq("id", user_id).single().execute()
        user_data = getattr(user_resp, "data", None)
        
        if not user_data:
            return jsonify({
                "status": "error",
                "message": "User not found"
            }), 404
        
        is_premium = user_data.get("onpremium", False)
        user_role = user_data.get("role", "Resident")
        
        # Premium check - Allow Admins and Barangay Officials, or premium users
        if not is_premium and user_role not in ["Admin", "Barangay Official"]:
            return jsonify({
                "status": "error",
                "is_premium": False,
                "message": "AI Auto-Evaluation is a Premium feature. Upgrade to access automatic report filtering and priority summaries.",
                "upgrade_prompt": True
            }), 403
        
        # Get user's barangay for filtering
        user_barangay = None
        try:
            info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).single().execute()
            info_data = getattr(info_resp, "data", None)
            if info_data:
                user_barangay = info_data.get("address_barangay")
        except:
            pass
        
        # Generate evaluation summary
        summary_data = get_ai_evaluation_summary(user_id, user_barangay)
        
        # Format for chat display
        chat_message = format_evaluation_summary_for_chat(summary_data)
        
        return jsonify({
            "status": "success",
            "is_premium": True,
            "user_barangay": user_barangay,
            "data": summary_data,
            "chat_message": chat_message,
            "should_open_chatbot": summary_data.get("has_evaluations", False)
        }), 200
        
    except Exception as e:
        logger.error(f"Error in AI evaluation summary endpoint: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": f"Error: {str(e)}"
        }), 500


@chatbot_bp.route('/check-new-evaluations', methods=['GET'])
@token_required
def check_new_evaluations():
    """
    Quick check endpoint to see if there are HIGH/CRITICAL pending reports to evaluate.
    Used by frontend to decide whether to auto-open chatbot for AI evaluation.
    
    Specifically checks for:
    - Reports with is_approved=FALSE (pending approval)
    - Reports with HIGH or CRITICAL category (Crime, Hazard)
    - Reports from user's barangay (for Barangay Officials)
    
    Returns:
    - has_new_evaluations: bool
    - count: number of pending HIGH/CRITICAL reports
    - should_notify: bool (true if premium user with pending reports)
    - high_priority_count: count of Crime/Hazard reports pending
    """
    user_id = request.user_id
    
    try:
        # Check premium status
        user_resp = supabase.table("users").select("onpremium, role").eq("id", user_id).single().execute()
        user_data = getattr(user_resp, "data", None)
        
        if not user_data:
            return jsonify({"has_new_evaluations": False, "count": 0, "should_notify": False}), 200
        
        is_premium = user_data.get("onpremium", False)
        user_role = user_data.get("role", "Resident")
        
        # Premium check: User must have onpremium=TRUE OR be Admin (Admin bypasses premium check)
        # Note: Admin bypasses but this doesn't auto-grant premium to non-premium admins
        effective_premium = is_premium is True or user_role == "Admin"
        
        # Only notify premium users or officials
        if not effective_premium:
            return jsonify({
                "has_new_evaluations": False, 
                "count": 0, 
                "should_notify": False,
                "is_premium": False
            }), 200
        
        # Get user's barangay
        user_barangay = None
        try:
            info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).single().execute()
            info_data = getattr(info_resp, "data", None)
            if info_data:
                user_barangay = info_data.get("address_barangay")
        except:
            pass
        
        # Query for pending reports (is_approved=FALSE) that are HIGH/CRITICAL priority
        # Crime = Critical, Hazard = High priority
        high_priority_categories = ['Crime', 'Hazard']
        
        # First, get total pending reports
        query_total = supabase.table("reports").select("id", count="exact")\
            .is_("deleted_at", "null")\
            .eq("is_rejected", False)\
            .eq("is_approved", False)  # Only pending (not yet approved) reports
        
        if user_barangay and user_barangay != "No barangay selected" and user_role == "Barangay Official":
            query_total = query_total.eq("address_barangay", user_barangay)
        
        total_response = query_total.execute()
        total_pending = total_response.count if hasattr(total_response, 'count') else len(getattr(total_response, "data", []))
        
        # Get HIGH/CRITICAL pending reports (Crime or Hazard category)
        high_priority_count = 0
        for category in high_priority_categories:
            query_high = supabase.table("reports").select("id", count="exact")\
                .is_("deleted_at", "null")\
                .eq("is_rejected", False)\
                .eq("is_approved", False)\
                .eq("category", category)
            
            if user_barangay and user_barangay != "No barangay selected" and user_role == "Barangay Official":
                query_high = query_high.eq("address_barangay", user_barangay)
            
            high_response = query_high.execute()
            high_priority_count += high_response.count if hasattr(high_response, 'count') else len(getattr(high_response, "data", []))
        
        # Only notify if there are HIGH/CRITICAL pending reports
        should_notify = high_priority_count > 0 and effective_premium
        
        logger.info(f"[AI Evaluation Check] User {user_id} ({user_role}): "
                   f"Total pending={total_pending}, HIGH/CRITICAL pending={high_priority_count}, "
                   f"Premium={effective_premium}, ShouldNotify={should_notify}")
        
        return jsonify({
            "has_new_evaluations": high_priority_count > 0,
            "count": total_pending,
            "high_priority_count": high_priority_count,
            "should_notify": should_notify,
            "is_premium": effective_premium,
            "user_barangay": user_barangay,
            "message": f"{high_priority_count} HIGH/CRITICAL reports pending approval" if high_priority_count > 0 else "No high priority pending reports"
        }), 200
        
    except Exception as e:
        logger.error(f"Error checking new evaluations: {e}")
        return jsonify({"has_new_evaluations": False, "count": 0, "should_notify": False}), 200


# ============ CHATBOT USAGE TRACKING ENDPOINTS ============

@chatbot_bp.route('/api/chatbot/usage', methods=['GET'])
def get_chatbot_usage():
    """Get current user's chatbot usage for today"""
    try:
        # Get authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Authorization required"}), 401
        
        token = auth_header.split(' ')[1]
        
        # Get user from token
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            return jsonify({"error": "Invalid token"}), 401
        
        user_id = user_response.user.id
        
        # Get today's date
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Check if user has premium
        user_check = supabase.table('users').select('onpremium').eq('id', user_id).execute()
        is_premium = False
        if user_check.data and len(user_check.data) > 0:
            is_premium = user_check.data[0].get('onpremium', False)
        
        # Get usage for today
        usage_response = supabase.table('ai_usage_aggregates').select('*').eq('user_id', user_id).eq('week_start', today).execute()
        
        if usage_response.data and len(usage_response.data) > 0:
            usage = usage_response.data[0]
            return jsonify({
                "status": "success",
                "usage_count": usage.get('interaction_count', 0),
                "is_premium": is_premium,
                "daily_limit": 10 if not is_premium else None,
                "remaining": max(0, 10 - usage.get('interaction_count', 0)) if not is_premium else None
            }), 200
        else:
            # No usage record for today
            return jsonify({
                "status": "success",
                "usage_count": 0,
                "is_premium": is_premium,
                "daily_limit": 10 if not is_premium else None,
                "remaining": 10 if not is_premium else None
            }), 200
            
    except Exception as e:
        logger.error(f"Error getting chatbot usage: {e}")
        return jsonify({"error": "Failed to get usage data"}), 500


@chatbot_bp.route('/api/chatbot/usage/increment', methods=['POST'])
def increment_chatbot_usage():
    """Increment chatbot usage count for current user"""
    try:
        # Get authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Authorization required"}), 401
        
        token = auth_header.split(' ')[1]
        
        # Get user from token
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            return jsonify({"error": "Invalid token"}), 401
        
        user_id = user_response.user.id
        
        # Get today's date
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Check if user has premium
        user_check = supabase.table('users').select('onpremium').eq('id', user_id).execute()
        is_premium = False
        if user_check.data and len(user_check.data) > 0:
            is_premium = user_check.data[0].get('onpremium', False)
        
        # Get current usage for today
        usage_response = supabase.table('ai_usage_aggregates').select('*').eq('user_id', user_id).eq('week_start', today).execute()
        
        current_count = 0
        if usage_response.data and len(usage_response.data) > 0:
            current_count = usage_response.data[0].get('interaction_count', 0)
            
            # Check if limit reached for non-premium users
            if not is_premium and current_count >= 10:
                return jsonify({
                    "status": "limit_reached",
                    "usage_count": current_count,
                    "is_premium": is_premium,
                    "daily_limit": 10,
                    "remaining": 0,
                    "message": "Daily limit reached. Upgrade to premium for unlimited access."
                }), 200
            
            # Update existing record
            new_count = current_count + 1
            supabase.table('ai_usage_aggregates').update({
                'interaction_count': new_count,
                'updated_at': datetime.now().isoformat()
            }).eq('user_id', user_id).eq('week_start', today).execute()
            
        else:
            # Create new record for today
            new_count = 1
            supabase.table('ai_usage_aggregates').insert({
                'user_id': user_id,
                'week_start': today,
                'total_seconds': 0,
                'usage_percent': 0,
                'interaction_count': new_count,
                'updated_at': datetime.now().isoformat()
            }).execute()
        
        remaining = max(0, 10 - new_count) if not is_premium else None
        
        return jsonify({
            "status": "success",
            "usage_count": new_count,
            "is_premium": is_premium,
            "daily_limit": 10 if not is_premium else None,
            "remaining": remaining,
            "limit_reached": not is_premium and new_count >= 10
        }), 200
            
    except Exception as e:
        logger.error(f"Error incrementing chatbot usage: {e}")
        return jsonify({"error": "Failed to increment usage"}), 500