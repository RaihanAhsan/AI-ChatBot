from typing import List, Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    phone: str = "+62 812 3456 7890"
    city: str = "Jakarta, Indonesia"
    password: str


class UserProfile(BaseModel):
    email: str
    name: str
    phone: str = "+62 812 3456 7890"
    city: str = "Jakarta, Indonesia"
    member_since: str = "2025"
    tier: str = "GOLD MEMBER"
    role: str = "user"


class UpdateProfileRequest(BaseModel):
    name: str
    phone: str
    city: str


class RoomSchema(BaseModel):
    id: str
    name: str
    price: int
    size: str
    bed: str
    max: int
    image: str
    perks: List[str]


class HotelSchema(BaseModel):
    id: str
    name: str
    city: str
    location: str
    rating: float
    reviews: int
    stars: int
    price: int
    image: str
    gallery: List[str]
    description: str
    amenities: List[str]
    rooms: List[RoomSchema]


class CreateBookingRequest(BaseModel):
    userEmail: str = "demo@aurelia.com"
    hotelId: str
    roomId: str
    checkIn: str
    checkOut: str
    guests: int = 2
    guestName: str
    guestEmail: str
    guestPhone: str
    guestCountry: str = "Indonesia"
    requests: str = ""
    paymentMethod: str = "Kartu Kredit"


class BookingResponse(BaseModel):
    id: str
    code: str
    userEmail: str
    hotelId: str
    hotelName: str
    hotelImage: str
    hotelLocation: str
    roomId: str
    roomName: str
    roomPrice: int
    checkIn: str
    checkOut: str
    nights: int
    guests: int
    guestName: str
    guestEmail: str
    guestPhone: str
    guestCountry: str
    requests: str
    paymentMethod: str
    subtotal: int
    tax: int
    service: int
    total: int
    status: str
    createdAt: str
