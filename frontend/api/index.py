import sys
from pathlib import Path

# Add current api folder to sys.path so modules like database, routers, llm are directly importable
api_dir = Path(__file__).resolve().parent
if str(api_dir) not in sys.path:
    sys.path.insert(0, str(api_dir))

from main import app  # ASGI app for Vercel
