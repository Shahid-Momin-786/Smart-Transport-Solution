from django.db import models


class Bus(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('MAINTENANCE', 'Maintenance'),
    ]

    bus_number = models.CharField(max_length=50, unique=True)
    capacity = models.PositiveIntegerField(default=40)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    depot = models.ForeignKey('depots.Depot', on_delete=models.CASCADE, related_name='buses')
    model = models.CharField(max_length=100, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['bus_number']
        verbose_name_plural = 'Buses'

    def __str__(self):
        return f"{self.bus_number} ({self.depot.code})"
