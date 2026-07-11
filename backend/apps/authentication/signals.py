"""
Django signals for the authentication module.

Signals are connected in AuthenticationConfig.ready() (apps.py).
They handle side-effects (email dispatch, audit logging) that should happen
automatically when model events occur, keeping the model layer clean.
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def send_registration_verification(sender, instance, created, **kwargs):
    """
    After a new User is created, send a verification email.

    This signal fires for every User.save() call, so we gate it on `created`
    (new row) AND only when verification_token is not already set (e.g. admin-
    created users who are pre-verified shouldn't get the email).
    """
    if not created:
        return
    # Skip for admin-created pre-verified users (is_verified=True on creation)
    if instance.is_verified:
        return

    from .services import AuthService
    try:
        AuthService.send_verification_email(instance)
        logger.info('Verification email dispatched for new user: %s', instance.email)
    except Exception as exc:
        # Signal failures must not break registration
        logger.error(
            'Signal: failed to send verification email to %s: %s',
            instance.email, str(exc)
        )


def connect_signals():
    """
    Explicitly connect signals. Called from AuthenticationConfig.ready().
    Using explicit connection (instead of @receiver decorator) avoids double-
    registration when Django's app registry is reloaded in tests.
    """
    from .models import User
    post_save.connect(
        send_registration_verification,
        sender=User,
        dispatch_uid='auth_send_registration_verification',
    )
    logger.debug('Authentication signals connected.')
