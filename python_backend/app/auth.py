"""Persistent JSON file auth - no external dependencies."""

import json
import os
from typing import Dict, Optional
import uuid


class User:
    def __init__(self, id: str, username: str, password_hash: str) -> None:
        self.id = id
        self.username = username
        self.password_hash = password_hash


class Auth:
    def __init__(self, users_file: str = "data/users.json") -> None:
        self.users_file = users_file
        self._users: Dict[str, User] = {}
        self._usernames: Dict[str, User] = {}
        self._load_users()
        # Create a demo user everyone can use if not exists
        if "demo" not in self._usernames:
            self._create_user("demo", "demo")

    def _load_users(self) -> None:
        """Load users from JSON file if it exists."""
        if os.path.exists(self.users_file):
            try:
                with open(self.users_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for user_data in data:
                        user = User(
                            user_data["id"],
                            user_data["username"],
                            user_data["password_hash"]
                        )
                        self._users[user.id] = user
                        self._usernames[user.username] = user
            except (json.JSONDecodeError, IOError):
                pass

    def _save_users(self) -> None:
        """Save users to JSON file."""
        try:
            os.makedirs(os.path.dirname(self.users_file), exist_ok=True)
            data = []
            for user in self._users.values():
                data.append({
                    "id": user.id,
                    "username": user.username,
                    "password_hash": user.password_hash
                })
            with open(self.users_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except IOError:
            pass

    def _create_user(self, username: str, password: str) -> User:
        user_id = str(uuid.uuid4())
        # Simple hash (in production use bcrypt)
        pw_hash = str(hash(f"{username}:{password}"))
        user = User(user_id, username, pw_hash)
        self._users[user_id] = user
        self._usernames[username] = user
        self._save_users()
        return user

    def register(self, username: str, password: str) -> Optional[str]:
        if username in self._usernames:
            return None  # Already exists
        user = self._create_user(username, password)
        self._save_users()
        return user.id

    def login(self, username: str, password: str) -> Optional[str]:
        user = self._usernames.get(username)
        if not user:
            return None
        pw_hash = str(hash(f"{username}:{password}"))
        if user.password_hash == pw_hash:
            return user.id
        return None

    def get_user(self, user_id: str) -> Optional[User]:
        return self._users.get(user_id)


_auth: Optional[Auth] = None


def get_auth() -> Auth:
    global _auth
    if _auth is None:
        _auth = Auth()
    return _auth