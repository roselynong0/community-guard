#!/usr/bin/env python3
"""
Quick Migration Check Script
Verifies that all required AI usage tracking tables and functions exist
"""

import os
import sys
from config import supabase
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def check_table_exists(table_name):
    """Check if a table exists"""
    try:
        result = supabase.table(table_name).select('*', count='exact').limit(1).execute()
        return True
    except Exception as e:
        if 'does not exist' in str(e) or 'relation' in str(e):
            return False
        # Other errors might mean the table exists but we can't query it
        return False

def check_view_exists(view_name):
    """Check if a view exists by attempting to query it"""
    try:
        result = supabase.table(view_name).select('*', count='exact').limit(1).execute()
        return True
    except Exception as e:
        if 'does not exist' in str(e) or 'relation' in str(e):
            return False
        return False

def check_rpc_function_exists(function_name):
    """Check if an RPC function exists by attempting to call it with dummy params"""
    try:
        # Try to call with minimal params - will fail validation but proves function exists
        result = supabase.rpc(function_name, {
            'p_user_id': '00000000-0000-0000-0000-000000000000',
            'p_interaction_type': 'test',
            'p_duration_seconds': 0
        }).execute()
        # If we got here, function exists
        return True
    except Exception as e:
        error_str = str(e).lower()
        # Function doesn't exist vs other errors
        if 'function' in error_str and 'not found' in error_str:
            return False
        if 'does not exist' in error_str:
            return False
        if 'could not find rpc' in error_str:
            return False
        # If it's another error, the function might exist
        return True

def main():
    logger.info("=" * 60)
    logger.info("🔍 AI Usage Tracking - Migration Status Check")
    logger.info("=" * 60)
    
    checks = {
        'ai_usage_logs table': lambda: check_table_exists('ai_usage_logs'),
        'ai_usage_aggregates table': lambda: check_table_exists('ai_usage_aggregates'),
        'vw_ai_current_week_usage view': lambda: check_view_exists('vw_ai_current_week_usage'),
        'log_ai_interaction() RPC function': lambda: check_rpc_function_exists('log_ai_interaction'),
    }
    
    all_good = True
    
    for name, check_func in checks.items():
        try:
            exists = check_func()
            status = "✅ EXISTS" if exists else "❌ MISSING"
            logger.info(f"{status}: {name}")
            if not exists:
                all_good = False
        except Exception as e:
            logger.error(f"⚠️  ERROR checking {name}: {str(e)[:100]}")
            all_good = False
    
    logger.info("=" * 60)
    
    if all_good:
        logger.info("✅ All AI usage tracking components are in place!")
        logger.info("   You can use Smart Filter without issues.")
        return 0
    else:
        logger.error("❌ Some components are missing!")
        logger.error("   Run: python apply_migrations.py")
        logger.error("   Location: cd backend && python apply_migrations.py")
        return 1

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        sys.exit(1)
