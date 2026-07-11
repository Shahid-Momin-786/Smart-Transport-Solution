from django.contrib import admin
from .models import Route, Stop

class StopInline(admin.TabularInline):
    model = Stop
    extra = 0

@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ['route_number', 'route_name', 'source', 'destination', 'distance', 'fare', 'depot', 'is_active']
    list_filter = ['is_active', 'depot']
    search_fields = ['route_name', 'route_number', 'source', 'destination']
    inlines = [StopInline]
