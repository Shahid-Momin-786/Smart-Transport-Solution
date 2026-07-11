from rest_framework import viewsets, permissions, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

from .models import (
    Pass, PassPricing, DailyPass, PassApplication,
    PassDocument, PassVerificationLog, GeneratedPass,
    CATEGORY_REQUIRED_DOCS,
)
from .serializers import (
    PassSerializer, CreatePassSerializer, VerifyPassSerializer,
    PassPricingSerializer,
    DailyPassSerializer, CreateDailyPassSerializer,
    PassApplicationSerializer, CreatePassApplicationSerializer,
    AdminReviewSerializer, PassDocumentSerializer,
    PassVerificationLogSerializer, GeneratedPassSerializer,
)

User = get_user_model()


# ─── Permission helpers ───────────────────────────────────────────────────────

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_superuser or request.user.role == 'ADMIN'
        )


class IsPassenger(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'PASSENGER'


# ─── Original Pass ViewSet (backward compat) ─────────────────────────────────

class PassViewSet(viewsets.ModelViewSet):
    serializer_class = PassSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'pass_type', 'depot', 'passenger']
    search_fields = ['pass_number', 'passenger__name', 'passenger__email']
    ordering_fields = ['created_at', 'valid_from', 'valid_to', 'pass_type']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in ['my_passes', 'retrieve']:
            return [permissions.IsAuthenticated()]
        if self.action == 'verify':
            return [permissions.IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        user = self.request.user
        qs = Pass.objects.select_related('passenger', 'depot', 'route').all()
        if user.is_superuser:
            return qs
        if user.role == 'ADMIN':
            return qs.filter(depot=user.depot)
        return qs.filter(passenger=user)

    def create(self, request, *args, **kwargs):
        serializer = CreatePassSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            passenger = User.objects.get(id=data['passenger'], role='PASSENGER', depot=request.user.depot)
        except User.DoesNotExist:
            return Response({'error': 'Passenger not found in your depot.'}, status=status.HTTP_404_NOT_FOUND)

        pass_obj = Pass.objects.create(
            passenger=passenger,
            depot=request.user.depot,
            pass_type=data['pass_type'],
            valid_from=data['valid_from'],
            valid_to=data['valid_to'],
            fare=data['fare'],
            student_id=data.get('student_id', ''),
            route_id=data.get('route'),
        )
        return Response(PassSerializer(pass_obj, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_passes(self, request):
        passes = Pass.objects.filter(passenger=request.user)
        page = self.paginate_queryset(passes)
        if page is not None:
            serializer = PassSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        serializer = PassSerializer(passes, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def verify(self, request):
        serializer = VerifyPassSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            pass_obj = Pass.objects.get(pass_number=serializer.validated_data['pass_number'])
            return Response({
                'valid': pass_obj.is_valid,
                'pass': PassSerializer(pass_obj, context={'request': request}).data,
            })
        except Pass.DoesNotExist:
            return Response({'valid': False, 'error': 'Pass not found.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        pass_obj = self.get_object()
        pass_obj.status = 'REVOKED'
        pass_obj.save()
        return Response(PassSerializer(pass_obj).data)


# ─── Pass Pricing ViewSet ─────────────────────────────────────────────────────

class PassPricingViewSet(viewsets.ModelViewSet):
    serializer_class = PassPricingSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'duration', 'depot', 'is_active']
    ordering = ['category', 'duration']

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        user = self.request.user
        qs = PassPricing.objects.select_related('depot').filter(is_active=True)
        if user.is_superuser:
            return PassPricing.objects.select_related('depot').all()
        if user.role == 'ADMIN':
            from django.db.models import Q
            return PassPricing.objects.select_related('depot').filter(
                Q(depot=user.depot) | Q(depot__isnull=True)
            )
        return qs


# ─── Daily Pass ViewSet ───────────────────────────────────────────────────────

DAILY_PASS_PRICES = {
    'CITY': 70,
    'EXTENDED': 150,
}


class DailyPassViewSet(viewsets.ModelViewSet):
    serializer_class = DailyPassSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['status', 'pass_type', 'depot']
    ordering = ['-created_at']
    http_method_names = ['get', 'post', 'head', 'options']

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = DailyPass.objects.select_related('passenger', 'depot', 'route').all()
        if user.is_superuser:
            return qs
        if user.role == 'ADMIN':
            return qs.filter(depot=user.depot)
        return qs.filter(passenger=user)

    def create(self, request, *args, **kwargs):
        serializer = CreateDailyPassSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        price = DAILY_PASS_PRICES.get(data['pass_type'], 70)
        today = timezone.now().date()

        daily_pass = DailyPass.objects.create(
            passenger=request.user,
            depot=data['depot'],
            route=data.get('route'),
            pass_type=data['pass_type'],
            source=data.get('source', ''),
            destination=data.get('destination', ''),
            price=price,
            valid_date=today,
            status='ACTIVE',
        )
        return Response(
            DailyPassSerializer(daily_pass, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_daily_passes(self, request):
        qs = DailyPass.objects.filter(passenger=request.user).order_by('-created_at')
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(
                DailyPassSerializer(page, many=True, context={'request': request}).data
            )
        return Response(DailyPassSerializer(qs, many=True, context={'request': request}).data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def pricing(self, request):
        """Return price for each daily pass type."""
        return Response({
            'CITY': {'label': 'City Pass', 'price': DAILY_PASS_PRICES['CITY']},
            'EXTENDED': {'label': 'Extended Area Pass', 'price': DAILY_PASS_PRICES['EXTENDED']},
        })


# ─── Pass Application ViewSet ─────────────────────────────────────────────────

class PassApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = PassApplicationSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'category', 'duration', 'depot']
    search_fields = ['application_number', 'passenger__name', 'passenger__email']
    ordering = ['-created_at']

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = PassApplication.objects.select_related(
            'passenger', 'depot', 'route', 'pricing', 'reviewed_by'
        ).prefetch_related('documents', 'verification_logs')
        if user.is_superuser:
            return qs
        if user.role == 'ADMIN':
            return qs.filter(depot=user.depot)
        return qs.filter(passenger=user)

    def create(self, request, *args, **kwargs):
        if request.user.role != 'PASSENGER':
            return Response({'error': 'Only passengers can submit applications.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = CreatePassApplicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Find best matching price
        pricing = None
        try:
            pricing = PassPricing.objects.get(
                category=data['category'],
                duration=data['duration'],
                depot=data['depot'],
                is_active=True,
            )
        except PassPricing.DoesNotExist:
            try:
                pricing = PassPricing.objects.get(
                    category=data['category'],
                    duration=data['duration'],
                    depot__isnull=True,
                    is_active=True,
                )
            except PassPricing.DoesNotExist:
                pass

        application = PassApplication.objects.create(
            passenger=request.user,
            depot=data['depot'],
            route=data.get('route'),
            category=data['category'],
            duration=data['duration'],
            area=data.get('area', ''),
            pricing=pricing,
            calculated_price=pricing.price if pricing else 0,
            status='PENDING',
        )

        # Log submission
        PassVerificationLog.objects.create(
            application=application,
            admin=None,
            action='SUBMITTED',
            remark='Application submitted by passenger.',
        )

        # Notify admins
        self._notify_admins(application)

        return Response(
            PassApplicationSerializer(application, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    def _notify_admins(self, application):
        """Send notification to depot admins about new application."""
        from apps.notifications.models import Notification
        admins = User.objects.filter(depot=application.depot, role='ADMIN', is_active=True)
        notifications = [
            Notification(
                title='New Pass Application',
                message=f"New {application.get_category_display()} pass application ({application.application_number}) submitted by {application.passenger.name}.",
                user=admin,
                depot=application.depot,
            )
            for admin in admins
        ]
        if notifications:
            Notification.objects.bulk_create(notifications)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def review(self, request, pk=None):
        application = self.get_object()
        serializer = AdminReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        action_map = {
            'start_review': ('UNDER_VERIFICATION', 'STARTED_REVIEW'),
            'approve': ('APPROVED', 'APPROVED'),
            'reject': ('REJECTED', 'REJECTED'),
            'request_reupload': ('REUPLOAD_REQUESTED', 'REUPLOAD_REQUESTED'),
        }

        if data['action'] not in action_map:
            return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)

        new_status, log_action = action_map[data['action']]

        # Validate required remark for reject
        if data['action'] == 'reject' and not data.get('remark'):
            return Response({'error': 'Rejection reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        application.status = new_status
        application.admin_remark = data.get('remark', '')
        application.reviewed_by = request.user
        application.reviewed_at = timezone.now()
        application.save()

        PassVerificationLog.objects.create(
            application=application,
            admin=request.user,
            action=log_action,
            remark=data.get('remark', ''),
        )

        # If approved, generate the pass
        if data['action'] == 'approve':
            self._generate_pass(application, data, request.user)

        # Notify passenger
        self._notify_passenger(application, data['action'])

        return Response(
            PassApplicationSerializer(application, context={'request': request}).data
        )

    def _generate_pass(self, application, data, admin):
        """Auto-generate pass after approval."""
        from django.utils import timezone as tz
        today = data.get('valid_from') or tz.now().date()
        duration_days = {
            'MONTHLY': 30,
            '3MONTHS': 90,
            '6MONTHS': 180,
            'YEARLY': 365,
        }
        days = duration_days.get(application.duration, 30)

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
            issued_by=admin,
        )

        PassVerificationLog.objects.create(
            application=application,
            admin=admin,
            action='PASS_GENERATED',
            remark=f'Pass {gen_pass.pass_number} generated.',
        )

    def _notify_passenger(self, application, action_key):
        """Notify passenger about application status change."""
        from apps.notifications.models import Notification
        messages = {
            'start_review': ('Application Under Review', f'Your pass application {application.application_number} is now under review.'),
            'approve': ('Pass Approved! 🎉', f'Your {application.get_category_display()} pass application {application.application_number} has been approved. Your pass is now ready.'),
            'reject': ('Application Rejected', f'Your pass application {application.application_number} has been rejected. Reason: {application.admin_remark}'),
            'request_reupload': ('Documents Required', f'Additional documents are required for your pass application {application.application_number}. Reason: {application.admin_remark}'),
        }
        if action_key in messages:
            title, message = messages[action_key]
            Notification.objects.create(
                title=title,
                message=message,
                user=application.passenger,
                depot=application.depot,
            )

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_applications(self, request):
        qs = PassApplication.objects.filter(passenger=request.user).prefetch_related('documents', 'verification_logs')
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(
                PassApplicationSerializer(page, many=True, context={'request': request}).data
            )
        return Response(PassApplicationSerializer(qs, many=True, context={'request': request}).data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def required_docs(self, request):
        """Return required documents for each category."""
        return Response(CATEGORY_REQUIRED_DOCS)


# ─── Pass Document Upload ViewSet ─────────────────────────────────────────────

class PassDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = PassDocumentSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = PassDocument.objects.select_related('application').all()
        if user.is_superuser:
            return qs
        if user.role == 'ADMIN':
            return qs.filter(application__depot=user.depot)
        return qs.filter(application__passenger=user)

    def create(self, request, *args, **kwargs):
        application_id = request.data.get('application')
        try:
            application = PassApplication.objects.get(
                id=application_id,
                passenger=request.user
            )
        except PassApplication.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Only allow uploads when pending or reupload requested
        if application.status not in ['PENDING', 'REUPLOAD_REQUESTED']:
            return Response(
                {'error': 'Documents can only be uploaded for pending or re-upload-requested applications.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        doc_type = request.data.get('doc_type')
        file = request.FILES.get('file')

        if not doc_type or not file:
            return Response({'error': 'doc_type and file are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Replace existing doc of same type
        PassDocument.objects.filter(application=application, doc_type=doc_type).delete()

        doc = PassDocument.objects.create(
            application=application,
            doc_type=doc_type,
            file=file,
        )

        # If re-upload, log it
        if application.status == 'REUPLOAD_REQUESTED':
            all_required = CATEGORY_REQUIRED_DOCS.get(application.category, [])
            submitted = list(application.documents.values_list('doc_type', flat=True))
            if all(d in submitted for d in all_required):
                application.status = 'PENDING'
                application.save()
                PassVerificationLog.objects.create(
                    application=application,
                    action='DOCUMENTS_REUPLOADED',
                    remark='Passenger re-uploaded all required documents.',
                )

        return Response(PassDocumentSerializer(doc, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def verify_document(self, request, pk=None):
        """
        POST /api/passes/documents/{id}/verify_document/

        Admin-only action to toggle is_verified on a single document.
        Body: { "is_verified": true | false }
        """
        doc = self.get_object()
        is_verified = request.data.get('is_verified')
        if is_verified is None:
            return Response(
                {'error': 'is_verified (bool) is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        doc.is_verified = bool(is_verified)
        doc.save(update_fields=['is_verified'])
        return Response(PassDocumentSerializer(doc, context={'request': request}).data)



# ─── Generated Pass ViewSet ───────────────────────────────────────────────────

class GeneratedPassViewSet(viewsets.ModelViewSet):
    serializer_class = GeneratedPassSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'category', 'depot']
    search_fields = ['pass_number', 'passenger__name', 'passenger__email']
    ordering = ['-created_at']
    http_method_names = ['get', 'post', 'head', 'options']

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = GeneratedPass.objects.select_related('passenger', 'depot', 'route', 'application', 'issued_by').all()
        if user.is_superuser:
            return qs
        if user.role == 'ADMIN':
            return qs.filter(depot=user.depot)
        return qs.filter(passenger=user)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_generated_passes(self, request):
        qs = GeneratedPass.objects.filter(passenger=request.user).order_by('-created_at')
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(
                GeneratedPassSerializer(page, many=True, context={'request': request}).data
            )
        return Response(GeneratedPassSerializer(qs, many=True, context={'request': request}).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def revoke(self, request, pk=None):
        pass_obj = self.get_object()
        pass_obj.status = 'REVOKED'
        pass_obj.save()
        return Response(GeneratedPassSerializer(pass_obj).data)
