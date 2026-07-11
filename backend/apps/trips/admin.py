from django.contrib import admin
from .models import Trip

@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ['id', 'route', 'bus', 'depot', 'start_time', 'status']
    list_filter = ['status', 'depot']
    search_fields = ['route__route_number', 'bus__bus_number']
