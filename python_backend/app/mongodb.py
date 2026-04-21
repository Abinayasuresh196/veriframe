"""MongoDB Atlas integration for VeriFrame."""

import os
from typing import Dict, List, Optional, Any
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from datetime import datetime
import uuid
from .config import settings

class MongoDBManager:
    """MongoDB Atlas connection and operations manager."""
    
    def __init__(self) -> None:
        self.client: Optional[AsyncIOMotorClient] = None
        self.database = None
        self.connected = False
        
        # MongoDB Atlas configuration from centralized settings
        self.connection_string = settings.mongodb_connection_string
        self.database_name = settings.mongodb_database_name
        
    async def connect(self) -> bool:
        """Connect to MongoDB Atlas."""
        try:
            if not self.connection_string:
                print(f"ERROR: MongoDB connection string is empty or None. Settings loaded: {settings.mongodb_connection_string is not None}")
                return False
                
            # Removed verbose logging
            
            self.client = AsyncIOMotorClient(
                self.connection_string,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
                retryWrites=True,
                w="majority"
            )
            
            # Test the connection
            await self.client.admin.command('ping')
            
            self.database = self.client[self.database_name]
            self.connected = True
            # Removed verbose logging
            
            # Create indexes for better performance
            await self._create_indexes()
            
            return True
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            print(f"Failed to connect to MongoDB Atlas: {e}")
            return False
        except Exception as e:
            print(f"Unexpected error connecting to MongoDB: {e}")
            return False
    
    async def disconnect(self) -> None:
        """Disconnect from MongoDB Atlas."""
        if self.client:
            self.client.close()
            self.connected = False
            # Removed verbose logging
    
    async def _create_indexes(self) -> None:
        """Create necessary indexes for collections."""
        try:
            # Users collection indexes
            await self.database.users.create_index("username", unique=True)
            await self.database.users.create_index("email", unique=True, sparse=True)
            await self.database.users.create_index("created_at")
            
            # Analyses collection indexes
            await self.database.analyses.create_index("id", unique=True)
            await self.database.analyses.create_index("owner")
            await self.database.analyses.create_index("owner_id")
            await self.database.analyses.create_index("uploadTimestamp")
            await self.database.analyses.create_index([("owner_id", 1), ("uploadTimestamp", -1)])
            
            # Share tokens collection indexes
            await self.database.share_tokens.create_index("token", unique=True)
            await self.database.share_tokens.create_index("analysis_id")
            await self.database.share_tokens.create_index("created_at")
            
            # Removed verbose logging
            pass
        
        except Exception as e:
            # Removed verbose logging
            pass
    
    # User operations
    async def create_user(self, username: str, email: Optional[str] = None, password_hash: str = None) -> Optional[str]:
        """Create a new user in MongoDB."""
        try:
            user_doc = {
                "_id": str(uuid.uuid4()),
                "username": username,
                "email": email,
                "password_hash": password_hash,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "is_active": True
            }
            
            result = await self.database.users.insert_one(user_doc)
            return str(result.inserted_id)
            
        except Exception as e:
            # Removed verbose logging
            return None
    
    async def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Get user by username."""
        try:
            user = await self.database.users.find_one({"username": username})
            return user
        except Exception as e:
            # Removed verbose logging
            return None
    
    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID."""
        try:
            user = await self.database.users.find_one({"_id": user_id})
            return user
        except Exception as e:
            # Removed verbose logging
            return None
    
    # Analysis operations
    async def create_analysis(self, analysis_data: Dict[str, Any]) -> Optional[str]:
        """Create a new analysis record."""
        try:
            result = await self.database.analyses.insert_one(analysis_data)
            return str(result.inserted_id)
        except Exception as e:
            # Removed verbose logging
            return None
    
    async def get_analysis_by_id(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Get analysis by ID."""
        try:
            analysis = await self.database.analyses.find_one({"id": analysis_id})
            return analysis
        except Exception as e:
            # Removed verbose logging
            return None
    
    async def get_user_analyses(self, user_id: str, limit: int = 50, skip: int = 0) -> List[Dict[str, Any]]:
        """Get user's analysis history."""
        try:
            # Query by either old field (Principal in owner) or new field (Principal in owner_id)
            cursor = self.database.analyses.find(
                {"$or": [{"owner": user_id}, {"owner_id": user_id}]}
            ).sort("uploadTimestamp", -1).skip(skip).limit(limit)
            
            analyses = []
            async for analysis in cursor:
                analyses.append(analysis)
            
            return analyses
        except Exception as e:
            # Removed verbose logging
            return []
    
    async def delete_analysis(self, analysis_id: str, user_id: str) -> bool:
        """Delete an analysis record."""
        try:
            print(f"[MongoDB] Attempting to delete analysis {analysis_id} for user {user_id}")
            
            # Check if analysis exists first
            existing = await self.database.analyses.find_one({"id": analysis_id})
            if existing:
                print(f"[MongoDB] Found analysis to delete: {analysis_id}, owner: {existing.get('owner_id')}")
            else:
                print(f"[MongoDB] Analysis {analysis_id} not found")
                return False
            
            result = await self.database.analyses.delete_one({
                "id": analysis_id,
                "owner_id": user_id
            })
            
            print(f"[MongoDB] Deleted {result.deleted_count} documents")
            
            # Also delete associated share tokens
            await self.database.share_tokens.delete_many({"analysis_id": analysis_id})
            
            return result.deleted_count > 0
        except Exception as e:
            print(f"[MongoDB] Delete error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    # Share token operations
    async def create_share_token(self, token: str, analysis_id: str) -> bool:
        """Create a share token."""
        try:
            token_doc = {
                "token": token,
                "analysis_id": analysis_id,
                "created_at": datetime.utcnow(),
                "expires_at": None  # No expiration for now
            }
            
            await self.database.share_tokens.insert_one(token_doc)
            return True
        except Exception as e:
            # Removed verbose logging
            return False
    
    async def get_analysis_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Get analysis by share token."""
        try:
            # First get the analysis_id from the token
            token_doc = await self.database.share_tokens.find_one({"token": token})
            if not token_doc:
                return None
            
            # Then get the analysis
            analysis = await self.database.analyses.find_one({"id": token_doc["analysis_id"]})
            return analysis
        except Exception as e:
            # Removed verbose logging
            return None
    
    # Statistics
    async def get_user_count(self) -> int:
        """Get total number of users."""
        try:
            return await self.database.users.count_documents({})
        except Exception as e:
            # Removed verbose logging
            return 0
    
    async def get_analysis_count(self) -> int:
        """Get total number of analyses."""
        try:
            return await self.database.analyses.count_documents({})
        except Exception as e:
            # Removed verbose logging
            return 0

# Global MongoDB instance
_mongodb: Optional[MongoDBManager] = None

async def get_mongodb() -> MongoDBManager:
    """Get or create MongoDB instance."""
    global _mongodb
    if _mongodb is None:
        _mongodb = MongoDBManager()
        await _mongodb.connect()
    return _mongodb

async def close_mongodb() -> None:
    """Close MongoDB connection."""
    global _mongodb
    if _mongodb:
        await _mongodb.disconnect()
        _mongodb = None
