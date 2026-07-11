from django.db import models


class Route(models.Model):
    route_name = models.CharField(max_length=200)
    route_number = models.CharField(max_length=20)
    source = models.CharField(max_length=200)
    destination = models.CharField(max_length=200)
    distance = models.DecimalField(max_digits=8, decimal_places=2, help_text='Distance in km')
    fare = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    depot = models.ForeignKey('depots.Depot', on_delete=models.CASCADE, related_name='routes')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['route_number']

    def __str__(self):
        return f"{self.route_number}: {self.source} → {self.destination}"


class Stop(models.Model):
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='stops')
    name = models.CharField(max_length=200)
    order = models.PositiveIntegerField()
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    # Schedule-based ETA fields
    travel_minutes = models.PositiveIntegerField(
        default=3,
        help_text='Estimated travel time (minutes) from the previous stop'
    )
    distance_from_prev = models.DecimalField(
        max_digits=6, decimal_places=2, default=0,
        help_text='Distance in km from the previous stop'
    )
    arrival_offset = models.PositiveIntegerField(
        default=0,
        help_text='Minutes from route start (auto-computed or manually set)'
    )

    class Meta:
        ordering = ['order']
        unique_together = ['route', 'order']

    def __str__(self):
        return f"{self.route.route_number} - Stop {self.order}: {self.name}"
