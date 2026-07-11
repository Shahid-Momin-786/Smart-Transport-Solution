from django.contrib import admin
from .models import Bus

@admin.register(Bus)
class BusAdmin(admin.ModelAdmin):
    list_display = ['bus_number', 'depot', 'capacity', 'status', 'created_at']
    list_filter = ['status', 'depot']
    search_fields = ['bus_number', 'model']
