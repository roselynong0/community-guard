"""
Notification Helper Functions
Creates notifications for users and admins
"""
from datetime import datetime, timezone
from utils.supabase_client import supabase


def create_report_notification(user_id, report_id, report_title, new_status, actor_id=None):
    """
    Create a notification for a user about their report status change
    """
    # Defensive validation
    if not user_id:
        print("⚠️ create_report_notification called without user_id")
        return None

    status_key = str(new_status).lower() if new_status is not None else ""
    type_label = "Status Update"
    title = "Report Status"

    status_messages = {
        "pending": f'Your report "{report_title}" is now PENDING review.',
        "ongoing": f'Your report "{report_title}" is now ONGOING authorities are taking action.',
        "resolved": f'Your report "{report_title}" has been RESOLVED by the authorities.',
        "deleted": f'Your report "{report_title}" has been removed by the administration.'
    }

    if status_key:
        message = status_messages.get(status_key, f'Your report "{report_title}" status was updated to {new_status}.')
    else:
        message = f'Update regarding your report "{report_title}".'

    if status_key == "deleted":
        type_label = "Report Deleted"
        title = "Report Removed"

    try:
        print(f"📧 Creating notification ({type_label}): {message}")
        # Request the DB to insert the notification (avoid chaining .select() for client compatibility)
        res = supabase.table("notifications").insert({
            "user_id": user_id,
            "report_id": report_id,
            "type": type_label,
            "title": title,
            "message": message,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()

        inserted = getattr(res, "data", []) or []
        inserted_row = inserted[0] if inserted else None
        if inserted_row:
            print(f"✅ Notification created successfully: id={inserted_row.get('id')}")

            # If an actor_id is provided (admin performed the action), create a linked admin-only notification
            if actor_id:
                try:
                    # Resolve reporter info for richer admin message
                    reporter_name = str(user_id)
                    reporter_email = ""
                    barangay = "the area"
                    try:
                        reporter_resp = supabase.table("users").select("firstname, lastname, email, barangay").eq("id", user_id).single().execute()
                        reporter_data = getattr(reporter_resp, "data", None) or {}
                        if reporter_data:
                            reporter_name = f"{reporter_data.get('firstname','').strip()} {reporter_data.get('lastname','').strip()}".strip() or str(user_id)
                            reporter_email = reporter_data.get('email', '')
                            barangay = reporter_data.get('barangay', '') or "the area"
                    except Exception:
                        pass

                    # Create admin-focused notification message based on status
                    admin_type = type_label
                    admin_title = title

                    if status_key == "pending":
                        admin_message = f"{reporter_name} submitted a new report '{report_title}' in {barangay}. Please review and update its status."
                    elif status_key == "ongoing":
                        admin_message = f"Report '{report_title}' was updated to ONGOING. Action is being taken."
                    elif status_key == "resolved":
                        admin_message = f"Report '{report_title}' was updated to RESOLVED. Investigation completed."
                    elif status_key == "deleted":
                        admin_type = "Report Alert"
                        admin_title = "Report deleted"
                        admin_message = f"Report '{report_title}' was deleted and removed from the system."
                    else:
                        admin_message = f"Report '{report_title}' was updated to {str(new_status).upper()}."

                    # Use the helper which handles insertion defensively and avoids .select() on insert
                    create_admin_notification(
                        actor_id=actor_id, 
                        user_id=user_id, 
                        report_id=report_id, 
                        title=admin_title, 
                        type_label=admin_type, 
                        message=admin_message, 
                        notification_id=inserted_row.get("id"),
                        status=new_status
                    )
                except Exception as adde:
                    # Fail gracefully if admin_notifications table doesn't exist or insert fails
                    print(f"⚠️ Failed to create admin notification: {adde}")

            return inserted_row

        print("❌ Notification insert returned no row")
        return None
    except Exception as e:
        print(f"❌ Failed to create report notification: {e}")
        return None


def create_admin_notification(actor_id, user_id, report_id, title, type_label, message, notification_id=None, status=None):
    """
    Create an admin audit notification linking to the user notification.
    Defensive implementation: will not crash if admin_notifications table does not exist.
    Formats messages in professional style with title, type, message, timestamp, recipient, and actor info.
    """
    if not actor_id or not user_id:
        print("⚠️ create_admin_notification called with incomplete parameters")
        return None

    try:
        # Resolve actor info
        actor_name = str(actor_id)
        actor_email = ""
        actor_role = ""
        try:
            actor_resp = supabase.table("users").select("firstname, lastname, email, role").eq("id", actor_id).single().execute()
            actor_data = getattr(actor_resp, "data", None) or {}
            if actor_data:
                actor_name = f"{actor_data.get('firstname','').strip()} {actor_data.get('lastname','').strip()}".strip() or str(actor_id)
                actor_email = actor_data.get('email', '')
                actor_role = actor_data.get('role', '')
        except Exception:
            pass

        # Resolve recipient info
        recipient_name = str(user_id)
        recipient_email = ""
        recipient_role = ""
        try:
            user_resp = supabase.table("users").select("firstname, lastname, email, role").eq("id", user_id).single().execute()
            user_data = getattr(user_resp, "data", None) or {}
            if user_data:
                recipient_name = f"{user_data.get('firstname','').strip()} {user_data.get('lastname','').strip()}".strip() or str(user_id)
                recipient_email = user_data.get('email', '')
                recipient_role = user_data.get('role', '')
        except Exception:
            pass

        # Format recipient and actor display strings with email and role
        if recipient_role and recipient_role != "Resident":
            recipient_display = f"{recipient_name} ({recipient_role}) <{recipient_email}>" if recipient_email else f"{recipient_name} ({recipient_role})"
        else:
            recipient_display = f"{recipient_name} <{recipient_email}>" if recipient_email else recipient_name
        
        if actor_role and actor_role != "Resident":
            actor_display = f"{actor_name} ({actor_role}) <{actor_email}>" if actor_email else f"{actor_name} ({actor_role})"
        else:
            actor_display = f"{actor_name} <{actor_email}>" if actor_email else actor_name

        # Get formatted timestamp
        now = datetime.now(timezone.utc)
        timestamp_str = now.strftime("%m/%d/%Y, %I:%M:%S %p")

        # Build professional admin notification message
        # Store only the base message content (UI will format the timestamp, To, By separately)
        admin_message = f"{message}"

        # Attempt to insert admin notification (but don't crash if table doesn't exist)
        try:
            res = supabase.table("admin_notifications").insert({
                "actor_id": actor_id,
                "user_id": user_id,
                "report_id": report_id,
                "title": title,
                "type": type_label,
                "message": admin_message,
                "is_read": False,
                "created_at": now.isoformat()
            }).execute()

            admin_inserted = getattr(res, "data", []) or []
            admin_row = admin_inserted[0] if admin_inserted else None

            if admin_row:
                print(f"✅ Admin notification created: id={admin_row.get('id')}")
                return admin_row
            else:
                print("⚠️ Admin notification insert returned no row (table may not be ready)")
                return None
        except Exception as table_error:
            # Gracefully handle missing table or insertion errors
            print(f"⚠️ Could not create admin notification (table may not exist): {table_error}")
            return None

    except Exception as e:
        print(f"❌ Unexpected error in create_admin_notification: {e}")
        return None


def create_notification(user_id, title, message, notif_type="Alert"):
    """
    Generic function to create a notification for a user
    """
    try:
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("notifications").insert({
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": notif_type,
            "is_read": False,
            "created_at": now
        }).execute()
        return True
    except Exception as e:
        print("Failed to create notification:", e)
        return False


def create_account_deletion_notification(deleted_user_id, deleted_user_name, deleted_user_email, actor_id=None, deletion_reason=""):
    """
    Create an admin audit notification for when an account is permanently deleted.
    This is for admin-only tracking of account deletions.
    """
    if not deleted_user_id or not actor_id:
        print("⚠️ create_account_deletion_notification requires deleted_user_id and actor_id")
        return None

    try:
        # Resolve admin/actor info
        actor_name = str(actor_id)
        actor_email = ""
        actor_role = ""
        try:
            actor_resp = supabase.table("users").select("firstname, lastname, email, role").eq("id", actor_id).single().execute()
            actor_data = getattr(actor_resp, "data", None) or {}
            if actor_data:
                first_name = actor_data.get('firstname', '').strip()
                last_name = actor_data.get('lastname', '').strip()
                actor_name = f"{first_name} {last_name}".strip() or str(actor_id)
                actor_email = actor_data.get('email', '')
                actor_role = actor_data.get('role', '')
        except Exception:
            pass

        # Format display strings with email and role
        if actor_role and actor_role != "Resident":
            actor_display = f"{actor_name} ({actor_role}) <{actor_email}>" if actor_email else f"{actor_name} ({actor_role})"
        else:
            actor_display = f"{actor_name} <{actor_email}>" if actor_email else actor_name
        
        deleted_display = f"{deleted_user_name} <{deleted_user_email}>" if deleted_user_email else deleted_user_name

        # Get formatted timestamp
        now = datetime.now(timezone.utc)
        timestamp_str = now.strftime("%m/%d/%Y, %I:%M:%S %p")

        # Build admin notification title and message
        admin_title = "User account permanently deleted"
        admin_type = "Account Alert"

        # Create detailed message with reason if provided
        if deletion_reason:
            admin_message = f"Account of {deleted_display} was permanently deleted. All posts, reports, and related data were removed.\n\nReason: {deletion_reason}"
        else:
            admin_message = f"Account of {deleted_display} was permanently deleted. All posts, reports, and related data were removed."

        # Note: Timestamp and actor info will be formatted by the UI

        # Insert admin notification
        try:
            res = supabase.table("admin_notifications").insert({
                "actor_id": actor_id,
                "user_id": deleted_user_id,
                "report_id": None,
                "title": admin_title,
                "type": admin_type,
                "message": admin_message,
                "is_read": False,
                "created_at": now.isoformat()
            }).execute()

            admin_inserted = getattr(res, "data", []) or []
            admin_row = admin_inserted[0] if admin_inserted else None

            if admin_row:
                print(f"✅ Account deletion notification created: id={admin_row.get('id')}")
                return admin_row
            else:
                print("⚠️ Account deletion notification insert returned no row")
                return None
        except Exception as table_error:
            # Gracefully handle missing table or insertion errors
            print(f"⚠️ Could not create account deletion notification (table may not exist): {table_error}")
            return None

    except Exception as e:
        print(f"❌ Unexpected error in create_account_deletion_notification: {e}")
        return None


def create_barangay_notification(barangay_official_id, report_id, report_title, event_type, barangay_name, report_category=None, actor_name=None):
    """
    Create a notification for a barangay official about report activity in their barangay.
    
    Args:
        barangay_official_id: ID of the barangay official to notify
        report_id: ID of the report that triggered the notification
        report_title: Title of the report
        event_type: Type of event - "created", "updated", "deleted", "status_changed"
        barangay_name: Name of the barangay
        report_category: Category of the report (optional)
        actor_name: Name of the user/admin who triggered the event (optional)
    """
    if not barangay_official_id:
        print("⚠️ create_barangay_notification called without barangay_official_id")
        return None

    event_type = str(event_type).lower()
    
    # Build notification message based on event type
    if event_type == "created":
        title = "New Report in Your Barangay"
        message = f'New report "{report_title}" was submitted in {barangay_name}.'
        if report_category:
            message += f' Category: {report_category}.'
        type_label = "Report Alert"
    
    elif event_type == "status_changed":
        title = "Report Status Update"
        message = f'Report "{report_title}" in {barangay_name} has been updated.'
        type_label = "Status Update"
    
    elif event_type == "updated":
        title = "Report Updated"
        message = f'Report "{report_title}" in {barangay_name} has been updated.'
        type_label = "Report Update"
    
    elif event_type == "deleted":
        title = "Report Deleted"
        message = f'Report "{report_title}" in {barangay_name} has been deleted and removed from the system.'
        type_label = "Report Alert"
    
    else:
        title = "Report Activity in Your Barangay"
        message = f'Activity detected on report "{report_title}" in {barangay_name}.'
        type_label = "Notification"

    try:
        print(f"📧 Creating barangay notification ({type_label}): {message}")
        
        res = supabase.table("notifications").insert({
            "user_id": barangay_official_id,
            "report_id": report_id,
            "type": type_label,
            "title": title,
            "message": message,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()

        inserted = getattr(res, "data", []) or []
        inserted_row = inserted[0] if inserted else None
        
        if inserted_row:
            print(f"✅ Barangay notification created successfully: id={inserted_row.get('id')}")
            return inserted_row
        else:
            print("❌ Barangay notification insert returned no row")
            return None
    
    except Exception as e:
        print(f"❌ Failed to create barangay notification: {e}")
        return None


def create_report_approval_notification(user_id, report_id, report_title, approver_id=None):
    """
    Create a notification when a report gets approved by admin/barangay official.
    Notifies the original reporter that their report is now visible to the public.
    """
    if not user_id:
        print("⚠️ create_report_approval_notification called without user_id")
        return None

    try:
        # Get approver info
        approver_name = "Administrator"
        approver_role = "Admin"
        if approver_id:
            try:
                approver_resp = supabase.table("users").select("firstname, lastname, role").eq("id", approver_id).single().execute()
                approver_data = getattr(approver_resp, "data", None) or {}
                if approver_data:
                    first_name = approver_data.get('firstname', '').strip()
                    last_name = approver_data.get('lastname', '').strip()
                    approver_name = f"{first_name} {last_name}".strip() or "Administrator"
                    approver_role = approver_data.get('role', 'Admin')
            except Exception:
                pass

        title = "Report Approved"
        type_label = "Report Approved"
        message = f'Your report "{report_title}" has been approved and is now visible to the public.'

        print(f"📧 Creating approval notification: {message}")
        
        res = supabase.table("notifications").insert({
            "user_id": user_id,
            "report_id": report_id,
            "type": type_label,
            "title": title,
            "message": message,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()

        inserted = getattr(res, "data", []) or []
        inserted_row = inserted[0] if inserted else None
        
        if inserted_row:
            print(f"✅ Report approval notification created: id={inserted_row.get('id')}")
            return inserted_row
        else:
            print("❌ Report approval notification insert returned no row")
            return None
    
    except Exception as e:
        print(f"❌ Failed to create report approval notification: {e}")
        return None


# =============================================================================
# PRIORITY-BASED AUTOMATIC RESPONSE AND NOTIFICATION SYSTEM
# =============================================================================

# Priority levels and their thresholds
PRIORITY_LEVELS = {
    'Critical': {'score_min': 9, 'auto_respond': True, 'urgent': True, 'color': '#c0392b'},
    'High': {'score_min': 7, 'auto_respond': True, 'urgent': True, 'color': '#d35400'},
    'Medium': {'score_min': 4, 'auto_respond': False, 'urgent': False, 'color': '#95a5a6'},
    'Low': {'score_min': 0, 'auto_respond': False, 'urgent': False, 'color': '#95a5a6'},
}

# Category to priority mapping (matches ml_categorizer.py CATEGORY_PRIORITY)
CATEGORY_PRIORITY_MAP = {
    'Crime': 'Critical',
    'Hazard': 'High', 
    'Concern': 'Medium',
    'Lost&Found': 'Low',
    'Others': 'Low',
}


def get_priority_from_category(category):
    """
    Get priority level from report category.
    Returns: 'Critical', 'High', 'Medium', or 'Low'
    """
    return CATEGORY_PRIORITY_MAP.get(category, 'Low')


def is_high_risk_report(priority=None, priority_score=None, category=None):
    """
    Determine if a report is high-risk based on priority level or score.
    High-risk = Critical or High priority (requires immediate response).
    
    Args:
        priority: Priority level string ('Critical', 'High', 'Medium', 'Low')
        priority_score: Numeric priority score (1-10)
        category: Report category (used as fallback)
    
    Returns:
        bool: True if high-risk, False otherwise
    """
    # Check by priority level first
    if priority:
        priority_upper = str(priority).strip().title()
        if priority_upper in ['Critical', 'High']:
            return True
    
    # Check by priority score
    if priority_score is not None:
        try:
            score = int(priority_score)
            if score >= 7:  # Critical (10) or High (7-9)
                return True
        except (ValueError, TypeError):
            pass
    
    # Fallback to category-based determination
    if category:
        cat_priority = get_priority_from_category(category)
        return cat_priority in ['Critical', 'High']
    
    return False


def process_report_by_priority(report_id, report_title, report_category, reporter_id, 
                                priority=None, priority_score=None, barangay=None,
                                actor_id=None, description=None):
    """
    Main function to process a report based on its priority level.
    
    For HIGH-RISK reports (Critical/High):
        - Automatically trigger response workflow
        - Send urgent notifications to admins, barangay officials, and responders
        - Mark report for immediate attention
        - Return response actions taken
    
    For LOWER priority reports (Medium/Low):
        - Queue for evaluation/assessment
        - Send standard notification to appropriate parties
        - Return evaluation queue status
    
    Args:
        report_id: UUID of the report
        report_title: Title of the report
        report_category: Category (Crime, Hazard, Concern, etc.)
        reporter_id: User ID of the reporter
        priority: Priority level from AI ('Critical', 'High', 'Medium', 'Low')
        priority_score: Numeric priority score (1-10)
        barangay: Barangay name for the report location
        actor_id: ID of the user/system triggering this (for audit trail)
        description: Report description (for context in notifications)
    
    Returns:
        dict: {
            'is_high_risk': bool,
            'priority': str,
            'actions_taken': list,
            'notifications_sent': int,
            'response_type': 'automatic' | 'evaluation_queue'
        }
    """
    # Determine priority if not provided
    if not priority:
        priority = get_priority_from_category(report_category)
    
    priority = str(priority).strip().title()
    high_risk = is_high_risk_report(priority, priority_score, report_category)
    
    result = {
        'is_high_risk': high_risk,
        'priority': priority,
        'priority_score': priority_score,
        'actions_taken': [],
        'notifications_sent': 0,
        'response_type': 'automatic' if high_risk else 'evaluation_queue'
    }
    
    try:
        if high_risk:
            # HIGH-RISK: Automatic Response Flow
            print(f"🚨 HIGH-RISK REPORT DETECTED: {report_title} (Priority: {priority})")
            result = _handle_high_risk_report(
                report_id, report_title, report_category, reporter_id,
                priority, priority_score, barangay, actor_id, description, result
            )
        else:
            # LOWER PRIORITY: Evaluation Queue Flow
            print(f"📋 EVALUATION QUEUE: {report_title} (Priority: {priority})")
            result = _handle_evaluation_queue_report(
                report_id, report_title, report_category, reporter_id,
                priority, priority_score, barangay, actor_id, description, result
            )
    except Exception as e:
        print(f"❌ Error processing report by priority: {e}")
        result['error'] = str(e)
    
    return result


def _handle_high_risk_report(report_id, report_title, report_category, reporter_id,
                              priority, priority_score, barangay, actor_id, description, result):
    """
    Handle high-risk (Critical/High priority) reports with automatic response.
    
    Actions:
    1. Notify the reporter with confirmation
    2. Alert all admins with urgent notification
    3. Alert barangay officials in the affected area
    4. Alert available responders
    5. Create audit trail in admin_notifications
    """
    notifications_sent = 0
    actions = result['actions_taken']
    
    # Priority-specific messaging
    if priority == 'Critical':
        urgency_label = "🔴 CRITICAL EMERGENCY"
        urgency_message = "This report requires IMMEDIATE attention and response."
    else:
        urgency_label = "🟠 HIGH PRIORITY"
        urgency_message = "This report requires urgent attention."
    
    # 1. Notify the reporter (confirmation their urgent report is being handled)
    try:
        reporter_notification = _create_priority_notification(
            user_id=reporter_id,
            report_id=report_id,
            title=f"{urgency_label} - Report Received",
            message=f'Your urgent report "{report_title}" has been received and flagged as {priority.upper()} priority. Authorities have been immediately notified and will respond shortly.',
            notif_type="urgent_confirmation",
            priority=priority
        )
        if reporter_notification:
            notifications_sent += 1
            actions.append(f"Reporter notified of {priority} priority status")
    except Exception as e:
        print(f"⚠️ Failed to notify reporter: {e}")
    
    # 2. Alert all admins with urgent notification
    try:
        admin_count = _notify_all_admins_urgent(
            report_id=report_id,
            report_title=report_title,
            report_category=report_category,
            priority=priority,
            barangay=barangay,
            description=description,
            reporter_id=reporter_id,
            actor_id=actor_id or reporter_id
        )
        notifications_sent += admin_count
        actions.append(f"Notified {admin_count} admin(s) with urgent alert")
    except Exception as e:
        print(f"⚠️ Failed to notify admins: {e}")
    
    # 3. Alert barangay officials in the affected barangay
    try:
        if barangay:
            barangay_count = _notify_barangay_officials_urgent(
                report_id=report_id,
                report_title=report_title,
                report_category=report_category,
                priority=priority,
                barangay=barangay,
                description=description
            )
            notifications_sent += barangay_count
            actions.append(f"Notified {barangay_count} barangay official(s) in {barangay}")
    except Exception as e:
        print(f"⚠️ Failed to notify barangay officials: {e}")
    
    # 4. Alert responders (if available)
    try:
        responder_count = _notify_responders_urgent(
            report_id=report_id,
            report_title=report_title,
            report_category=report_category,
            priority=priority,
            barangay=barangay
        )
        notifications_sent += responder_count
        actions.append(f"Notified {responder_count} responder(s)")
    except Exception as e:
        print(f"⚠️ Failed to notify responders: {e}")
    
    # 5. Create admin audit trail
    try:
        _create_admin_audit_notification(
            actor_id=actor_id or reporter_id,
            user_id=reporter_id,
            report_id=report_id,
            title=f"{urgency_label} - Auto Response Triggered",
            type_label="high_risk_alert",
            message=f'HIGH-RISK report "{report_title}" ({report_category}) automatically triggered emergency response. Priority: {priority}. Location: {barangay or "Unknown"}. {notifications_sent} notifications dispatched.',
            priority=priority
        )
        actions.append("Admin audit trail created")
    except Exception as e:
        print(f"⚠️ Failed to create admin audit: {e}")
    
    result['notifications_sent'] = notifications_sent
    result['actions_taken'] = actions
    
    print(f"✅ High-risk report processed: {notifications_sent} notifications sent, {len(actions)} actions taken")
    return result


def _handle_evaluation_queue_report(report_id, report_title, report_category, reporter_id,
                                      priority, priority_score, barangay, actor_id, description, result):
    """
    Handle lower priority (Medium/Low) reports by queuing for evaluation.
    
    Actions:
    1. Notify the reporter with standard confirmation
    2. Notify barangay officials for review
    3. Add to evaluation queue (standard admin notification)
    """
    notifications_sent = 0
    actions = result['actions_taken']
    
    # Priority-specific messaging
    if priority == 'Medium':
        status_label = "⚪ MEDIUM PRIORITY"
    else:
        status_label = "⚪ LOW PRIORITY"
    
    # 1. Notify the reporter (standard confirmation)
    try:
        reporter_notification = _create_priority_notification(
            user_id=reporter_id,
            report_id=report_id,
            title="Report Received",
            message=f'Your report "{report_title}" has been received and is queued for review. Our team will assess and respond accordingly.',
            notif_type="report_confirmation",
            priority=priority
        )
        if reporter_notification:
            notifications_sent += 1
            actions.append("Reporter notified of report submission")
    except Exception as e:
        print(f"⚠️ Failed to notify reporter: {e}")
    
    # 2. Notify barangay officials (if barangay is specified)
    try:
        if barangay:
            barangay_count = _notify_barangay_for_evaluation(
                report_id=report_id,
                report_title=report_title,
                report_category=report_category,
                priority=priority,
                barangay=barangay
            )
            notifications_sent += barangay_count
            actions.append(f"Queued for evaluation by {barangay_count} barangay official(s)")
    except Exception as e:
        print(f"⚠️ Failed to queue for barangay evaluation: {e}")
    
    # 3. Create evaluation queue entry (admin notification)
    try:
        _create_admin_audit_notification(
            actor_id=actor_id or reporter_id,
            user_id=reporter_id,
            report_id=report_id,
            title=f"{status_label} - Queued for Evaluation",
            type_label="evaluation_queue",
            message=f'Report "{report_title}" ({report_category}) added to evaluation queue. Priority: {priority}. Location: {barangay or "Unknown"}. Awaiting assessment.',
            priority=priority
        )
        actions.append("Added to evaluation queue")
    except Exception as e:
        print(f"⚠️ Failed to create evaluation queue entry: {e}")
    
    result['notifications_sent'] = notifications_sent
    result['actions_taken'] = actions
    
    print(f"📋 Evaluation queue report processed: {notifications_sent} notifications sent, {len(actions)} actions taken")
    return result


def _create_priority_notification(user_id, report_id, title, message, notif_type, priority):
    """
    Create a notification with priority context.
    """
    if not user_id:
        return None
    
    try:
        res = supabase.table("notifications").insert({
            "user_id": user_id,
            "report_id": report_id,
            "title": title,
            "type": notif_type,
            "message": message,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        
        inserted = getattr(res, "data", []) or []
        return inserted[0] if inserted else None
    except Exception as e:
        print(f"❌ Failed to create priority notification: {e}")
        return None


def _notify_all_admins_urgent(report_id, report_title, report_category, priority, 
                               barangay, description, reporter_id, actor_id):
    """
    Send urgent notifications to all admin users.
    """
    count = 0
    try:
        # Get all admin users
        admin_resp = supabase.table("users").select("id, firstname, lastname, email").eq("role", "Admin").execute()
        admins = getattr(admin_resp, "data", []) or []
        
        for admin in admins:
            admin_id = admin.get('id')
            if not admin_id:
                continue
            
            # Create admin_notifications entry for urgent alert
            try:
                priority_emoji = "🔴" if priority == "Critical" else "🟠"
                supabase.table("admin_notifications").insert({
                    "actor_id": actor_id,
                    "user_id": reporter_id,
                    "report_id": report_id,
                    "title": f"{priority_emoji} {priority.upper()} ALERT",
                    "type": "high_risk_alert",
                    "message": f'URGENT: {priority} priority report "{report_title}" ({report_category}) requires immediate attention. Location: {barangay or "Unknown"}.',
                    "is_read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }).execute()
                count += 1
            except Exception as admin_err:
                print(f"⚠️ Failed to notify admin {admin_id}: {admin_err}")
        
    except Exception as e:
        print(f"❌ Failed to fetch admins: {e}")
    
    return count


def _notify_barangay_officials_urgent(report_id, report_title, report_category, priority, barangay, description):
    """
    Send urgent notifications to barangay officials in the affected area.
    """
    count = 0
    try:
        # Get barangay officials for this barangay (barangay is stored in info table as address_barangay)
        # First get user_ids from info table that match the barangay
        info_resp = supabase.table("info").select("user_id").eq("address_barangay", barangay).execute()
        barangay_user_ids = [i.get("user_id") for i in (getattr(info_resp, "data", []) or []) if i.get("user_id")]
        
        if not barangay_user_ids:
            print(f"⚠️ No users found in barangay {barangay}")
            return 0
        
        # Then filter to only Barangay Officials
        officials_resp = supabase.table("users").select("id, firstname, lastname").eq("role", "Barangay Official").in_("id", barangay_user_ids).execute()
        officials = getattr(officials_resp, "data", []) or []
        
        for official in officials:
            official_id = official.get('id')
            if not official_id:
                continue
            
            try:
                priority_emoji = "🔴" if priority == "Critical" else "🟠"
                supabase.table("notifications").insert({
                    "user_id": official_id,
                    "report_id": report_id,
                    "title": f"{priority_emoji} URGENT: {priority} Report in {barangay}",
                    "type": "urgent_barangay_alert",
                    "message": f'{priority.upper()} PRIORITY: Report "{report_title}" ({report_category}) requires immediate response in your barangay.',
                    "is_read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }).execute()
                count += 1
            except Exception as off_err:
                print(f"⚠️ Failed to notify barangay official {official_id}: {off_err}")
        
    except Exception as e:
        print(f"❌ Failed to fetch barangay officials: {e}")
    
    return count


def _notify_responders_urgent(report_id, report_title, report_category, priority, barangay):
    """
    Send urgent notifications to available responders in the same barangay.
    """
    count = 0
    try:
        # Get responders in the same barangay (barangay is stored in info table as address_barangay)
        if barangay:
            info_resp = supabase.table("info").select("user_id").eq("address_barangay", barangay).execute()
            barangay_user_ids = [i.get("user_id") for i in (getattr(info_resp, "data", []) or []) if i.get("user_id")]
            
            if barangay_user_ids:
                responders_resp = supabase.table("users").select("id, firstname, lastname").eq("role", "Responder").in_("id", barangay_user_ids).execute()
            else:
                responders_resp = type('obj', (object,), {'data': []})()
        else:
            # If no barangay specified, notify all responders
            responders_resp = supabase.table("users").select("id, firstname, lastname").eq("role", "Responder").execute()
        
        responders = getattr(responders_resp, "data", []) or []
        
        for responder in responders:
            responder_id = responder.get('id')
            if not responder_id:
                continue
            
            try:
                priority_emoji = "🔴" if priority == "Critical" else "🟠"
                supabase.table("notifications").insert({
                    "user_id": responder_id,
                    "report_id": report_id,
                    "title": f"{priority_emoji} URGENT DISPATCH: {priority} Incident",
                    "type": "urgent_responder_alert",
                    "message": f'{priority.upper()} INCIDENT: "{report_title}" ({report_category}) at {barangay or "Unknown location"}. Immediate response required.',
                    "is_read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }).execute()
                count += 1
            except Exception as resp_err:
                print(f"⚠️ Failed to notify responder {responder_id}: {resp_err}")
        
    except Exception as e:
        print(f"❌ Failed to fetch responders: {e}")
    
    return count


def _notify_barangay_for_evaluation(report_id, report_title, report_category, priority, barangay):
    """
    Notify barangay officials about a report queued for evaluation.
    """
    count = 0
    try:
        # Get barangay officials for this barangay (barangay is stored in info table as address_barangay)
        # First get user_ids from info table that match the barangay
        info_resp = supabase.table("info").select("user_id").eq("address_barangay", barangay).execute()
        barangay_user_ids = [i.get("user_id") for i in (getattr(info_resp, "data", []) or []) if i.get("user_id")]
        
        if not barangay_user_ids:
            print(f"⚠️ No users found in barangay {barangay}")
            return 0
        
        # Then filter to only Barangay Officials
        officials_resp = supabase.table("users").select("id").eq("role", "Barangay Official").in_("id", barangay_user_ids).execute()
        officials = getattr(officials_resp, "data", []) or []
        
        for official in officials:
            official_id = official.get('id')
            if not official_id:
                continue
            
            try:
                supabase.table("notifications").insert({
                    "user_id": official_id,
                    "report_id": report_id,
                    "title": f"New Report for Review - {barangay}",
                    "type": "evaluation_request",
                    "message": f'Report "{report_title}" ({report_category}) submitted in your barangay. Priority: {priority}. Please assess and take appropriate action.',
                    "is_read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }).execute()
                count += 1
            except Exception as off_err:
                print(f"⚠️ Failed to notify barangay official for evaluation: {off_err}")
        
    except Exception as e:
        print(f"❌ Failed to queue for barangay evaluation: {e}")
    
    return count


def _create_admin_audit_notification(actor_id, user_id, report_id, title, type_label, message, priority):
    """
    Create an admin audit trail notification.
    """
    try:
        supabase.table("admin_notifications").insert({
            "actor_id": actor_id,
            "user_id": user_id,
            "report_id": report_id,
            "title": title,
            "type": type_label,
            "message": message,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        return True
    except Exception as e:
        print(f"❌ Failed to create admin audit notification: {e}")
        return False


def trigger_priority_response(report_data, actor_id=None):
    """
    Convenience function to trigger priority-based response from a report object.
    Call this when a new report is created or when priority is updated.
    
    Args:
        report_data: dict containing report fields:
            - id: Report UUID
            - title: Report title
            - category: Report category
            - user_id: Reporter's user ID
            - address_barangay / barangay: Location
            - description: Report description
            - ai_priority / priority: Priority level (if available)
            - ai_priority_score / priority_score: Priority score (if available)
        actor_id: ID of the user/system triggering this
    
    Returns:
        dict: Result from process_report_by_priority()
    """
    return process_report_by_priority(
        report_id=report_data.get('id'),
        report_title=report_data.get('title', 'Untitled Report'),
        report_category=report_data.get('category', 'Others'),
        reporter_id=report_data.get('user_id'),
        priority=report_data.get('ai_priority') or report_data.get('priority'),
        priority_score=report_data.get('ai_priority_score') or report_data.get('priority_score'),
        barangay=report_data.get('address_barangay') or report_data.get('barangay'),
        actor_id=actor_id,
        description=report_data.get('description')
    )
