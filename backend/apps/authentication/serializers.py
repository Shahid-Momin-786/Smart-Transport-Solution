from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from apps.depots.serializers import DepotSerializer
from .validators import validate_strong_password, validate_profile_photo, validate_phone

User = get_user_model()


# ===========================================================================
# EXISTING serializers — DO NOT MODIFY
# ===========================================================================

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['name'] = user.name
        token['email'] = user.email
        token['role'] = user.role
        token['depot_id'] = str(user.depot_id) if user.depot_id else None
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        data['user'] = {
            'id': str(user.id),
            'name': user.name,
            'email': user.email,
            'role': user.role,
            'depot_id': str(user.depot_id) if user.depot_id else None,
            'depot': DepotSerializer(user.depot).data if user.depot else None,
            'profile_image': user.profile_image.url if user.profile_image else None,
            'is_verified': user.is_verified,
        }
        return data


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=8)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
    confirm_password = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs


# ===========================================================================
# NEW serializers
# ===========================================================================

class RegisterSerializer(serializers.Serializer):
    """
    POST /api/auth/register/

    Registers a new Passenger or Depot Admin.
    Returns JWT tokens immediately after registration so the frontend can
    log the user in without a second round-trip.
    """
    name = serializers.CharField(max_length=200, required=True)
    email = serializers.EmailField(required=True)
    phone = serializers.CharField(max_length=20, required=True)
    password = serializers.CharField(required=True, write_only=True, min_length=8)
    confirm_password = serializers.CharField(required=True, write_only=True)
    role = serializers.ChoiceField(
        choices=['PASSENGER', 'ADMIN'],
        default='PASSENGER',
    )
    depot_id = serializers.IntegerField(required=True)
    accept_terms = serializers.BooleanField(required=True)

    # ---- Field-level validation ----

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value.lower()

    def validate_phone(self, value):
        try:
            validate_phone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message)
        if User.objects.filter(phone=value).exists():
            raise serializers.ValidationError('An account with this phone number already exists.')
        return value

    def validate_password(self, value):
        try:
            validate_strong_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message)
        return value

    def validate_depot_id(self, value):
        from apps.depots.models import Depot
        try:
            return Depot.objects.get(id=value)
        except Depot.DoesNotExist:
            raise serializers.ValidationError('The selected depot does not exist.')

    def validate_accept_terms(self, value):
        if not value:
            raise serializers.ValidationError(
                'You must accept the Terms & Conditions to register.'
            )
        return value

    # ---- Object-level validation ----

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        validated_data.pop('accept_terms')
        depot = validated_data.pop('depot_id')  # already resolved to Depot instance
        password = validated_data.pop('password')

        user = User(depot=depot, **validated_data)
        user.set_password(password)
        # is_verified stays False → signal will fire verification email
        user.save()
        return user


# ---------------------------------------------------------------------------

class VerifyEmailSerializer(serializers.Serializer):
    """POST /api/auth/verify-email/"""
    token = serializers.CharField(required=True, max_length=200)


# ---------------------------------------------------------------------------

class ResendVerificationSerializer(serializers.Serializer):
    """POST /api/auth/resend-verification/"""
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        try:
            user = User.objects.get(email__iexact=value, is_active=True)
        except User.DoesNotExist:
            # Do not reveal whether the email exists
            raise serializers.ValidationError(
                'No active account with this email was found.'
            )
        if user.is_verified:
            raise serializers.ValidationError('This email address is already verified.')
        return value.lower()


# ---------------------------------------------------------------------------

class UploadProfilePhotoSerializer(serializers.Serializer):
    """POST /api/auth/upload-profile-photo/"""
    profile_photo = serializers.ImageField(required=True)

    def validate_profile_photo(self, file):
        try:
            validate_profile_photo(file)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message)
        return file


# ---------------------------------------------------------------------------

class UpdateProfileSerializer(serializers.ModelSerializer):
    """
    PATCH /api/auth/profile/

    Allowed: name, phone, address, emergency_contact, preferred_language
    Blocked: email, password, role, depot
    """
    phone = serializers.CharField(max_length=20, required=False)

    class Meta:
        model = User
        fields = ['name', 'phone', 'address', 'emergency_contact', 'preferred_language']

    def validate_phone(self, value):
        if not value:
            return value
        try:
            validate_phone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message)
        # Exclude the current user from the uniqueness check
        request = self.context.get('request')
        qs = User.objects.filter(phone=value)
        if request and request.user:
            qs = qs.exclude(pk=request.user.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'This phone number is already associated with another account.'
            )
        return value


# ---------------------------------------------------------------------------

class DeleteAccountSerializer(serializers.Serializer):
    """DELETE /api/auth/account/ — requires password confirmation."""
    password = serializers.CharField(required=True, write_only=True)

    def validate_password(self, value):
        request = self.context.get('request')
        if request and not request.user.check_password(value):
            raise serializers.ValidationError('Incorrect password.')
        return value


# ---------------------------------------------------------------------------
# Read serializer used by multiple views to return a consistent user payload
# ---------------------------------------------------------------------------

class UserProfileSerializer(serializers.ModelSerializer):
    """
    Read-only serializer that returns the full user profile in the standard
    response format. Used by register, update-profile, and upload-photo views.
    """
    depot_details = DepotSerializer(source='depot', read_only=True)
    profile_photo_url = serializers.SerializerMethodField()
    email_verified = serializers.BooleanField(source='is_verified', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'name', 'email', 'phone', 'role',
            'depot', 'depot_details',
            'profile_photo_url',
            'address', 'emergency_contact', 'preferred_language',
            'email_verified', 'phone_verified',
            'last_login_ip', 'last_device',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_profile_photo_url(self, obj):
        request = self.context.get('request')
        if obj.profile_image and request:
            return request.build_absolute_uri(obj.profile_image.url)
        return None

