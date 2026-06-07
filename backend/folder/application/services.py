from backend.folder.infrastructure.repository import FolderRepository


class FolderService:
    @staticmethod
    def list_for_owner(user):
        return FolderRepository.list_for_owner(user)
