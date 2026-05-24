import logging

from django.conf import settings

from ..services import MailService

logger = logging.getLogger(__name__)


def send_active_account_email(name: str, link: str, email: str):
    MailService.send_template_mail_sync(
        to_email=email,
        template="emails/confirm_email.html",
        context_object={"name": name, "link": link},
        subject="Confirm your FlashLearn account",
    )


def send_welcome_email(name: str, email: str):
    MailService.send_template_mail_sync(
        to_email=email,
        template="emails/welcome_email.html",
        context_object={
            "name": name,
            "app_url": settings.BASE_FRONTEND_URL,
        },
        subject="Welcome to FlashLearn!",
    )


def send_daily_reminders():
    """
    Send a reminder to every active user who has daily_reminder = True in their settings.
    Runs daily at 8 AM Vietnam time (UTC+7 → 01:00 UTC).
    Uses the reminder_email setting as the destination; falls back to user.email.
    """
    from ..models import User, UserSetting

    users = User.objects.filter(
        is_active=True,
        settings__key="daily_reminder",
        settings__value=True,
    ).distinct()

    reminder_emails = {s.user_id: s.value for s in UserSetting.objects.filter(user__in=users, key="reminder_email")}

    count = 0
    for user in users:
        to_email = reminder_emails.get(user.pk) or user.email
        try:
            MailService.send_template_mail_sync(
                to_email=to_email,
                template="emails/daily_reminder.html",
                context_object={
                    "name": user.name,
                    "app_url": settings.BASE_FRONTEND_URL,
                    "settings_url": f"{settings.BASE_FRONTEND_URL}/settings",
                },
                subject="Your daily FlashLearn reminder 📚",
            )
            count += 1
        except Exception:
            logger.exception("Failed to send daily reminder to %s", to_email)

    logger.info("Daily reminders sent to %d users", count)
