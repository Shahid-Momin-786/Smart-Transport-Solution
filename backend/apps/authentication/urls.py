from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    # Existing views
    LoginView, LogoutView, ChangePasswordView,
    ForgotPasswordView, ResetPasswordView, MeView,
    # New views
    RegisterView, VerifyEmailView, ResendVerificationView,
    UploadProfilePhotoView, UpdateProfileView, DeleteAccountView,
)

urlpatterns = [
    # ------------------------------------------------------------------
    # Existing endpoints — DO NOT MODIFY
    # ------------------------------------------------------------------
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='auth-forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='auth-reset-password'),
    path('me/', MeView.as_view(), name='auth-me'),

    # ------------------------------------------------------------------
    # New endpoints
    # ------------------------------------------------------------------
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('verify-email/', VerifyEmailView.as_view(), name='auth-verify-email'),
    path('resend-verification/', ResendVerificationView.as_view(), name='auth-resend-verification'),
    path('upload-profile-photo/', UploadProfilePhotoView.as_view(), name='auth-upload-profile-photo'),
    path('profile/', UpdateProfileView.as_view(), name='auth-update-profile'),
    path('account/', DeleteAccountView.as_view(), name='auth-delete-account'),
]
