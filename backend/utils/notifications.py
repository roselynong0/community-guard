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
    title = f"Report Status: {new_status}" if new_status else "Report Update"

    status_messages = {
        "pending": f'Your report "{report_title}" is now PENDING review.',
        "ongoing": f'Your report "{report_title}" is now ONGOING - authorities are taking action.',
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
            # Create corresponding admin notification
            try:
                create_admin_notification(
                    actor_id=actor_id or user_id,
                    user_id=user_id,
                    report_id=report_id,
                    notification_id=inserted_row.get("id"),
                    title=f"Report notification sent to user",
                    type_label="Notification Sent",
                    message=f"User {user_id} was notified: {message}"
                )
            except Exception as e:
                print(f"⚠️ Failed to create admin notification for report notification: {e}")
            
            return inserted_row

        print("❌ Notification insert returned no row")
        return None
    except Exception as e:
        print(f"❌ Failed to create report notification: {e}")
        return None


def create_admin_notification(actor_id, user_id=None, report_id=None, title=None, type_label="Admin Alert", message=None, notification_id=None):
    """
    Insert a row into admin_notifications for admin-only auditing and alerts.
    actor_id is required by the schema; for user-driven events we commonly set actor_id=user_id.
    """
    if not actor_id:
        print("⚠️ create_admin_notification requires actor_id")
        return None

    try:
        payload = {
            "actor_id": actor_id,
            "user_id": user_id,
            "notification_id": notification_id,
            "report_id": report_id,
            "type": type_label,
            "title": title,
            "message": message or "",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            res = supabase.table("admin_notifications").insert(payload).execute()
            inserted = getattr(res, "data", []) or []
            return inserted[0] if inserted else None
        except Exception as e:
            print(f"⚠️ admin_notifications table might not exist or insert failed: {e}")
            return None
            
    except Exception as e:
        print(f"❌ create_admin_notification unexpected error: {e}")
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
