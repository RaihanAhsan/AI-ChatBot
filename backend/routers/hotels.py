from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from database import get_all_hotels, get_connection, get_hotel_by_id
from schemas import HotelSchema

router = APIRouter(prefix="/api/hotels", tags=["Hotels"])


@router.get("", response_model=List[HotelSchema])
def list_hotels(
    city: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
):
    return get_all_hotels(city=city, search=search)


@router.get("/{hotel_id}", response_model=HotelSchema)
def get_hotel(hotel_id: str):
    hotel = get_hotel_by_id(hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel tidak ditemukan")
    return hotel


@router.get("/wishlist/{user_email}")
def get_wishlist(user_email: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT hotel_id FROM wishlists WHERE user_email = ?", (user_email,))
    ids = [r["hotel_id"] for r in cur.fetchall()]
    conn.close()
    return {"hotelIds": ids}


@router.post("/wishlist/{user_email}/{hotel_id}")
def toggle_wishlist(user_email: str, hotel_id: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT 1 FROM wishlists WHERE user_email = ? AND hotel_id = ?",
        (user_email, hotel_id),
    )
    exists = cur.fetchone()
    if exists:
        cur.execute(
            "DELETE FROM wishlists WHERE user_email = ? AND hotel_id = ?",
            (user_email, hotel_id),
        )
        added = False
    else:
        cur.execute(
            "INSERT INTO wishlists (user_email, hotel_id) VALUES (?, ?)",
            (user_email, hotel_id),
        )
        added = True
    conn.commit()
    conn.close()
    return {"added": added, "hotelId": hotel_id}
