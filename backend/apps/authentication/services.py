"""
Business-logic service layer for the authentication module.

Keeps views thin by encapsulating email sending, token generation, and
audit logging in one place. All methods are class-level so no instantiation
is needed.
"""
import uuid
import logging
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)


class AuthService:
    """Central service for authentication business logic."""

    # ------------------------------------------------------------------
    # JWT token helpers
    # ------------------------------------------------------------------

    @staticmethod
    def generate_tokens(user) -> dict:
        """
        Generate a fresh access + refresh JWT pair for the given user.
        Returns a dict with 'access' and 'refresh' string tokens.
        """
        refresh = RefreshToken.for_user(user)
        # Embed custom claims to match the existing CustomTokenObtainPairSerializer
        refresh['name'] = user.name
        refresh['email'] = user.email
        refresh['role'] = user.role
        refresh['depot_id'] = str(user.depot_id) if user.depot_id else None
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }

    @staticmethod
    def blacklist_user_tokens(refresh_token_str: str) -> bool:
        """
        Blacklist a specific refresh token.
        Returns True on success, False if the token was invalid.
        """
        from rest_framework_simplejwt.exceptions import TokenError
        try:
            token = RefreshToken(refresh_token_str)
            token.blacklist()
            return True
        except TokenError:
            return False

    # ------------------------------------------------------------------
    # Email verification
    # ------------------------------------------------------------------

    @staticmethod
    def generate_verification_token(user) -> str:
        """
        Create and persist a new email verification token on the user.
        Token expires in 24 hours.
        Returns the raw token string.
        """
        token = str(uuid.uuid4())
        user.verification_token = token
        user.verification_token_expires = timezone.now() + timezone.timedelta(hours=24)
        user.save(update_fields=['verification_token', 'verification_token_expires'])
        return token

    @staticmethod
    def send_verification_email(user, request=None) -> bool:
        """
        Send an email verification link to the user.
        Returns True if the mail was dispatched without error, False otherwise.
        """
        token = AuthService.generate_verification_token(user)
        verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"

        subject = 'Verify Your Email — Smart Transport Solution'
        message = (
            f'Hello {user.name},\n\n'
            f'Thank you for registering with Smart Transport Solution.\n\n'
            f'Please verify your email address by clicking the link below:\n'
            f'{verify_url}\n\n'
            f'This link will expire in 24 hours.\n\n'
            f'If you did not create this account, please ignore this email.\n\n'
            f'— Smart Transport Solution Team'
        )

        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
            return True
        except Exception as exc:
            logger.error(
                'Failed to send verification email to %s: %s',
                user.email, str(exc)
            )
            return False

    @staticmethod
    def send_welcome_email(user) -> bool:
        """
        Send a welcome email after the user successfully verifies their email.
        """
        subject = 'Welcome to Smart Transport Solution!'
        message = (
            f'Hello {user.name},\n\n'
            f'Your email has been verified successfully.\n\n'
            f'You can now log in and start using Smart Transport Solution.\n\n'
            f'Visit: {settings.FRONTEND_URL}\n\n'
            f'— Smart Transport Solution Team'
        )
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
            return True
        except Exception as exc:
            logger.error(
                'Failed to send welcome email to %s: %s',
                user.email, str(exc)
            )
            return False

    # ------------------------------------------------------------------
    # Audit logging
    # ------------------------------------------------------------------

    @staticmethod
    def log_audit(user, action: str, request=None, metadata: dict = None) -> None:
        """
        Write an audit log entry for a security-sensitive event.

        Args:
            user:     The User instance (can be None for anonymous events).
            action:   One of the AuditLog.ACTION_CHOICES strings.
            request:  The DRF Request object (used for IP and User-Agent).
            metadata: Optional dict of extra context to store.
        """
        from .models import AuditLog

        ip_address = None
        user_agent = ''

        if request:
            # Handle X-Forwarded-For for proxied deployments
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip_address = x_forwarded_for.split(',')[0].strip()
            else:
                ip_address = request.META.get('REMOTE_ADDR')
            user_agent = request.META.get('HTTP_USER_AGENT', '')

        try:
            AuditLog.objects.create(
                user=user,
                action=action,
                ip_address=ip_address,
                user_agent=user_agent,
                metadata=metadata or {},
            )
        except Exception as exc:
            # Audit logging must never break the main request flow
            logger.error('AuditLog write failed for action %s: %s', action, str(exc))

    # ------------------------------------------------------------------
    # IP / Device tracking
    # ------------------------------------------------------------------

    @staticmethod
    def update_login_metadata(user, request) -> None:
        """
        Persist the user's last login IP and device (User-Agent) on the model.
        Called after a successful login.
        """
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')

        user_agent = request.META.get('HTTP_USER_AGENT', '')[:255]

        user.last_login_ip = ip
        user.last_device = user_agent
        user.save(update_fields=['last_login_ip', 'last_device'])
