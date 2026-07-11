from django.contrib import admin
from .models import Ticket

@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ['ticket_number', 'passenger', 'trip', 'depot', 'seat_number', 'fare', 'status', 'booked_at']
    list_filter = ['status', 'depot']
    search_fields = ['ticket_number', 'passenger__name', 'passenger__email']
    readonly_fields = ['qr_code', 'ticket_number']
