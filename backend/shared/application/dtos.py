from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class DeckRef:
    id: str
    name: str


@dataclass(frozen=True)
class ReviseTermRow:
    id: str
    name: str
    description: str
    image: str
    learning_progress_id: str | None = None

    @classmethod
    def from_mapping(cls, row: dict[str, Any] | Any) -> "ReviseTermRow":
        if hasattr(row, "__dict__") and not isinstance(row, dict):
            row = vars(row)
        return cls(
            id=str(row["id"]),
            name=row["name"],
            description=row.get("description", ""),
            image=row.get("image", ""),
            learning_progress_id=str(row["learning_progress_id"]) if row.get("learning_progress_id") else None,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "image": self.image,
            "learning_progress_id": self.learning_progress_id,
        }
