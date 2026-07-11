import uuid
import qrcode
import io
import base64
from django.db import models
from django.utils import timezone


def generate_pass_number():
    return f"PSS-{uuid.uuid4().hex[:8].upper()}"


def generate_daily_pass_number():
    return f"DPS-{uuid.uuid4().hex[:8].upper()}"


def generate_application_number():
    return f"APP-{uuid.uuid4().hex[:8].upper()}"


def generate_generated_pass_number():
    return f"GPS-{uuid.uuid4().hex[:8].upper()}"


def generate_qr_code(data: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()


# ─────────────────────────────────────────────
# Original Pass model — KEPT for backward compat
# ─────────────────────────────────────────────

class Pass(models.Model):
    PASS_TYPE_CHOICES = [
        ('WEEKLY', 'Weekly'),
        ('MONTHLY', 'Monthly'),
        ('STUDENT', 'Student'),
    ]
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('EXPIRED', 'Expired'),
        ('REVOKED', 'Revoked'),
    ]

    pass_number = models.CharField(max_length=20, unique=True, default=generate_pass_number)
    passenger = models.ForeignKey(
        'authentication.User', on_delete=models.CASCADE, related_name='passes',
        limit_choices_to={'role': 'PASSENGER'}
    )
    depot = models.ForeignKey('depots.Depot', on_delete=models.CASCADE, related_name='passes')
    route = models.ForeignKey('routes.Route', on_delete=models.SET_NULL, null=True, blank=True, related_name='passes')
    pass_type = models.CharField(max_length=20, choices=PASS_TYPE_CHOICES)
    valid_from = models.DateField()
    valid_to = models.DateField()
    fare = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    student_id = models.CharField(max_length=50, blank=True)
    qr_code = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Passes'

    def __str__(self):
        return f"{self.pass_number} - {self.passenger.name} ({self.pass_type})"

    @property
    def is_valid(self):
        today = timezone.now().date()
        return self.status == 'ACTIVE' and self.valid_from <= today <= self.valid_to

    def save(self, *args, **kwargs):
        if not self.qr_code:
            qr_data = f"SMTS:PASS:{self.pass_number}:{self.passenger_id}"
            self.qr_code = generate_qr_code(qr_data)
        super().save(*args, **kwargs)


# ─────────────────────────────────────────────
# NEW: Pass Pricing — configurable by admin
# ─────────────────────────────────────────────

class PassPricing(models.Model):
    CATEGORY_CHOICES = [
        ('STUDENT', 'Student'),
        ('WORKER', 'Worker'),
        ('SENIOR_CITIZEN', 'Senior Citizen'),
        ('GENERAL', 'General Passenger'),
        ('DISABLED', 'Disabled Passenger'),
    ]
    DURATION_CHOICES = [
        ('MONTHLY', 'Monthly'),
        ('3MONTHS', '3 Months'),
        ('6MONTHS', '6 Months'),
        ('YEARLY', 'Yearly'),
    ]

    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    duration = models.CharField(max_length=10, choices=DURATION_CHOICES)
    depot = models.ForeignKey(
        'depots.Depot', on_delete=models.CASCADE, related_name='pass_pricing',
        null=True, blank=True, help_text='Leave blank for global pricing'
    )
    area = models.CharField(max_length=100, blank=True, help_text='Optional area restriction')
    price = models.DecimalField(max_digits=8, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'duration']
        verbose_name = 'Pass Pricing'
        verbose_name_plural = 'Pass Pricing'
        unique_together = [['category', 'duration', 'depot']]

    def __str__(self):
        depot_str = self.depot.name if self.depot else 'Global'
        return f"{self.get_category_display()} · {self.get_duration_display()} · {depot_str} · ₹{self.price}"


# ─────────────────────────────────────────────
# NEW: Daily Pass — instant, no approval needed
# ─────────────────────────────────────────────

class DailyPass(models.Model):
    PASS_TYPE_CHOICES = [
        ('CITY', 'City Pass'),
        ('EXTENDED', 'Extended Area Pass'),
    ]
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('EXPIRED', 'Expired'),
        ('USED', 'Used'),
    ]

    pass_number = models.CharField(max_length=20, unique=True, default=generate_daily_pass_number)
    passenger = models.ForeignKey(
        'authentication.User', on_delete=models.CASCADE, related_name='daily_passes'
    )
    depot = models.ForeignKey('depots.Depot', on_delete=models.CASCADE, related_name='daily_passes')
    route = models.ForeignKey(
        'routes.Route', on_delete=models.SET_NULL, null=True, blank=True, related_name='daily_passes'
    )
    pass_type = models.CharField(max_length=20, choices=PASS_TYPE_CHOICES, default='CITY')
    source = models.CharField(max_length=200, blank=True)
    destination = models.CharField(max_length=200, blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    valid_date = models.DateField()
    qr_code = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Daily Pass'
        verbose_name_plural = 'Daily Passes'

    def __str__(self):
        return f"{self.pass_number} — {self.passenger.name} ({self.valid_date})"

    @property
    def is_valid(self):
        today = timezone.now().date()
        return self.status == 'ACTIVE' and self.valid_date == today

    def save(self, *args, **kwargs):
        if not self.qr_code:
            qr_data = f"SMTS:DAILY:{self.pass_number}:{self.passenger_id}:{self.valid_date}"
            self.qr_code = generate_qr_code(qr_data)
        super().save(*args, **kwargs)


# ─────────────────────────────────────────────
# NEW: Pass Application — multi-step workflow
# ─────────────────────────────────────────────

class PassApplication(models.Model):
    CATEGORY_CHOICES = [
        ('STUDENT', 'Student'),
        ('WORKER', 'Worker'),
        ('SENIOR_CITIZEN', 'Senior Citizen'),
        ('GENERAL', 'General Passenger'),
        ('DISABLED', 'Disabled Passenger'),
    ]
    DURATION_CHOICES = [
        ('MONTHLY', 'Monthly'),
        ('3MONTHS', '3 Months'),
        ('6MONTHS', '6 Months'),
        ('YEARLY', 'Yearly'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('UNDER_VERIFICATION', 'Under Verification'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('REUPLOAD_REQUESTED', 'Re-upload Requested'),
    ]

    application_number = models.CharField(max_length=20, unique=True, default=generate_application_number)
    passenger = models.ForeignKey(
        'authentication.User', on_delete=models.CASCADE, related_name='pass_applications'
    )
    depot = models.ForeignKey('depots.Depot', on_delete=models.CASCADE, related_name='pass_applications')
    route = models.ForeignKey(
        'routes.Route', on_delete=models.SET_NULL, null=True, blank=True, related_name='pass_applications'
    )
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    duration = models.CharField(max_length=10, choices=DURATION_CHOICES)
    area = models.CharField(max_length=100, blank=True)
    pricing = models.ForeignKey(
        PassPricing, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='applications'
    )
    calculated_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='PENDING')
    admin_remark = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        'authentication.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_applications', limit_choices_to={'role': 'ADMIN'}
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Pass Application'
        verbose_name_plural = 'Pass Applications'

    def __str__(self):
        return f"{self.application_number} — {self.passenger.name} ({self.category})"


# ─────────────────────────────────────────────
# NEW: Pass Document — files per application
# ─────────────────────────────────────────────

DOCUMENT_TYPE_CHOICES = [
    ('AADHAAR', 'Aadhaar Card'),
    ('BONAFIDE', 'Bonafide Certificate'),
    ('PHOTO', 'Passport Photo'),
    ('LIGHT_BILL', 'Light Bill'),
    ('EMPLOYEE_ID', 'Employee ID'),
    ('AGE_PROOF', 'Age Proof'),
    ('DISABILITY_CERT', 'Disability Certificate'),
    ('OTHER', 'Other'),
]

# Required documents per category
CATEGORY_REQUIRED_DOCS = {
    'STUDENT': ['AADHAAR', 'BONAFIDE', 'PHOTO'],
    'WORKER': ['AADHAAR', 'LIGHT_BILL', 'EMPLOYEE_ID', 'PHOTO'],
    'SENIOR_CITIZEN': ['AADHAAR', 'AGE_PROOF'],
    'DISABLED': ['AADHAAR', 'DISABILITY_CERT'],
    'GENERAL': ['AADHAAR', 'LIGHT_BILL'],
}


class PassDocument(models.Model):
    application = models.ForeignKey(
        PassApplication, on_delete=models.CASCADE, related_name='documents'
    )
    doc_type = models.CharField(max_length=20, choices=DOCUMENT_TYPE_CHOICES)
    file = models.FileField(upload_to='pass_documents/%Y/%m/')
    is_verified = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['doc_type']
        verbose_name = 'Pass Document'
        verbose_name_plural = 'Pass Documents'

    def __str__(self):
        return f"{self.application.application_number} — {self.get_doc_type_display()}"


# ─────────────────────────────────────────────
# NEW: Verification Log — audit trail
# ─────────────────────────────────────────────

class PassVerificationLog(models.Model):
    ACTION_CHOICES = [
        ('SUBMITTED', 'Application Submitted'),
        ('STARTED_REVIEW', 'Review Started'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('REUPLOAD_REQUESTED', 'Re-upload Requested'),
        ('DOCUMENTS_REUPLOADED', 'Documents Re-uploaded'),
        ('PASS_GENERATED', 'Pass Generated'),
    ]

    application = models.ForeignKey(
        PassApplication, on_delete=models.CASCADE, related_name='verification_logs'
    )
    admin = models.ForeignKey(
        'authentication.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='verification_actions'
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    remark = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Verification Log'
        verbose_name_plural = 'Verification Logs'

    def __str__(self):
        return f"{self.application.application_number} — {self.get_action_display()}"


# ─────────────────────────────────────────────
# NEW: Generated Pass — issued after approval
# ─────────────────────────────────────────────

class GeneratedPass(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('EXPIRED', 'Expired'),
        ('REVOKED', 'Revoked'),
    ]

    pass_number = models.CharField(max_length=20, unique=True, default=generate_generated_pass_number)
    application = models.OneToOneField(
        PassApplication, on_delete=models.CASCADE, related_name='generated_pass',
        null=True, blank=True
    )
    passenger = models.ForeignKey(
        'authentication.User', on_delete=models.CASCADE, related_name='generated_passes'
    )
    depot = models.ForeignKey('depots.Depot', on_delete=models.CASCADE, related_name='generated_passes')
    route = models.ForeignKey(
        'routes.Route', on_delete=models.SET_NULL, null=True, blank=True, related_name='generated_passes'
    )
    category = models.CharField(max_length=20, choices=PassApplication.CATEGORY_CHOICES)
    duration = models.CharField(max_length=10, choices=PassApplication.DURATION_CHOICES)
    valid_from = models.DateField()
    valid_to = models.DateField()
    price = models.DecimalField(max_digits=8, decimal_places=2)
    qr_code = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    issued_by = models.ForeignKey(
        'authentication.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='issued_passes'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Generated Pass'
        verbose_name_plural = 'Generated Passes'

    def __str__(self):
        return f"{self.pass_number} — {self.passenger.name} ({self.category})"

    @property
    def is_valid(self):
        today = timezone.now().date()
        return self.status == 'ACTIVE' and self.valid_from <= today <= self.valid_to

    @property
    def days_remaining(self):
        if not self.is_valid:
            return 0
        return (self.valid_to - timezone.now().date()).days

    def save(self, *args, **kwargs):
        if not self.qr_code:
            qr_data = f"SMTS:GPASS:{self.pass_number}:{self.passenger_id}:{self.valid_to}"
            self.qr_code = generate_qr_code(qr_data)
        super().save(*args, **kwargs)
