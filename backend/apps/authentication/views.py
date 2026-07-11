import uuid
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from .serializers import (
    CustomTokenObtainPairSerializer,
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    RegisterSerializer,
    VerifyEmailSerializer,
    ResendVerificationSerializer,
    UploadProfilePhotoSerializer,
    UpdateProfileSerializer,
    DeleteAccountSerializer,
    UserProfileSerializer,
)
from .services import AuthService

User = get_user_model()


# ===========================================================================
# Helpers
# ===========================================================================

def success_response(message: str, data: dict = None, status_code: int = 200) -> Response:
    """Return the standard success envelope: {success, message, data}."""
    return Response(
        {'success': True, 'message': message, 'data': data or {}},
        status=status_code,
    )


def error_response(message: str, errors: dict = None, status_code: int = 400) -> Response:
    """Return the standard error envelope: {success, message, errors}."""
    return Response(
        {'success': False, 'message': message, 'errors': errors or {}},
        status=status_code,
    )


# ===========================================================================
# EXISTING views — preserved exactly as-is
# ===========================================================================

class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({'detail': 'Successfully logged out.'}, status=status.HTTP_200_OK)
        except TokenError:
            return Response({'detail': 'Invalid or already blacklisted token.'}, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'old_password': 'Incorrect password.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data['new_password'])
        user.save()
        AuthService.log_audit(user, 'PASSWORD_CHANGED', request)
        return Response({'detail': 'Password changed successfully.'}, status=status.HTTP_200_OK)


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        try:
            user = User.objects.get(email=email, is_active=True)
            token = str(uuid.uuid4())
            user.reset_token = token
            user.reset_token_expires = timezone.now() + timezone.timedelta(hours=2)
            user.save()

            reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
            send_mail(
                subject='Password Reset — Smart Transport Solution',
                message=f'Click the link to reset your password: {reset_url}\n\nThis link expires in 2 hours.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        except User.DoesNotExist:
            pass  # Don't reveal if email exists

        return Response({'detail': 'If this email exists, a reset link has been sent.'}, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        token = serializer.validated_data['token']
        try:
            user = User.objects.get(reset_token=token, is_active=True)
            if user.reset_token_expires and timezone.now() > user.reset_token_expires:
                return Response({'detail': 'Reset token has expired.'}, status=status.HTTP_400_BAD_REQUEST)

            user.set_password(serializer.validated_data['new_password'])
            user.reset_token = ''
            user.reset_token_expires = None
            user.save()
            AuthService.log_audit(user, 'PASSWORD_RESET', request)
            return Response({'detail': 'Password reset successful.'}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({'detail': 'Invalid reset token.'}, status=status.HTTP_400_BAD_REQUEST)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.users.serializers import UserSerializer
        serializer = UserSerializer(request.user, context={'request': request})
        return Response(serializer.data)


# ===========================================================================
# NEW views
# ===========================================================================

class RegisterView(APIView):
    """
    POST /api/auth/register/

    Register a new Passenger, Driver, or Depot Admin.
    On success returns JWT tokens + user profile so the client can
    immediately authenticate without a second login request.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'registration'

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                'Registration failed. Please correct the errors below.',
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        user = serializer.save()

        # Generate JWT tokens
        tokens = AuthService.generate_tokens(user)

        # Update login metadata
        AuthService.update_login_metadata(user, request)

        # Audit log
        AuthService.log_audit(user, 'REGISTER', request, metadata={'role': user.role})

        # Build response profile
        profile = UserProfileSerializer(user, context={'request': request}).data

        return success_response(
            message='Registration successful. Please check your email to verify your account.',
            data={
                'user': profile,
                'tokens': tokens,
                'email_verification_sent': True,
            },
            status_code=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------

class VerifyEmailView(APIView):
    """
    POST /api/auth/verify-email/

    Validate the token sent to the user's email and mark the account as verified.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                'Invalid request.',
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        token = serializer.validated_data['token']

        try:
            user = User.objects.get(verification_token=token, is_active=True)
        except User.DoesNotExist:
            return error_response(
                'Invalid or expired verification token.',
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Check expiry (if the field is populated)
        if user.verification_token_expires:
            if timezone.now() > user.verification_token_expires:
                return error_response(
                    'Verification token has expired. Please request a new one.',
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

        if user.is_verified:
            return success_response('Your email is already verified. You can log in.')

        # Mark verified and clear the token
        user.is_verified = True
        user.verification_token = ''
        user.verification_token_expires = None
        user.save(update_fields=['is_verified', 'verification_token', 'verification_token_expires'])

        AuthService.log_audit(user, 'EMAIL_VERIFIED', request)
        AuthService.send_welcome_email(user)

        return success_response(
            'Email verified successfully. Welcome to Smart Transport Solution!',
            data={'email_verified': True},
        )


# ---------------------------------------------------------------------------

class ResendVerificationView(APIView):
    """
    POST /api/auth/resend-verification/

    Resend the email verification link. Rate-limited to 3 requests per hour.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'resend_verification'

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                'Unable to resend verification.',
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        email = serializer.validated_data['email']
        # User is guaranteed to exist and be unverified at this point (validated above)
        user = User.objects.get(email=email, is_active=True)

        sent = AuthService.send_verification_email(user, request)
        AuthService.log_audit(user, 'VERIFICATION_RESENT', request)

        if sent:
            return success_response(
                'A new verification email has been sent. Please check your inbox.'
            )
        return error_response(
            'Failed to send verification email. Please try again later.',
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ---------------------------------------------------------------------------

class UploadProfilePhotoView(APIView):
    """
    POST /api/auth/upload-profile-photo/

    Accept a multipart/form-data upload (field: profile_photo).
    Validates: JPG/PNG/WEBP only, max 5 MB.
    Stores in MEDIA_ROOT/profiles/ and saves path on the user model.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = UploadProfilePhotoSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                'Photo upload failed.',
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        photo = serializer.validated_data['profile_photo']
        user = request.user

        # Delete old photo from storage to avoid orphaned files
        if user.profile_image:
            try:
                user.profile_image.delete(save=False)
            except Exception:
                pass  # Non-critical; continue with the upload

        user.profile_image = photo
        user.save(update_fields=['profile_image'])

        AuthService.log_audit(user, 'PHOTO_UPLOADED', request)

        profile = UserProfileSerializer(user, context={'request': request}).data
        return success_response(
            'Profile photo updated successfully.',
            data={'user': profile},
        )


# ---------------------------------------------------------------------------

class UpdateProfileView(APIView):
    """
    PATCH /api/auth/profile/

    Update allowed profile fields: name, phone, address, emergency_contact,
    preferred_language. Email, role, depot, and password are read-only here.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        serializer = UpdateProfileSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={'request': request},
        )
        if not serializer.is_valid():
            return error_response(
                'Profile update failed.',
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        serializer.save()
        AuthService.log_audit(request.user, 'PROFILE_UPDATED', request)

        profile = UserProfileSerializer(request.user, context={'request': request}).data
        return success_response(
            'Profile updated successfully.',
            data={'user': profile},
        )


# ---------------------------------------------------------------------------

class DeleteAccountView(APIView):
    """
    DELETE /api/auth/account/

    Soft-delete the authenticated user's account:
    - Requires password confirmation
    - Sets is_active=False and deleted_at=now()
    - Blacklists the provided refresh token
    - Logs the deletion event
    Does NOT permanently remove any database records.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        serializer = DeleteAccountSerializer(
            data=request.data,
            context={'request': request},
        )
        if not serializer.is_valid():
            return error_response(
                'Account deletion failed.',
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user

        # Soft delete
        user.is_active = False
        user.deleted_at = timezone.now()
        user.save(update_fields=['is_active', 'deleted_at'])

        # Blacklist the refresh token if provided
        refresh_token = request.data.get('refresh')
        if refresh_token:
            AuthService.blacklist_user_tokens(refresh_token)

        # Audit log (user reference preserved even after soft-delete)
        AuthService.log_audit(user, 'ACCOUNT_DELETED', request, metadata={
            'email': user.email,
            'role': user.role,
        })

        return success_response(
            'Your account has been deactivated successfully. '
            'Contact support if you wish to recover it.',
            status_code=status.HTTP_200_OK,
        )

