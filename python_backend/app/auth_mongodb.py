"""MongoDB Atlas authentication for VeriFrame."""

import os
from typing import Dict, Optional
import uuid
import hashlib
from datetime import datetime
from .mongodb import get_mongodb

class MongoDBAuth:
    """Authentication system using MongoDB Atlas."""
    
    def __init__(self):
        self.mongodb = None
    
    async def initialize(self) -> bool:
        """Initialize MongoDB connection."""
        try:
            self.mongodb = await get_mongodb()
            return self.mongodb.connected if self.mongodb else False
        except Exception as e:
            # Removed verbose logging
            return False
    
    def _hash_password(self, username: str, password: str) -> str:
        """Hash password with username salt."""
        # In production, use bcrypt or Argon2
        salt = f"{username}:{password}"
        return hashlib.sha256(salt.encode()).hexdigest()
    
    async def register(self, username: str, password: str, email: Optional[str] = None) -> Optional[str]:
        """Register a new user."""
        if not self.mongodb or not self.mongodb.connected:
            return None
        
        try:
            # Check if user already exists
            existing_user = await self.mongodb.get_user_by_username(username)
            if existing_user:
                return None  # Username already taken
            
            # Check if email already exists (if provided)
            if email:
                existing_email = await self.mongodb.database.users.find_one({"email": email})
                if existing_email:
                    return None  # Email already taken
            
            # Create new user
            password_hash = self._hash_password(username, password)
            user_id = await self.mongodb.create_user(username, email, password_hash)
            
            return user_id
            
        except Exception as e:
            # Removed verbose logging
            return None
    
    async def login(self, username: str, password: str) -> Optional[str]:
        """Authenticate user login."""
        if not self.mongodb or not self.mongodb.connected:
            return None
        
        try:
            # Get user from database
            user = await self.mongodb.get_user_by_username(username)
            if not user:
                return None
            
            # Verify password
            password_hash = self._hash_password(username, password)
            if user.get("password_hash") != password_hash:
                return None
            
            # Check if user is active
            if not user.get("is_active", True):
                return None
            
            return user["_id"]
            
        except Exception as e:
            # Removed verbose logging
            return None
    
    async def get_user(self, user_id: str) -> Optional[Dict]:
        """Get user by ID."""
        if not self.mongodb or not self.mongodb.connected:
            return None
        
        try:
            user = await self.mongodb.get_user_by_id(user_id)
            if user and user.get("is_active", True):
                # Remove sensitive data
                return {
                    "id": user["_id"],
                    "username": user["username"],
                    "email": user.get("email"),
                    "created_at": user.get("created_at"),
                    "is_active": user.get("is_active", True)
                }
            return None
        except Exception as e:
            # Removed verbose logging
            return None
    
    async def update_user(self, user_id: str, updates: Dict) -> bool:
        """Update user information."""
        if not self.mongodb or not self.mongodb.connected:
            return False
        
        try:
            updates["updated_at"] = datetime.utcnow()
            result = await self.mongodb.database.users.update_one(
                {"_id": user_id},
                {"$set": updates}
            )
            return result.modified_count > 0
        except Exception as e:
            # Removed verbose logging
            return False
    
    async def change_password(self, user_id: str, old_password: str, new_password: str) -> bool:
        """Change user password."""
        if not self.mongodb or not self.mongodb.connected:
            return False
        
        try:
            # Get current user
            user = await self.mongodb.get_user_by_id(user_id)
            if not user:
                return False
            
            # Verify old password
            username = user["username"]
            old_hash = self._hash_password(username, old_password)
            if user.get("password_hash") != old_hash:
                return False
            
            # Update password
            new_hash = self._hash_password(username, new_password)
            return await self.update_user(user_id, {"password_hash": new_hash})
            
        except Exception as e:
            # Removed verbose logging
            return False
    
    async def create_demo_user(self) -> None:
        """Create demo user if it doesn't exist."""
        if not self.mongodb or not self.mongodb.connected:
            return
        
        try:
            existing_demo = await self.mongodb.get_user_by_username("demo")
            if not existing_demo:
                # Create demo user
                user_id = await self.register("demo", "demo", "demo@veriframe.com")
                if user_id:
                    # Removed verbose logging
                    pass
                else:
                    # Removed verbose logging
                    pass
        except Exception as e:
            # Removed verbose logging
            pass

# Global auth instance
_auth: Optional[MongoDBAuth] = None

async def get_mongodb_auth() -> MongoDBAuth:
    """Get or create MongoDB auth instance."""
    global _auth
    if _auth is None:
        _auth = MongoDBAuth()
        await _auth.initialize()
        # Create demo user
        await _auth.create_demo_user()
    return _auth

async def close_mongodb_auth() -> None:
    """Close MongoDB auth connection."""
    global _auth
    if _auth:
        _auth.mongodb = None
        _auth = None
