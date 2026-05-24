from django.db import migrations


def seed_user_settings(apps, schema_editor):
    User = apps.get_model("backend", "User")
    UserSetting = apps.get_model("backend", "UserSetting")
    for user in User.objects.filter(is_active=True):
        UserSetting.objects.get_or_create(user=user, key="reminder_email", defaults={"value": user.email})
        UserSetting.objects.get_or_create(user=user, key="daily_reminder", defaults={"value": False})


class Migration(migrations.Migration):
    dependencies = [
        ("backend", "0033_add_user_setting"),
    ]

    operations = [
        migrations.RunPython(seed_user_settings, migrations.RunPython.noop),
    ]
