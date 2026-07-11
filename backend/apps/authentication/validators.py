"""
Custom validators for the authentication module.

These are standalone functions designed to be used with DRF serializer fields
or called directly from views/services.
"""
import re
from django.core.exceptions import ValidationError


# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------

def validate_strong_password(value: str) -> str:
    """
    Enforce strong password policy:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    if len(value) < 8:
        raise ValidationError('Password must be at least 8 characters long.')
    if not re.search(r'[A-Z]', value):
        raise ValidationError('Password must contain at least one uppercase letter.')
    if not re.search(r'[a-z]', value):
        raise ValidationError('Password must contain at least one lowercase letter.')
    if not re.search(r'\d', value):
        raise ValidationError('Password must contain at least one digit.')
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]', value):
        raise ValidationError('Password must contain at least one special character.')
    return value


# ---------------------------------------------------------------------------
# Image / file validation
# ---------------------------------------------------------------------------

ALLOWED_IMAGE_TYPES = {
    'image/jpeg': [b'\xff\xd8\xff'],          # JPEG magic bytes
    'image/png': [b'\x89PNG'],                # PNG magic bytes
    'image/webp': [b'RIFF', b'WEBP'],         # WEBP magic bytes (RIFF....WEBP)
}
MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def validate_profile_photo(file) -> None:
    """
    Validate that an uploaded profile photo:
    - Is JPG, PNG, or WEBP
    - Does not exceed 5 MB
    Uses magic bytes for content-type verification (not just extension/mimetype header).
    """
    if file.size > MAX_PHOTO_SIZE_BYTES:
        raise ValidationError(
            f'Profile photo must not exceed 5 MB. '
            f'Uploaded file is {file.size / (1024 * 1024):.1f} MB.'
        )

    file.seek(0)
    header = file.read(12)
    file.seek(0)

    valid = False
    for mime_type, magic_list in ALLOWED_IMAGE_TYPES.items():
        for magic in magic_list:
            if header[:len(magic)] == magic:
                valid = True
                break
        if valid:
            break

    if not valid:
        raise ValidationError(
            'Unsupported image format. Only JPG, PNG, and WEBP files are allowed.'
        )


# ---------------------------------------------------------------------------
# Phone validation
# ---------------------------------------------------------------------------

def validate_phone(value: str) -> str:
    """
    Accept phone numbers in common formats:
    - Digits only: 9876543210
    - With country code: +919876543210
    - With spaces/dashes: +91 98765-43210
    Minimum 7 digits, maximum 15 digits (E.164 standard).
    """
    digits_only = re.sub(r'[\s\-\+\(\)]', '', value)
    if not re.match(r'^\d{7,15}$', digits_only):
        raise ValidationError(
            'Enter a valid phone number (7–15 digits, '
            'optionally with country code, spaces, or dashes).'
        )
    return value
