# utils/db.py
import sys
import os
from flask_sqlalchemy import SQLAlchemy
from master.models import Destination


# 🔹 Ensure project root is in Python’s path (for "models" import to work)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from models import Destination  # adjust if models.py is in the root folder

# 🔹 Initialize SQLAlchemy (Flask app binds this later in app.py)
db = SQLAlchemy()

def get_all_destinations_from_db():
    """Fetch all destinations from the database."""
    try:
        destinations = Destination.query.all()
        return [dest.to_dict() for dest in destinations]
    except Exception as e:
        print(f"[DB Error] Failed to fetch destinations: {e}")
        return []
