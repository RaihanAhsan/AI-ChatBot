from datetime import datetime
import re
from fastapi import APIRouter, HTTPException
from database import get_connection
from schemas import LoginRequest, RegisterRequest, UserProfile

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login", response_model=UserProfile)
def login(payload: LoginRequest):
    email = payload.email.strip().lower()
    password = payload.password.strip()

    if not email or not re.match(r"^\S+@\S+\.\S+$", email):
        raise HTTPException(
            status_code=400, detail="Please enter a valid email address."
        )
    if not password:
        raise HTTPException(status_code=400, detail="Password is required.")

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cur.fetchone()
    conn.close()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Account not found. Please register an account first.",
        )

    if user["password"] != password:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password. Please try again.",
        )

    role = user["role"] if "role" in user.keys() and user["role"] else "user"
    return UserProfile(
        email=user["email"],
        name=user["name"],
        phone=user["phone"],
        city=user["city"],
        member_since=user["member_since"],
        tier=user["tier"],
        role=role,
    )


@router.post("/register", response_model=UserProfile)
def register(payload: RegisterRequest):
    name = payload.name.strip()
    email = payload.email.strip().lower()
    phone = payload.phone.strip() or "+62 812 3456 7890"
    city = payload.city.strip() or "Jakarta, Indonesia"
    password = payload.password.strip()

    if not name or len(name) < 2:
        raise HTTPException(status_code=400, detail="Full name is required.")
    if not email or not re.match(r"^\S+@\S+\.\S+$", email):
        raise HTTPException(
            status_code=400, detail="Please enter a valid email address."
        )
    if not password or len(password) < 4:
        raise HTTPException(
            status_code=400, detail="Password must be at least 4 characters."
        )

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT email FROM users WHERE email = ?", (email,))
    if cur.fetchone():
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Email is already registered. Please sign in to your account.",
        )

    year_now = str(datetime.now().year)
    cur.execute(
        """
        INSERT INTO users (email, name, password, phone, city, member_since, tier, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            email,
            name,
            password,
            phone,
            city,
            year_now,
            "GOLD MEMBER",
            "user",
        ),
    )
    conn.commit()
    cur.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cur.fetchone()
    conn.close()

    return UserProfile(
        email=user["email"],
        name=user["name"],
        phone=user["phone"],
        city=user["city"],
        member_since=user["member_since"],
        tier=user["tier"],
        role=user["role"] or "user",
    )
