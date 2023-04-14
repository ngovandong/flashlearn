from django.db.models import Manager


class LearningProgressManager(Manager):
    def get_admin_user(self):
        return self.first(is_superuser=True)

    def get_by_email(self, email):
        return self.filter(email=email).first()
    
