import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import hash_password

def create_admin(email, password, full_name):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            print("User already exists")
            user.is_admin = True
            db.commit()
            return
        
        user = User(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            is_active=True,
            is_admin=True,
        )
        db.add(user)
        db.commit()
        print("Admin user created successfully")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin("admin@transcript.ai", "admin123", "Admin User")
