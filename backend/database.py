import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_PATH = Path(__file__).parent / "aurelia.db"

IMG = lambda photo_id, w=1200: f"https://images.unsplash.com/{photo_id}?auto=format&fit=crop&w={w}&q=80"

INITIAL_HOTELS: List[Dict[str, Any]] = [
    {
        "id": "h1",
        "name": "The Grand Azure",
        "city": "Bali",
        "location": "Nusa Dua, Bali, Indonesia",
        "rating": 4.9,
        "reviews": 1284,
        "stars": 5,
        "price": 2450000,
        "image": IMG("photo-1566073771259-6a8506099945"),
        "gallery": [
            IMG("photo-1582719478250-c89cae4dc85b", 900),
            IMG("photo-1571896349842-33c89424de2d", 900),
            IMG("photo-1520250497591-112f2f40a3f4", 900),
            IMG("photo-1611892440504-42a792e24d32", 900),
        ],
        "description": "Berada di tepi pantai Nusa Dua yang berpasir putih, The Grand Azure menghadirkan 88 suite dan vila pribadi dengan kolam renang infinity menghadap Samudra Hindia. Nikmati spa tradisional Bali, restoran fine dining, dan layanan butler 24 jam yang siap memenuhi setiap kebutuhan Anda.",
        "amenities": [
            "Kolam Infinity",
            "Spa & Wellness",
            "Pantai Privat",
            "Fine Dining",
            "Butler 24/7",
            "Wi-Fi Cepat",
            "Pusat Kebugaran",
            "Antar-Jemput Bandara",
        ],
        "rooms": [
            {
                "id": "r1",
                "name": "Deluxe Ocean View",
                "price": 2450000,
                "size": "52 m²",
                "bed": "King Bed",
                "max": 2,
                "image": IMG("photo-1611892440504-42a792e24d32", 800),
                "perks": ["Sarapan", "Ocean View"],
            },
            {
                "id": "r2",
                "name": "Premier Suite",
                "price": 3900000,
                "size": "78 m²",
                "bed": "King Bed",
                "max": 3,
                "image": IMG("photo-1590490360182-c33d57733427", 800),
                "perks": ["Sarapan", "Lounge Access", "Bathtub"],
            },
            {
                "id": "r3",
                "name": "Private Pool Villa",
                "price": 6800000,
                "size": "140 m²",
                "bed": "2 King Bed",
                "max": 4,
                "image": IMG("photo-1631049307264-da0ec9d70304", 800),
                "perks": ["Sarapan", "Private Pool", "Butler"],
            },
        ],
    },
    {
        "id": "h2",
        "name": "Aurora Sky Palace",
        "city": "Jakarta",
        "location": "Sudirman, Jakarta, Indonesia",
        "rating": 4.8,
        "reviews": 962,
        "stars": 5,
        "price": 1850000,
        "image": IMG("photo-1582719478250-c89cae4dc85b"),
        "gallery": [
            IMG("photo-1566073771259-6a8506099945", 900),
            IMG("photo-1445019980597-93fa8acb246c", 900),
            IMG("photo-1611892440504-42a792e24d32", 900),
            IMG("photo-1590490360182-c33d57733427", 900),
        ],
        "description": "Menara ikonik di jantung Sudirman dengan panorama skyline Jakarta dari lantai 42. Aurora Sky Palace menawarkan kamar dengan jendela floor-to-ceiling, rooftop bar, dan akses langsung ke pusat bisnis SCBD.",
        "amenities": [
            "Rooftop Bar",
            "Kolam Indoor",
            "Business Center",
            "Spa",
            "Restoran",
            "Wi-Fi Cepat",
            "Parkir Valet",
            "Meeting Room",
        ],
        "rooms": [
            {
                "id": "r1",
                "name": "City View Room",
                "price": 1850000,
                "size": "42 m²",
                "bed": "Queen Bed",
                "max": 2,
                "image": IMG("photo-1590490360182-c33d57733427", 800),
                "perks": ["Sarapan", "City View"],
            },
            {
                "id": "r2",
                "name": "Executive Suite",
                "price": 3200000,
                "size": "68 m²",
                "bed": "King Bed",
                "max": 3,
                "image": IMG("photo-1611892440504-42a792e24d32", 800),
                "perks": ["Sarapan", "Lounge Access", "Work Desk"],
            },
        ],
    },
    {
        "id": "h3",
        "name": "Villa Serenity",
        "city": "Ubud",
        "location": "Tegallalang, Ubud, Bali",
        "rating": 4.9,
        "reviews": 743,
        "stars": 5,
        "price": 2100000,
        "image": IMG("photo-1571896349842-33c89424de2d"),
        "gallery": [
            IMG("photo-1520250497591-112f2f40a3f4", 900),
            IMG("photo-1631049307264-da0ec9d70304", 900),
            IMG("photo-1566073771259-6a8506099945", 900),
            IMG("photo-1445019980597-93fa8acb246c", 900),
        ],
        "description": "Tersembunyi di antara sawah terasering Tegallalang, Villa Serenity adalah retret ketenangan dengan 24 vila pribadi. Setiap vila memiliki kolam renang pribadi menghadap lembah hijau dan balkon untuk menikmati matahari terbit.",
        "amenities": [
            "Private Pool",
            "Yoga Pavilion",
            "Organic Restaurant",
            "Spa",
            "Trekking Guide",
            "Wi-Fi",
            "Parkir",
            "Antar-Jemput",
        ],
        "rooms": [
            {
                "id": "r1",
                "name": "Garden Villa",
                "price": 2100000,
                "size": "65 m²",
                "bed": "King Bed",
                "max": 2,
                "image": IMG("photo-1631049307264-da0ec9d70304", 800),
                "perks": ["Sarapan", "Garden View"],
            },
            {
                "id": "r2",
                "name": "Valley Pool Villa",
                "price": 4200000,
                "size": "120 m²",
                "bed": "King Bed",
                "max": 3,
                "image": IMG("photo-1571896349842-33c89424de2d", 800),
                "perks": ["Sarapan", "Private Pool", "Valley View"],
            },
        ],
    },
    {
        "id": "h4",
        "name": "The Marble Crown",
        "city": "Singapore",
        "location": "Marina Bay, Singapore",
        "rating": 4.8,
        "reviews": 2103,
        "stars": 5,
        "price": 3300000,
        "image": IMG("photo-1520250497591-112f2f40a3f4"),
        "gallery": [
            IMG("photo-1566073771259-6a8506099945", 900),
            IMG("photo-1582719478250-c89cae4dc85b", 900),
            IMG("photo-1611892440504-42a792e24d32", 900),
            IMG("photo-1590490360182-c33d57733427", 900),
        ],
        "description": "Ikon Marina Bay dengan arsitektur marmer dan kaca. The Marble Crown menawarkan pemandangan teluk spektakuler, infinity pool di lantai 57, serta koleksi seni kontemporer di seluruh area hotel.",
        "amenities": [
            "Infinity Pool",
            "Sky Bar",
            "Michelin Dining",
            "Spa",
            "Gym 24 Jam",
            "Wi-Fi",
            "Concierge",
            "Business Center",
        ],
        "rooms": [
            {
                "id": "r1",
                "name": "Bay View Room",
                "price": 3300000,
                "size": "48 m²",
                "bed": "King Bed",
                "max": 2,
                "image": IMG("photo-1590490360182-c33d57733427", 800),
                "perks": ["Sarapan", "Bay View"],
            },
            {
                "id": "r2",
                "name": "Skyline Suite",
                "price": 5600000,
                "size": "85 m²",
                "bed": "King Bed",
                "max": 3,
                "image": IMG("photo-1611892440504-42a792e24d32", 800),
                "perks": ["Sarapan", "Skyline View", "Club Access"],
            },
        ],
    },
    {
        "id": "h5",
        "name": "Lumière Riviera",
        "city": "Maldives",
        "location": "North Malé Atoll, Maldives",
        "rating": 5.0,
        "reviews": 512,
        "stars": 5,
        "price": 7800000,
        "image": IMG("photo-1590523277543-a94d2e4eb00b"),
        "gallery": [
            IMG("photo-1571896349842-33c89424de2d", 900),
            IMG("photo-1445019980597-93fa8acb246c", 900),
            IMG("photo-1631049307264-da0ec9d70304", 900),
            IMG("photo-1566073771259-6a8506099945", 900),
        ],
        "description": "Resor overwater paling ikonik di Maladewa. 42 vila di atas laguna kristal dengan kaca lantai, dek pribadi, dan akses langsung ke terumbu karang. Termasuk seaplane transfer dan private chef.",
        "amenities": [
            "Overwater Villa",
            "Private Chef",
            "House Reef",
            "Seaplane Transfer",
            "Spa Overwater",
            "Diving Center",
            "Wi-Fi",
            "All-Inclusive",
        ],
        "rooms": [
            {
                "id": "r1",
                "name": "Overwater Villa",
                "price": 7800000,
                "size": "110 m²",
                "bed": "King Bed",
                "max": 2,
                "image": IMG("photo-1590523277543-a94d2e4eb00b", 800),
                "perks": ["All-Inclusive", "Ocean Deck", "Snorkeling"],
            },
            {
                "id": "r2",
                "name": "Sunset Grand Villa",
                "price": 12500000,
                "size": "180 m²",
                "bed": "King Bed",
                "max": 4,
                "image": IMG("photo-1571896349842-33c89424de2d", 800),
                "perks": ["All-Inclusive", "Private Pool", "Butler", "Sunset View"],
            },
        ],
    },
    {
        "id": "h6",
        "name": "Obsidian Heights",
        "city": "Dubai",
        "location": "Downtown, Dubai, UAE",
        "rating": 4.9,
        "reviews": 1876,
        "stars": 5,
        "price": 4500000,
        "image": IMG("photo-1512453979798-5ea266f8880c"),
        "gallery": [
            IMG("photo-1566073771259-6a8506099945", 900),
            IMG("photo-1582719478250-c89cae4dc85b", 900),
            IMG("photo-1611892440504-42a792e24d32", 900),
            IMG("photo-1520250497591-112f2f40a3f4", 900),
        ],
        "description": "Menghadap Burj Khalifa, Obsidian Heights adalah mahakarya arsitektur modern Dubai. Nikmati rooftop infinity pool, lounge eksklusif, dan koleksi restoran dari chef bintang Michelin.",
        "amenities": [
            "Rooftop Pool",
            "Burj View",
            "Michelin Dining",
            "Spa",
            "Luxury Shopping",
            "Wi-Fi",
            "Valet",
            "Kids Club",
        ],
        "rooms": [
            {
                "id": "r1",
                "name": "Burj View Room",
                "price": 4500000,
                "size": "55 m²",
                "bed": "King Bed",
                "max": 2,
                "image": IMG("photo-1611892440504-42a792e24d32", 800),
                "perks": ["Sarapan", "Burj View"],
            },
            {
                "id": "r2",
                "name": "Royal Suite",
                "price": 8900000,
                "size": "130 m²",
                "bed": "King Bed",
                "max": 4,
                "image": IMG("photo-1590490360182-c33d57733427", 800),
                "perks": ["Sarapan", "Lounge Access", "Butler", "Panoramic"],
            },
        ],
    },
]


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            password TEXT NOT NULL,
            phone TEXT DEFAULT '+62 812 3456 7890',
            city TEXT DEFAULT 'Jakarta, Indonesia',
            member_since TEXT DEFAULT '2021',
            tier TEXT DEFAULT 'GOLD MEMBER',
            role TEXT DEFAULT 'user'
        )
        """
    )

    # Ensure 'role' column exists if upgrading from older table
    cur.execute("PRAGMA table_info(users)")
    cols = [r["name"] for r in cur.fetchall()]
    if "role" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS hotels (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            city TEXT NOT NULL,
            location TEXT NOT NULL,
            rating REAL NOT NULL,
            reviews INTEGER NOT NULL,
            stars INTEGER NOT NULL,
            price INTEGER NOT NULL,
            image TEXT NOT NULL,
            gallery_json TEXT NOT NULL,
            description TEXT NOT NULL,
            amenities_json TEXT NOT NULL,
            rooms_json TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS bookings (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            user_email TEXT NOT NULL,
            hotel_id TEXT NOT NULL,
            hotel_name TEXT NOT NULL,
            hotel_image TEXT NOT NULL,
            hotel_location TEXT NOT NULL,
            room_id TEXT NOT NULL,
            room_name TEXT NOT NULL,
            room_price INTEGER NOT NULL,
            check_in TEXT NOT NULL,
            check_out TEXT NOT NULL,
            nights INTEGER NOT NULL,
            guests INTEGER NOT NULL,
            guest_name TEXT NOT NULL,
            guest_email TEXT NOT NULL,
            guest_phone TEXT NOT NULL,
            guest_country TEXT NOT NULL,
            requests TEXT DEFAULT '',
            payment_method TEXT DEFAULT 'Kartu Kredit',
            subtotal INTEGER NOT NULL,
            tax INTEGER NOT NULL,
            service INTEGER NOT NULL,
            total INTEGER NOT NULL,
            status TEXT DEFAULT 'upcoming',
            created_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS wishlists (
            user_email TEXT NOT NULL,
            hotel_id TEXT NOT NULL,
            PRIMARY KEY (user_email, hotel_id)
        )
        """
    )

    # Seed Demo User (role = 'user')
    cur.execute("SELECT email FROM users WHERE email = ?", ("demo@aurelia.com",))
    if not cur.fetchone():
        cur.execute(
            """
            INSERT INTO users (email, name, password, phone, city, member_since, tier, role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "demo@aurelia.com",
                "Ahmad Rizky",
                "123456",
                "+62 812 3456 7890",
                "Jakarta, Indonesia",
                "2021",
                "GOLD MEMBER",
                "user",
            ),
        )
    else:
        cur.execute("UPDATE users SET role = 'user' WHERE email = 'demo@aurelia.com' AND (role IS NULL OR role = '')")

    # Seed Admin User (role = 'admin')
    cur.execute("SELECT email FROM users WHERE email = ?", ("admin@aurelia.com",))
    if not cur.fetchone():
        cur.execute(
            """
            INSERT INTO users (email, name, password, phone, city, member_since, tier, role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "admin@aurelia.com",
                "Admin Aurelia",
                "admin123",
                "+62 21 5000 8888",
                "Jakarta, Indonesia",
                "1998",
                "SYSTEM ADMIN",
                "admin",
            ),
        )
    else:
        cur.execute("UPDATE users SET role = 'admin' WHERE email = 'admin@aurelia.com'")

    # Seed Hotels
    cur.execute("SELECT COUNT(*) as cnt FROM hotels")
    if cur.fetchone()["cnt"] == 0:
        for h in INITIAL_HOTELS:
            cur.execute(
                """
                INSERT INTO hotels (
                    id, name, city, location, rating, reviews, stars, price,
                    image, gallery_json, description, amenities_json, rooms_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    h["id"],
                    h["name"],
                    h["city"],
                    h["location"],
                    h["rating"],
                    h["reviews"],
                    h["stars"],
                    h["price"],
                    h["image"],
                    json.dumps(h["gallery"]),
                    h["description"],
                    json.dumps(h["amenities"]),
                    json.dumps(h["rooms"]),
                ),
            )

    conn.commit()
    conn.close()


def row_to_hotel(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "city": row["city"],
        "location": row["location"],
        "rating": row["rating"],
        "reviews": row["reviews"],
        "stars": row["stars"],
        "price": row["price"],
        "image": row["image"],
        "gallery": json.loads(row["gallery_json"]),
        "description": row["description"],
        "amenities": json.loads(row["amenities_json"]),
        "rooms": json.loads(row["rooms_json"]),
    }


def get_all_hotels(city: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM hotels")
    rows = [row_to_hotel(r) for r in cur.fetchall()]
    conn.close()

    if city and city.strip():
        c = city.strip().lower()
        rows = [
            h
            for h in rows
            if h["city"].lower() == c or c in h["location"].lower()
        ]
    if search and search.strip():
        q = search.strip().lower()
        rows = [
            h
            for h in rows
            if q in h["name"].lower()
            or q in h["city"].lower()
            or q in h["location"].lower()
            or q in h["description"].lower()
        ]
    return rows


def get_hotel_by_id(hotel_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM hotels WHERE id = ?", (hotel_id,))
    row = cur.fetchone()
    conn.close()
    return row_to_hotel(row) if row else None


def get_user_bookings_db(user_email: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM bookings WHERE user_email = ? ORDER BY created_at DESC",
        (user_email,),
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows
