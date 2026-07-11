import uuid
import qrcode
import io
import base64
from django.db import models


def generate_ticket_number():
    return f"TKT-{uuid.uuid4().hex[:8].upper()}"


def generate_qr_code(data: str) -> str:
    """Generate QR code and return as base64 PNG string."""
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()


class Ticket(models.Model):
    STATUS_CHOICES = [
        ('CONFIRMED', 'Confirmed'),
        ('USED', 'Used'),
        ('CANCELLED', 'Cancelled'),
        ('EXPIRED', 'Expired'),
    ]

    ticket_number = models.CharField(max_length=20, unique=True, default=generate_ticket_number)
    passenger = models.ForeignKey(
        'authentication.User', on_delete=models.CASCADE, related_name='tickets',
        limit_choices_to={'role': 'PASSENGER'}
    )
    trip = models.ForeignKey('trips.Trip', on_delete=models.CASCADE, related_name='tickets')
    depot = models.ForeignKey('depots.Depot', on_delete=models.CASCADE, related_name='tickets')
    boarding_stop = models.ForeignKey(
        'routes.Stop', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='boarding_tickets'
    )
    seat_number = models.CharField(max_length=10)
    fare = models.DecimalField(max_digits=8, decimal_places=2)
    qr_code = models.TextField(blank=True)  # base64 PNG
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CONFIRMED')
    booked_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-booked_at']

    def __str__(self):
        return f"{self.ticket_number} - {self.passenger.name}"

    def save(self, *args, **kwargs):
        if not self.qr_code:
            qr_data = f"SMTS:TICKET:{self.ticket_number}:{self.passenger_id}"
            self.qr_code = generate_qr_code(qr_data)
        super().save(*args, **kwargs)
