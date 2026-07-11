import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_verified', True)
        extra_fields.setdefault('role', 'ADMIN')
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('PASSENGER', 'Passenger'),
        ('ADMIN', 'Admin'),
    ]

    LANGUAGE_CHOICES = [
        ('en', 'English'),
        ('hi', 'Hindi'),
        ('mr', 'Marathi'),
        ('gu', 'Gujarati'),
        ('ta', 'Tamil'),
        ('te', 'Telugu'),
    ]

    # --- Core identity ---
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='PASSENGER')
    depot = models.ForeignKey(
        'depots.Depot',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )

    # --- Profile fields ---
    profile_image = models.ImageField(upload_to='profiles/', null=True, blank=True)
    address = models.TextField(blank=True, default='')
    emergency_contact = models.CharField(max_length=100, blank=True, default='')
    preferred_language = models.CharField(
        max_length=10, choices=LANGUAGE_CHOICES, default='en'
    )

    # --- Verification flags ---
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)          # email verified
    phone_verified = models.BooleanField(default=False)

    # --- Auth tokens ---
    verification_token = models.CharField(max_length=200, blank=True)
    verification_token_expires = models.DateTimeField(null=True, blank=True)
    reset_token = models.CharField(max_length=100, blank=True)
    reset_token_expires = models.DateTimeField(null=True, blank=True)

    # --- Device / security tracking ---
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    last_device = models.CharField(max_length=255, blank=True, default='')

    # --- Soft delete ---
    deleted_at = models.DateTimeField(null=True, blank=True)

    # --- Timestamps ---
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    objects = UserManager()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.email})"

    # --- Role helpers ---
    @property
    def is_admin(self):
        return self.role == 'ADMIN' or self.is_superuser

    @property
    def is_passenger(self):
        return self.role == 'PASSENGER'

    # --- Soft-delete helper ---
    @property
    def is_deleted(self):
        return self.deleted_at is not None

    # --- email_verified alias for API consistency ---
    @property
    def email_verified(self):
        return self.is_verified


class AuditLog(models.Model):
    """Records security-sensitive user events for compliance and forensics."""
    ACTION_CHOICES = [
        ('REGISTER', 'User Registered'),
        ('LOGIN', 'User Logged In'),
        ('LOGOUT', 'User Logged Out'),
        ('EMAIL_VERIFIED', 'Email Verified'),
        ('PASSWORD_CHANGED', 'Password Changed'),
        ('PASSWORD_RESET', 'Password Reset'),
        ('PROFILE_UPDATED', 'Profile Updated'),
        ('PHOTO_UPLOADED', 'Profile Photo Uploaded'),
        ('ACCOUNT_DELETED', 'Account Deleted'),
        ('VERIFICATION_RESENT', 'Verification Email Resent'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        user_str = self.user.email if self.user else 'deleted-user'
        return f"[{self.action}] {user_str} @ {self.created_at}"

