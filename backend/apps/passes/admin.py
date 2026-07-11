"""
Django Admin configuration for the passes app.

Provides a full document-verification and pass-generation workflow directly
inside the Django admin panel. Admins can:

  1. View all pass applications filtered by status / depot / category
  2. Open an application and see all submitted documents (with clickable links)
  3. Individually mark each document as verified / unverified
  4. Take bulk or single-record actions:
       • Approve & Generate Pass  (creates GeneratedPass automatically)
       • Reject Application
       • Start Review
       • Request Re-upload
  5. View the full verification audit log inline
  6. View and revoke generated passes
"""
from datetime import timedelta

from django.contrib import admin, messages
from django.utils import timezone
from django.utils.html import format_html
from django.urls import reverse

from .models import (
    Pass, PassPricing, DailyPass,
    PassApplication, PassDocument,
    PassVerificationLog, GeneratedPass,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

DURATION_DAYS = {
    'MONTHLY': 30,
    '3MONTHS': 90,
    '6MONTHS': 180,
    'YEARLY': 365,
}


def _generate_pass_for_application(application, admin_user):
    """Create a GeneratedPass for an approved application. Idempotent."""
    if hasattr(application, 'generated_pass') and application.generated_pass:
        return application.generated_pass  # already generated

    today = timezone.now().date()
    days = DURATION_DAYS.get(application.duration, 30)

    gen_pass = GeneratedPass.objects.create(
        application=application,
        passenger=application.passenger,
        depot=application.depot,
        route=application.route,
        category=application.category,
        duration=application.duration,
        valid_from=today,
        valid_to=today + timedelta(days=days),
        price=application.calculated_price,
        status='ACTIVE',
        issued_by=admin_user,
    )
    PassVerificationLog.objects.create(
        application=application,
        admin=admin_user,
        action='PASS_GENERATED',
        remark=f'Pass {gen_pass.pass_number} generated via admin panel.',
    )
    # Notify passenger
    try:
        from apps.notifications.models import Notification
        Notification.objects.create(
            title='Pass Approved & Generated 🎉',
            message=(
                f'Your {application.get_category_display()} pass application '
                f'{application.application_number} has been approved. '
                f'Pass {gen_pass.pass_number} is now active.'
            ),
            user=application.passenger,
            depot=application.depot,
        )
    except Exception:
        pass
    return gen_pass


# ─────────────────────────────────────────────────────────────────────────────
# Inlines
# ─────────────────────────────────────────────────────────────────────────────

class PassDocumentInline(admin.TabularInline):
    """
    Inline for PassApplication detail page.

    Shows each submitted document with:
      - Type label
      - Clickable link to download / view the file
      - is_verified checkbox (editable by admin)
      - Upload timestamp
    """
    model = PassDocument
    extra = 0
    readonly_fields = ['doc_type_display', 'file_link', 'uploaded_at']
    fields = ['doc_type_display', 'file_link', 'is_verified', 'uploaded_at']
    can_delete = False

    def doc_type_display(self, obj):
        return obj.get_doc_type_display()
    doc_type_display.short_description = 'Document Type'

    def file_link(self, obj):
        if obj.file:
            return format_html(
                '<a href="{}" target="_blank" '
                'style="color:#7c3aed;font-weight:600;text-decoration:none;">'
                '📄 View / Download</a>',
                obj.file.url,
            )
        return '—'
    file_link.short_description = 'File'


class PassVerificationLogInline(admin.TabularInline):
    """Read-only audit trail of every status change on an application."""
    model = PassVerificationLog
    extra = 0
    readonly_fields = ['action', 'admin', 'remark', 'created_at']
    fields = ['action', 'admin', 'remark', 'created_at']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class GeneratedPassInline(admin.TabularInline):
    """Show the generated pass (if any) inside the application detail page."""
    model = GeneratedPass
    extra = 0
    fk_name = 'application'
    readonly_fields = ['pass_number', 'valid_from', 'valid_to', 'price', 'status', 'pass_link']
    fields = ['pass_number', 'valid_from', 'valid_to', 'price', 'status', 'pass_link']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    def pass_link(self, obj):
        if obj.pk:
            url = reverse('admin:passes_generatedpass_change', args=[obj.pk])
            return format_html('<a href="{}">Open Pass →</a>', url)
        return '—'
    pass_link.short_description = 'Detail'


# ─────────────────────────────────────────────────────────────────────────────
# Pass Application Admin — main verification workflow
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(PassApplication)
class PassApplicationAdmin(admin.ModelAdmin):
    """
    Core admin for document verification and pass generation.

    Workflow from the list view:
      1. Filter by status=PENDING or UNDER_VERIFICATION
      2. Select one or more applications
      3. Use the "Action" dropdown:
           - ✅ Approve & Generate Pass
           - 🔍 Start Review
           - ❌ Reject Application
           - 📄 Request Document Re-upload
      4. Open an application to see:
           - Passenger info
           - Submitted documents (with verify checkboxes)
           - Verification log timeline
           - Generated pass (if approved)
    """
    list_display = [
        'application_number',
        'passenger_link',
        'category',
        'duration',
        'depot',
        'calculated_price_display',
        'doc_count',
        'verified_doc_count',
        'status_badge',
        'reviewed_by',
        'created_at',
    ]
    list_filter = ['status', 'category', 'duration', 'depot', 'created_at']
    search_fields = [
        'application_number',
        'passenger__name',
        'passenger__email',
        'passenger__phone',
    ]
    readonly_fields = [
        'application_number',
        'passenger_info_block',
        'required_documents_list',
        'status',
        'admin_remark',
        'reviewed_by',
        'reviewed_at',
        'calculated_price',
        'created_at',
        'updated_at',
    ]
    fieldsets = (
        ('Application', {
            'fields': (
                'application_number',
                'passenger_info_block',
                ('category', 'duration'),
                ('depot', 'route'),
                ('calculated_price', 'pricing'),
                'required_documents_list',
            ),
        }),
        ('Review Status', {
            'fields': (
                'status',
                'admin_remark',
                ('reviewed_by', 'reviewed_at'),
            ),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    inlines = [PassDocumentInline, GeneratedPassInline, PassVerificationLogInline]
    ordering = ['-created_at']
    date_hierarchy = 'created_at'
    actions = [
        'action_approve_and_generate',
        'action_start_review',
        'action_reject',
        'action_request_reupload',
    ]

    # ── List display helpers ──────────────────────────────────────────────────

    def passenger_link(self, obj):
        return format_html(
            '<strong>{}</strong><br>'
            '<span style="color:#6b7280;font-size:11px">{}</span>',
            obj.passenger.name,
            obj.passenger.email,
        )
    passenger_link.short_description = 'Passenger'
    passenger_link.admin_order_field = 'passenger__name'

    def calculated_price_display(self, obj):
        if obj.calculated_price:
            return format_html(
                '<span style="font-weight:700;color:#7c3aed">₹{}</span>',
                obj.calculated_price,
            )
        return '—'
    calculated_price_display.short_description = 'Price'
    calculated_price_display.admin_order_field = 'calculated_price'

    def doc_count(self, obj):
        return obj.documents.count()
    doc_count.short_description = 'Docs'

    def verified_doc_count(self, obj):
        total = obj.documents.count()
        verified = obj.documents.filter(is_verified=True).count()
        color = 'green' if verified == total and total > 0 else 'orange'
        return format_html(
            '<span style="color:{};font-weight:600">{}/{}</span>',
            color, verified, total,
        )
    verified_doc_count.short_description = '✓ Docs'

    def status_badge(self, obj):
        colors = {
            'PENDING':             ('#d97706', '#fef3c7'),
            'UNDER_VERIFICATION':  ('#7c3aed', '#ede9fe'),
            'APPROVED':            ('#059669', '#d1fae5'),
            'REJECTED':            ('#dc2626', '#fee2e2'),
            'REUPLOAD_REQUESTED':  ('#d97706', '#fef3c7'),
        }
        fg, bg = colors.get(obj.status, ('#374151', '#f3f4f6'))
        return format_html(
            '<span style="background:{};color:{};padding:3px 10px;border-radius:12px;'
            'font-size:11px;font-weight:700;white-space:nowrap">{}</span>',
            bg, fg, obj.get_status_display(),
        )
    status_badge.short_description = 'Status'
    status_badge.admin_order_field = 'status'

    # ── Detail page helpers ───────────────────────────────────────────────────

    def passenger_info_block(self, obj):
        p = obj.passenger
        photo_html = ''
        if p.profile_image:
            photo_html = format_html(
                '<img src="{}" style="width:48px;height:48px;border-radius:50%;'
                'object-fit:cover;margin-right:12px;vertical-align:middle">',
                p.profile_image.url,
            )
        return format_html(
            '{}'
            '<strong style="font-size:15px">{}</strong><br>'
            '<span style="color:#6b7280">{}</span><br>'
            '<span style="color:#6b7280">{}</span>',
            photo_html, p.name, p.email, p.phone or '—',
        )
    passenger_info_block.short_description = 'Passenger'

    def required_documents_list(self, obj):
        from .models import CATEGORY_REQUIRED_DOCS
        required = CATEGORY_REQUIRED_DOCS.get(obj.category, [])
        submitted_types = set(obj.documents.values_list('doc_type', flat=True))
        items = []
        for doc_code in required:
            ok = doc_code in submitted_types
            icon = '✅' if ok else '❌'
            doc_obj = obj.documents.filter(doc_type=doc_code).first()
            if doc_obj and doc_obj.file:
                link = format_html(
                    ' <a href="{}" target="_blank" style="font-size:11px;color:#7c3aed">'
                    '[View]</a>', doc_obj.file.url
                )
            else:
                link = ''
            items.append(format_html(
                '<li style="margin-bottom:4px">{} {} {}</li>',
                icon, doc_code.replace('_', ' ').title(), link,
            ))
        return format_html('<ul style="margin:0;padding-left:18px">{}</ul>', *items) if items else '—'
    required_documents_list.short_description = 'Required Documents'

    # ── Bulk admin actions ────────────────────────────────────────────────────

    @admin.action(description='✅ Approve selected applications & generate passes')
    def action_approve_and_generate(self, request, queryset):
        allowed = queryset.exclude(status__in=['REJECTED'])
        count = 0
        for app in allowed:
            app.status = 'APPROVED'
            app.reviewed_by = request.user
            app.reviewed_at = timezone.now()
            app.admin_remark = 'Approved via admin panel.'
            app.save()
            PassVerificationLog.objects.create(
                application=app,
                admin=request.user,
                action='APPROVED',
                remark='Approved via admin bulk action.',
            )
            _generate_pass_for_application(app, request.user)
            count += 1
        self.message_user(
            request,
            f'{count} application(s) approved and passes generated.',
            messages.SUCCESS,
        )

    @admin.action(description='🔍 Start review on selected applications')
    def action_start_review(self, request, queryset):
        updated = queryset.filter(status='PENDING').update(
            status='UNDER_VERIFICATION',
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )
        for app in queryset.filter(status='UNDER_VERIFICATION'):
            PassVerificationLog.objects.get_or_create(
                application=app,
                action='STARTED_REVIEW',
                defaults={'admin': request.user, 'remark': 'Review started via admin panel.'},
            )
        self.message_user(request, f'{updated} application(s) moved to Under Review.', messages.SUCCESS)

    @admin.action(description='❌ Reject selected applications')
    def action_reject(self, request, queryset):
        count = 0
        for app in queryset.exclude(status='APPROVED'):
            app.status = 'REJECTED'
            app.reviewed_by = request.user
            app.reviewed_at = timezone.now()
            app.admin_remark = 'Rejected via admin panel.'
            app.save()
            PassVerificationLog.objects.create(
                application=app,
                admin=request.user,
                action='REJECTED',
                remark='Rejected via admin bulk action.',
            )
            try:
                from apps.notifications.models import Notification
                Notification.objects.create(
                    title='Application Rejected',
                    message=(
                        f'Your pass application {app.application_number} has been rejected. '
                        'Please contact the depot for more information.'
                    ),
                    user=app.passenger,
                    depot=app.depot,
                )
            except Exception:
                pass
            count += 1
        self.message_user(request, f'{count} application(s) rejected.', messages.WARNING)

    @admin.action(description='📄 Request document re-upload from passenger')
    def action_request_reupload(self, request, queryset):
        count = 0
        for app in queryset.exclude(status__in=['APPROVED', 'REJECTED']):
            app.status = 'REUPLOAD_REQUESTED'
            app.reviewed_by = request.user
            app.reviewed_at = timezone.now()
            app.admin_remark = 'Additional documents requested via admin panel.'
            app.save()
            PassVerificationLog.objects.create(
                application=app,
                admin=request.user,
                action='REUPLOAD_REQUESTED',
                remark='Document re-upload requested via admin panel.',
            )
            try:
                from apps.notifications.models import Notification
                Notification.objects.create(
                    title='Documents Required',
                    message=(
                        f'Additional documents are required for your pass application '
                        f'{app.application_number}. Please re-upload the required documents.'
                    ),
                    user=app.passenger,
                    depot=app.depot,
                )
            except Exception:
                pass
            count += 1
        self.message_user(request, f'{count} application(s) flagged for re-upload.', messages.WARNING)

    def save_model(self, request, obj, form, change):
        """Track who made the last admin change."""
        if change:
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
        super().save_model(request, obj, form, change)


# ─────────────────────────────────────────────────────────────────────────────
# Pass Document Admin — individual document management
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(PassDocument)
class PassDocumentAdmin(admin.ModelAdmin):
    """
    Manage individual documents.
    Admins can verify / unverify each document, view the file inline.
    """
    list_display = [
        'application_link', 'doc_type_display', 'is_verified',
        'file_preview', 'uploaded_at',
    ]
    list_filter = ['doc_type', 'is_verified', 'application__depot']
    search_fields = [
        'application__application_number',
        'application__passenger__name',
        'application__passenger__email',
    ]
    readonly_fields = ['application', 'doc_type', 'file_link_large', 'uploaded_at', 'updated_at']
    fields = ['application', 'doc_type', 'is_verified', 'file_link_large', 'uploaded_at']
    list_editable = ['is_verified']

    def application_link(self, obj):
        url = reverse('admin:passes_passapplication_change', args=[obj.application_id])
        return format_html(
            '<a href="{}" style="font-weight:600;color:#7c3aed">{}</a>',
            url, obj.application.application_number,
        )
    application_link.short_description = 'Application'
    application_link.admin_order_field = 'application__application_number'

    def doc_type_display(self, obj):
        return obj.get_doc_type_display()
    doc_type_display.short_description = 'Document Type'

    def file_preview(self, obj):
        if not obj.file:
            return '—'
        name = obj.file.name.split('/')[-1]
        return format_html(
            '<a href="{}" target="_blank" '
            'style="color:#7c3aed;font-size:12px;font-weight:600">📎 {}</a>',
            obj.file.url, name[:30] + ('…' if len(name) > 30 else ''),
        )
    file_preview.short_description = 'File'

    def file_link_large(self, obj):
        if not obj.file:
            return '—'
        return format_html(
            '<a href="{}" target="_blank" class="button" '
            'style="background:#7c3aed;color:white;padding:6px 14px;'
            'border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">'
            '📄 View / Download Document</a>',
            obj.file.url,
        )
    file_link_large.short_description = 'Document File'


# ─────────────────────────────────────────────────────────────────────────────
# Verification Log Admin — read-only audit trail
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(PassVerificationLog)
class PassVerificationLogAdmin(admin.ModelAdmin):
    list_display = ['application', 'action_badge', 'admin', 'remark_short', 'created_at']
    list_filter = ['action', 'application__depot']
    search_fields = ['application__application_number', 'admin__name']
    readonly_fields = ['application', 'admin', 'action', 'remark', 'created_at']
    ordering = ['-created_at']

    def action_badge(self, obj):
        colors = {
            'SUBMITTED':           ('#374151', '#f3f4f6'),
            'STARTED_REVIEW':      ('#7c3aed', '#ede9fe'),
            'APPROVED':            ('#059669', '#d1fae5'),
            'REJECTED':            ('#dc2626', '#fee2e2'),
            'REUPLOAD_REQUESTED':  ('#d97706', '#fef3c7'),
            'DOCUMENTS_REUPLOADED': ('#2563eb', '#dbeafe'),
            'PASS_GENERATED':      ('#059669', '#d1fae5'),
        }
        fg, bg = colors.get(obj.action, ('#374151', '#f3f4f6'))
        return format_html(
            '<span style="background:{};color:{};padding:2px 8px;border-radius:10px;'
            'font-size:11px;font-weight:700">{}</span>',
            bg, fg, obj.get_action_display(),
        )
    action_badge.short_description = 'Action'

    def remark_short(self, obj):
        return obj.remark[:60] + '…' if len(obj.remark) > 60 else obj.remark
    remark_short.short_description = 'Remark'

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Generated Pass Admin
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(GeneratedPass)
class GeneratedPassAdmin(admin.ModelAdmin):
    list_display = [
        'pass_number', 'passenger_name', 'category', 'duration',
        'depot', 'valid_from', 'valid_to', 'price_display',
        'days_remaining_display', 'status_badge',
    ]
    list_filter = ['status', 'category', 'duration', 'depot']
    search_fields = ['pass_number', 'passenger__name', 'passenger__email']
    readonly_fields = [
        'pass_number', 'qr_code_image', 'passenger',
        'application_link', 'issued_by', 'created_at', 'updated_at',
    ]
    fieldsets = (
        ('Pass Info', {
            'fields': (
                'pass_number', 'application_link',
                'passenger', ('category', 'duration'),
                ('depot', 'route'),
                ('valid_from', 'valid_to'),
                ('price', 'status'),
                'issued_by',
            ),
        }),
        ('QR Code', {
            'fields': ('qr_code_image',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    actions = ['action_revoke_passes']

    def passenger_name(self, obj):
        return obj.passenger.name
    passenger_name.short_description = 'Passenger'
    passenger_name.admin_order_field = 'passenger__name'

    def price_display(self, obj):
        return format_html('<strong>₹{}</strong>', obj.price)
    price_display.short_description = 'Price'

    def days_remaining_display(self, obj):
        days = obj.days_remaining
        color = 'green' if days > 7 else ('orange' if days > 0 else 'red')
        return format_html(
            '<span style="color:{};font-weight:600">{}</span>',
            color, f'{days}d' if obj.is_valid else 'Expired',
        )
    days_remaining_display.short_description = 'Days Left'

    def status_badge(self, obj):
        colors = {
            'ACTIVE':  ('#059669', '#d1fae5'),
            'EXPIRED': ('#6b7280', '#f3f4f6'),
            'REVOKED': ('#dc2626', '#fee2e2'),
        }
        fg, bg = colors.get(obj.status, ('#374151', '#f3f4f6'))
        return format_html(
            '<span style="background:{};color:{};padding:2px 8px;border-radius:10px;'
            'font-size:11px;font-weight:700">{}</span>',
            bg, fg, obj.status,
        )
    status_badge.short_description = 'Status'

    def application_link(self, obj):
        if obj.application:
            url = reverse('admin:passes_passapplication_change', args=[obj.application_id])
            return format_html(
                '<a href="{}" style="color:#7c3aed;font-weight:600">{}</a>',
                url, obj.application.application_number,
            )
        return '—'
    application_link.short_description = 'Source Application'

    def qr_code_image(self, obj):
        if obj.qr_code:
            return format_html(
                '<img src="data:image/png;base64,{}" '
                'style="width:150px;height:150px;border:1px solid #e5e7eb;border-radius:8px">',
                obj.qr_code,
            )
        return '—'
    qr_code_image.short_description = 'QR Code'

    @admin.action(description='🚫 Revoke selected passes')
    def action_revoke_passes(self, request, queryset):
        updated = queryset.filter(status='ACTIVE').update(status='REVOKED')
        self.message_user(request, f'{updated} pass(es) revoked.', messages.WARNING)


# ─────────────────────────────────────────────────────────────────────────────
# Supporting models
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(Pass)
class PassAdmin(admin.ModelAdmin):
    list_display = ['pass_number', 'passenger', 'pass_type', 'depot', 'valid_from', 'valid_to', 'status']
    list_filter = ['status', 'pass_type', 'depot']
    search_fields = ['pass_number', 'passenger__name', 'passenger__email']
    readonly_fields = ['pass_number', 'qr_code', 'created_at', 'updated_at']


@admin.register(PassPricing)
class PassPricingAdmin(admin.ModelAdmin):
    list_display = ['category', 'duration', 'depot', 'area', 'price', 'is_active']
    list_filter = ['category', 'duration', 'depot', 'is_active']
    search_fields = ['category', 'area']


@admin.register(DailyPass)
class DailyPassAdmin(admin.ModelAdmin):
    list_display = ['pass_number', 'passenger', 'pass_type', 'depot', 'price', 'valid_date', 'status']
    list_filter = ['status', 'pass_type', 'depot']
    search_fields = ['pass_number', 'passenger__name', 'passenger__email']
    readonly_fields = ['pass_number', 'qr_code', 'created_at', 'updated_at']

