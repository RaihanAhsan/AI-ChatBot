from datetime import date, datetime
import random
import string
import time
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from database import get_connection, get_hotel_by_id
from schemas import BookingResponse, CreateBookingRequest

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])


def _row_to_booking_resp(r) -> BookingResponse:
    return BookingResponse(
        id=r["id"],
        code=r["code"],
        userEmail=r["user_email"],
        hotelId=r["hotel_id"],
        hotelName=r["hotel_name"],
        hotelImage=r["hotel_image"],
        hotelLocation=r["hotel_location"],
        roomId=r["room_id"],
        roomName=r["room_name"],
        roomPrice=r["room_price"],
        checkIn=r["check_in"],
        checkOut=r["check_out"],
        nights=r["nights"],
        guests=r["guests"],
        guestName=r["guest_name"],
        guestEmail=r["guest_email"],
        guestPhone=r["guest_phone"],
        guestCountry=r["guest_country"],
        requests=r["requests"] or "",
        paymentMethod=r["payment_method"] or "Credit Card",
        subtotal=r["subtotal"],
        tax=r["tax"],
        service=r["service"],
        total=r["total"],
        status=r["status"],
        createdAt=r["created_at"],
    )


@router.get("", response_model=List[BookingResponse])
def list_bookings(
    user_email: str = Query(default="demo@aurelia.com"),
    status: Optional[str] = Query(default=None),
):
    conn = get_connection()
    cur = conn.cursor()
    if status and status != "all":
        cur.execute(
            "SELECT * FROM bookings WHERE user_email = ? AND status = ? ORDER BY created_at DESC",
            (user_email, status),
        )
    else:
        cur.execute(
            "SELECT * FROM bookings WHERE user_email = ? ORDER BY created_at DESC",
            (user_email,),
        )
    rows = [_row_to_booking_resp(r) for r in cur.fetchall()]
    conn.close()
    return rows


@router.post("", response_model=BookingResponse)
def create_booking(payload: CreateBookingRequest):
    hotel = get_hotel_by_id(payload.hotelId)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    room = next((r for r in hotel["rooms"] if r["id"] == payload.roomId), None)
    if not room:
        raise HTTPException(status_code=404, detail="Room type not found")

    try:
        ci = date.fromisoformat(payload.checkIn)
        co = date.fromisoformat(payload.checkOut)
        nights = (co - ci).days
    except Exception:
        nights = 2

    if nights <= 0:
        raise HTTPException(
            status_code=400, detail="Check-out date must be after check-in date"
        )

    subtotal = room["price"] * nights
    tax = round(subtotal * 0.11)
    service = round(subtotal * 0.05)
    total = subtotal + tax + service

    booking_id = f"b{int(time.time() * 1000)}"
    code = "AUR-" + "".join(
        random.choices(string.ascii_uppercase + string.digits, k=6)
    )
    created_at = datetime.utcnow().isoformat() + "Z"

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO bookings (
            id, code, user_email, hotel_id, hotel_name, hotel_image, hotel_location,
            room_id, room_name, room_price, check_in, check_out, nights, guests,
            guest_name, guest_email, guest_phone, guest_country, requests,
            payment_method, subtotal, tax, service, total, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            booking_id,
            code,
            payload.userEmail.lower(),
            hotel["id"],
            hotel["name"],
            hotel["image"],
            hotel["location"],
            room["id"],
            room["name"],
            room["price"],
            payload.checkIn,
            payload.checkOut,
            nights,
            payload.guests,
            payload.guestName,
            payload.guestEmail,
            payload.guestPhone,
            payload.guestCountry,
            payload.requests,
            payload.paymentMethod,
            subtotal,
            tax,
            service,
            total,
            "upcoming",
            created_at,
        ),
    )
    conn.commit()
    cur.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
    row = cur.fetchone()
    conn.close()
    return _row_to_booking_resp(row)


@router.patch("/{booking_id}/status", response_model=BookingResponse)
def update_booking_status(booking_id: str, status: str = Query(...)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE bookings SET status = ? WHERE id = ?", (status, booking_id))
    conn.commit()
    cur.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    return _row_to_booking_resp(row)
