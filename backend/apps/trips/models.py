from django.db import models


class Trip(models.Model):
    STATUS_CHOICES = [
        ('SCHEDULED', 'Scheduled'),
        ('ON_TIME', 'On Time'),
        ('DELAYED', 'Delayed'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    route = models.ForeignKey('routes.Route', on_delete=models.CASCADE, related_name='trips')
    bus = models.ForeignKey('buses.Bus', on_delete=models.CASCADE, related_name='trips')
    depot = models.ForeignKey('depots.Depot', on_delete=models.CASCADE, related_name='trips')

    # --- Schedule fields ---
    departure_time = models.TimeField(null=True, blank=True, help_text='Scheduled departure time')
    arrival_time = models.TimeField(null=True, blank=True, help_text='Scheduled arrival time')
    frequency = models.PositiveIntegerField(
        default=0,
        help_text='Minutes between repeated departures. 0 = single trip.'
    )
    avg_stop_minutes = models.PositiveIntegerField(
        default=3,
        help_text='Average minutes per stop (used when stop-level travel_minutes are not set)'
    )

    # --- Delay management ---
    delay_minutes = models.PositiveIntegerField(default=0)
    delay_reason = models.CharField(max_length=255, blank=True)

    # --- Legacy date-range fields (kept for ticket compatibility) ---
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SCHEDULED')
    passenger_count = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['departure_time', '-created_at']

    def __str__(self):
        dep = self.departure_time.strftime('%H:%M') if self.departure_time else '??:??'
        return f"Trip {self.id}: {self.route.route_number} - {self.bus.bus_number} @ {dep}"

    @property
    def effective_departure(self):
        """Departure time including any delay."""
        if not self.departure_time:
            return None
        from datetime import datetime, timedelta
        from django.utils import timezone
        today = timezone.localdate()
        base = datetime.combine(today, self.departure_time)
        return (base + timedelta(minutes=self.delay_minutes)).time()

    @property
    def is_delayed(self):
        return self.delay_minutes > 0

    @property
    def display_status(self):
        if self.status == 'CANCELLED':
            return 'Cancelled'
        if self.delay_minutes > 0:
            return 'Delayed'
        return 'On Time'
