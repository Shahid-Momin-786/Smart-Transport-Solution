"""
Custom DRF permission classes for the authentication module.

These extend the existing permission setup and integrate naturally with the
JWT authentication already configured in settings.py.
"""
from rest_framework.permissions import BasePermission, IsAuthenticated


class IsOwner(BasePermission):
    """
    Grant access only if the requesting user is the object owner.
    Expects the view's object to have a `user` attribute or be a User instance.
    """
    message = 'You do not have permission to access this resource.'

    def has_object_permission(self, request, view, obj):
        # Works for User objects directly
        if hasattr(obj, 'id'):
            return str(obj.id) == str(request.user.id)
        # Works for objects with a .user FK
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return False


class IsAdminUser(BasePermission):
    """
    Allow access only to users with role == ADMIN or is_superuser.
    Compatible with the existing `User.is_admin` property.
    """
    message = 'Admin access required.'

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_admin
        )


class IsPassenger(BasePermission):
    """Allow access only to users with role == PASSENGER."""
    message = 'Passenger access required.'

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'PASSENGER'
        )


class IsDriver(BasePermission):
    """Allow access only to users with role == DRIVER."""
    message = 'Driver access required.'

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'DRIVER'
        )


class IsPassengerOrDriver(BasePermission):
    """Allow access to PASSENGER or DRIVER roles (non-admin users)."""
    message = 'Passenger or driver access required.'

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('PASSENGER', 'DRIVER')
        )


class IsVerifiedUser(IsAuthenticated):
    """
    Allow access only to authenticated users who have verified their email.
    Use on endpoints that should not be accessible with an unverified account.
    """
    message = 'Email verification required to access this resource.'

    def has_permission(self, request, view):
        is_auth = super().has_permission(request, view)
        return is_auth and getattr(request.user, 'is_verified', False)
