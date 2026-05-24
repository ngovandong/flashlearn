import logging
from uuid import UUID

logger = logging.getLogger(__name__)


def setup_new_user(
    user_id: UUID | str,
    activation_link: str | None = None,
    *,
    send_welcome_email: bool = False,
) -> None:
    """
    Run all async setup for a newly created user: settings, default deck,
    and the appropriate onboarding email.

    - Email/password sign-up: pass activation_link
    - SSO first login: pass send_welcome_email=True
    """
    from ..models import User
    from ..services import UserService
    from .email import send_active_account_email
    from .email import send_welcome_email as send_welcome_email_task

    user = User.objects.get(pk=user_id)
    UserService.provision_new_user(user)

    if activation_link:
        send_active_account_email(user.name, activation_link, user.email)
    elif send_welcome_email:
        send_welcome_email_task(user.name, user.email)

    logger.info("Setup complete for user %s", user.email)
