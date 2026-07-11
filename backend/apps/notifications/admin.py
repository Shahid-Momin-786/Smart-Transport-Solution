from django.contrib import admin
from .models import Notification

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'depot', 'is_read', 'created_at']
    list_filter = ['is_read', 'depot']
    search_fields = ['title', 'message', 'user__name']
