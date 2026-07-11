from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth import get_user_model
from .models import AuditLog

User = get_user_model()


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = [
        'email', 'name', 'role', 'depot', 'is_active',
        'is_verified', 'phone_verified', 'deleted_at', 'created_at',
    ]
    list_filter = ['role', 'is_active', 'is_verified', 'phone_verified', 'depot']
    search_fields = ['email', 'name', 'phone']
    ordering = ['-created_at']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': (
            'name', 'phone', 'profile_image',
            'address', 'emergency_contact', 'preferred_language',
        )}),
        ('Role & Depot', {'fields': ('role', 'depot')}),
        ('Status & Verification', {'fields': (
            'is_active', 'is_staff', 'is_superuser',
            'is_verified', 'phone_verified', 'deleted_at',
        )}),
        ('Auth Tokens', {'fields': (
            'verification_token', 'verification_token_expires',
            'reset_token', 'reset_token_expires',
        )}),
        ('Security Tracking', {'fields': ('last_login_ip', 'last_device')}),
        ('Permissions', {'fields': ('groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'name', 'role', 'depot', 'password1', 'password2'),
        }),
    )
    readonly_fields = ['deleted_at', 'last_login_ip', 'last_device']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'user', 'ip_address', 'created_at']
    list_filter = ['action']
    search_fields = ['user__email', 'ip_address', 'user_agent']
    ordering = ['-created_at']
    readonly_fields = ['id', 'user', 'action', 'ip_address', 'user_agent', 'metadata', 'created_at']

    def has_add_permission(self, request):
        return False  # Audit logs should only be created programmatically

    def has_delete_permission(self, request, obj=None):
        return False  # Preserve audit trail integrity

