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


def notify_residents_of_approved_report(report_id, report_title, barangay):
    """
    Notify all residents in a barangay about a new approved report in their area.
    """
    if not report_id or not barangay:
        print("⚠️ notify_residents_of_approved_report called with missing parameters")
        return

    try:
        # Get all residents (role is "Resident" or empty/null which defaults to Resident)
        # Query all users and filter by role being null or "Resident"
        all_users_resp = supabase.table("users").select("id, role").execute()
        all_users = getattr(all_users_resp, "data", []) or []
        
        # Get their info to filter by barangay
        resident_ids_in_barangay = []
        for user in all_users:
            user_id = user.get("id")
            user_role = user.get("role")
            
            # Skip if user is not a resident (check if role is "Resident" or None/empty)
            if user_role and user_role not in ["Resident", None, ""]:
                continue
            
            try:
                info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).single().execute()
                info_data = getattr(info_resp, "data", None)
                if info_data and info_data.get("address_barangay") == barangay:
                    resident_ids_in_barangay.append(user_id)
            except:
                pass
        
        if not resident_ids_in_barangay:
            print(f"ℹ️ No residents found in barangay {barangay}")
            return
        
        # Create notification for each resident
        title = "New Report in Your Barangay"
        message = f'A new report "{report_title}" has been posted in {barangay}.'
        type_label = "New Report"
        
        for resident_id in resident_ids_in_barangay:
            try:
                supabase.table("notifications").insert({
                    "user_id": resident_id,
                    "report_id": report_id,
                    "type": type_label,
                    "title": title,
                    "message": message,
                    "is_read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }).execute()
            except Exception as e:
                print(f"⚠️ Failed to notify resident {resident_id}: {e}")
        
        print(f"✅ Notified {len(resident_ids_in_barangay)} residents in {barangay} about new report")
    
    except Exception as e:
        print(f"❌ Failed to notify residents: {e}")


def create_verification_notification(user_id, user_name, admin_id=None):
    """
    Create a notification prompting user to update their information to get verified.
    Called from Admin-Users when a user hasn't completed verification yet.
    """
    if not user_id:
        print("⚠️ create_verification_notification called without user_id")
        return None

    try:
        title = "Update Your Information"
        type_label = "Verification Needed"
        message = f"Please update your information in your profile to get verified as a trusted community member."
        
        print(f"📧 Creating verification notification for user {user_id}")
        
        res = supabase.table("notifications").insert({
            "user_id": user_id,
            "type": type_label,
            "title": title,
            "message": message,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()

        inserted = getattr(res, "data", []) or []
        inserted_row = inserted[0] if inserted else None
        
        if inserted_row:
            print(f"✅ Verification notification created: id={inserted_row.get('id')}")
            return inserted_row
        else:
            print("❌ Verification notification insert returned no row")
            return None
    
    except Exception as e:
        print(f"❌ Failed to create verification notification: {e}")
        return None

