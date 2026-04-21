"""Persistent JSON file storage - no MongoDB required."""

import json
import os
from pathlib import Path
from typing import Any, Dict, List
from uuid import uuid4


class InMemoryCollection:
    """Persistent JSON file collection."""

    def __init__(self, file_path: str) -> None:
        self.file_path = file_path
        self._data: Dict[str, Dict[str, Any]] = self._load_data()

    def _load_data(self) -> Dict[str, Dict[str, Any]]:
        """Load data from JSON file if it exists."""
        if os.path.exists(self.file_path):
            try:
                with open(self.file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return {}
        return {}

    def _save_data(self) -> None:
        """Save data to JSON file."""
        try:
            os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
            with open(self.file_path, 'w', encoding='utf-8') as f:
                json.dump(self._data, f, indent=2, ensure_ascii=False)
        except IOError:
            pass  # Silently fail if unable to save

    async def find_one(
        self,
        query: Dict[str, Any],
        projection: Dict[str, int] | None = None,
    ) -> Dict[str, Any] | None:
        for item in self._data.values():
            if all(item.get(k) == v for k, v in query.items()):
                if projection:
                    # Handle projection like {"_id": 0} to exclude _id
                    if "_id" in projection and projection["_id"] == 0:
                        return {k: item.get(k) for k in item.keys() if k != "_id"}
                    else:
                        return {k: item.get(k) for k in projection.keys() if k != "_id"}
                return item.copy()
        return None

    async def insert_one(self, document: Dict[str, Any]) -> None:
        doc_id = str(uuid4())
        self._data[doc_id] = {"_id": doc_id, **document}
        self._save_data()

    async def delete_one(self, query: Dict[str, Any]) -> None:
        for doc_id, item in list(self._data.items()):
            if all(item.get(k) == v for k, v in query.items()):
                del self._data[doc_id]
                self._save_data()
                return

    async def find(
        self,
        query: Dict[str, Any],
        projection: Dict[str, int] | None = None,
    ) -> "InMemoryCursor":
        results = []
        for item in self._data.values():
            if all(item.get(k) == v for k, v in query.items()):
                if projection:
                    # Handle projection like {"_id": 0} to exclude _id
                    if "_id" in projection and projection["_id"] == 0:
                        results.append({k: item.get(k) for k in item.keys() if k != "_id"})
                    else:
                        results.append({k: item.get(k) for k in item.keys() if k in projection})
                else:
                    results.append(item.copy())
        return InMemoryCursor(results)

    async def update_one(
        self,
        query: Dict[str, Any],
        update: Dict[str, Any],
        upsert: bool = False,
    ) -> None:
        existing = await self.find_one(query)
        if existing:
            for key, value in query.items():
                if key == "$push":
                    for field, item in value.items():
                        if field not in existing:
                            existing[field] = []
                        if isinstance(item, dict):
                            existing[field].append(item)
                        else:
                            existing[field].append(item)
                elif key == "$pull":
                    for field, item in value.items():
                        if field in existing and isinstance(existing[field], list):
                            existing[field] = [
                                x for x in existing[field] if x != item
                            ]
            for doc_id, item in self._data.items():
                if item == existing:
                    self._data[doc_id].update(existing)
                    self._save_data()
        elif upsert:
            new_doc = {**query, **(update.get("$set", {}) if "$set" in update else query)}
            await self.insert_one(new_doc)

    async def update_many(
        self,
        query: Dict[str, Any],
        update: Dict[str, Any],
        upsert: bool = False,
    ) -> None:
        await self.update_one(query, update, upsert)

    async def delete_many(self, query: Dict[str, Any]) -> None:
        for doc_id, item in list(self._data.items()):
            if all(item.get(k) == v for k, v in query.items()):
                del self._data[doc_id]
        self._save_data()

    async def count_documents(self, query: Dict[str, Any]) -> int:
        count = 0
        for item in self._data.values():
            if all(item.get(k) == v for k, v in query.items()):
                count += 1
        return count


class InMemoryCursor:
    def __init__(self, results: List[Dict[str, Any]]) -> None:
        self._results = results
        self._sort_key: str | None = None
        self._reverse = False

    def sort(self, key: str, direction: int) -> "InMemoryCursor":
        self._sort_key = key
        self._reverse = direction == -1
        return self

    def __aiter__(self):
        return self

    def __anext__(self) -> Dict[str, Any]:
        if not hasattr(self, "_idx"):
            if self._sort_key is not None:
                self._results.sort(
                    key=lambda x: x.get(self._sort_key, 0), reverse=self._reverse
                )
            self._idx = 0
        if self._idx >= len(self._results):
            raise StopAsyncIteration
        result = self._results[self._idx]
        self._idx += 1
        return result

    async def to_list(self) -> List[Dict[str, Any]]:
        if self._sort_key is not None:
            self._results.sort(
                key=lambda x: x.get(self._sort_key, 0), reverse=self._reverse
            )
        return self._results


class InMemoryDatabase(Dict[str, Any]):
    """Persistent JSON file database."""

    def __init__(self, data_dir: str = "data") -> None:
        super().__init__()
        self["analyses"] = InMemoryCollection(f"{data_dir}/analyses.json")
        self["user_index"] = InMemoryCollection(f"{data_dir}/user_index.json")
        self["share_tokens"] = InMemoryCollection(f"{data_dir}/share_tokens.json")

    def __getitem__(self, key: str) -> InMemoryCollection:
        return super().__getitem__(key)


_db: InMemoryDatabase | None = None


def get_db() -> InMemoryDatabase:
    global _db
    if _db is None:
        _db = InMemoryDatabase()
    return _db


async def connect_db() -> None:
    global _db
    if _db is None:
        _db = InMemoryDatabase()


async def close_db() -> None:
    global _db
    _db = None