from fastapi import APIRouter, HTTPException, Query
from database import get_connection
from schemas import UpdateProfileRequest, UserProfile

router = APIRouter(prefix="/api/profile", tags=["Profile"])


@router.get("")
def get_profile_summary(user_email: str = Query(default="demo@aurelia.com")):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email = ?", (user_email.lower(),))
    user = cur.fetchone()

    if not user:
        user_data = {
            "email": user_email,
            "name": "Ahmad Rizky",
            "phone": "+62 812 3456 7890",
            "city": "Jakarta, Indonesia",
            "member_since": "2021",
            "tier": "GOLD MEMBER",
        }
    else:
        user_data = dict(user)
        user_data.pop("password", None)

    cur.execute(
        "SELECT nights, total, status FROM bookings WHERE user_email = ?",
        (user_email.lower(),),
    )
    bookings = cur.fetchall()
    conn.close()

    total_nights = sum(b["nights"] for b in bookings)
    total_spent = sum(b["total"] for b in bookings)
    total_bookings = len(bookings)
    points = total_spent // 100000

    return {
        "user": user_data,
        "stats": {
            "totalNights": total_nights,
            "totalBookings": total_bookings,
            "rewardPoints": points,
            "totalSpent": total_spent,
        },
    }


@router.put("", response_model=UserProfile)
def update_profile(
    payload: UpdateProfileRequest, user_email: str = Query(default="demo@aurelia.com")
):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE users
        SET name = ?, phone = ?, city = ?
        WHERE email = ?
        """,
        (payload.name, payload.phone, payload.city, user_email.lower()),
    )
    conn.commit()
    cur.execute("SELECT * FROM users WHERE email = ?", (user_email.lower(),))
    user = cur.fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    return UserProfile(
        email=user["email"],
        name=user["name"],
        phone=user["phone"],
        city=user["city"],
        member_since=user["member_since"],
        tier=user["tier"],
    )
