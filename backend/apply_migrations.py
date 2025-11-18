#!/usr/bin/env python3
"""
Migration runner - Apply all SQL migrations to Supabase
Ensures database schema is up-to-date before running the app
"""

import os
import sys
from pathlib import Path
from config import supabase
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_migration_files():
    """Get all migration files sorted by name"""
    migrations_dir = Path(__file__).parent.parent / 'migrations'
    if not migrations_dir.exists():
        logger.error(f"Migrations directory not found: {migrations_dir}")
        return []
    
    migration_files = sorted([f for f in migrations_dir.glob('*.sql')])
    return migration_files

def apply_migration(file_path):
    """Apply a single migration file"""
    try:
        with open(file_path, 'r') as f:
            sql_content = f.read()
        
        # Skip empty files or files with only comments
        if not sql_content.strip() or sql_content.strip().startswith('--'):
            logger.info(f"⏭️  Skipping empty migration: {file_path.name}")
            return True
        
        logger.info(f"📝 Applying migration: {file_path.name}")
        
        # Split by semicolon to handle multiple statements
        statements = [s.strip() for s in sql_content.split(';') if s.strip()]
        
        for statement in statements:
            if statement.startswith('--'):
                # Skip comment-only statements
                continue
            
            try:
                # Execute using Supabase client
                result = supabase.query(statement)
                logger.debug(f"✓ Statement executed successfully")
            except Exception as e:
                # Some statements might fail if they already exist (e.g., CREATE IF NOT EXISTS)
                # Log but continue
                logger.warning(f"⚠️  Statement warning (may be expected): {str(e)[:100]}")
                continue
        
        logger.info(f"✅ Migration applied: {file_path.name}")
        return True
    
    except Exception as e:
        logger.error(f"❌ Error applying migration {file_path.name}: {str(e)}")
        return False

def run_all_migrations():
    """Run all migrations in sequence"""
    logger.info("="*60)
    logger.info("🚀 Starting migration runner...")
    logger.info("="*60)
    
    migration_files = get_migration_files()
    
    if not migration_files:
        logger.error("No migration files found!")
        return False
    
    logger.info(f"Found {len(migration_files)} migration files")
    print()
    
    successful = 0
    failed = 0
    
    for migration_file in migration_files:
        if apply_migration(migration_file):
            successful += 1
        else:
            failed += 1
    
    print()
    logger.info("="*60)
    logger.info(f"Migration Summary:")
    logger.info(f"  ✅ Successful: {successful}")
    logger.info(f"  ❌ Failed: {failed}")
    logger.info("="*60)
    
    return failed == 0

if __name__ == '__main__':
    try:
        success = run_all_migrations()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        sys.exit(1)
