from backend.models import Folder


class FolderRepository:
    @staticmethod
    def list_for_owner(user):
        return Folder.objects.filter(owner=user)

    @staticmethod
    def get_by_id(folder_id):
        return Folder.objects.filter(pk=folder_id).first()
