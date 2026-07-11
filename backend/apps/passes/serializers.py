from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from .models import (
    Pass, PassPricing, DailyPass, PassApplication,
    PassDocument, PassVerificationLog, GeneratedPass,
    CATEGORY_REQUIRED_DOCS,
)


# ─── Original Pass serializer (backward compat) ───────────────────────────────

class PassSerializer(serializers.ModelSerializer):
    passenger_name = serializers.CharField(source='passenger.name', read_only=True)
    passenger_email = serializers.CharField(source='passenger.email', read_only=True)
    passenger_photo = serializers.SerializerMethodField()
    depot_name = serializers.CharField(source='depot.name', read_only=True)
    route_number = serializers.CharField(source='route.route_number', read_only=True)
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = Pass
        fields = '__all__'
        read_only_fields = ['pass_number', 'qr_code', 'created_at', 'updated_at']

    def get_passenger_photo(self, obj):
        request = self.context.get('request')
        if obj.passenger.profile_image and request:
            return request.build_absolute_uri(obj.passenger.profile_image.url)
        return None


class CreatePassSerializer(serializers.Serializer):
    passenger = serializers.UUIDField()
    pass_type = serializers.ChoiceField(choices=['WEEKLY', 'MONTHLY', 'STUDENT'])
    valid_from = serializers.DateField()
    route = serializers.IntegerField(required=False, allow_null=True)
    student_id = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        valid_from = attrs['valid_from']
        pass_type = attrs['pass_type']
        if pass_type == 'WEEKLY':
            attrs['valid_to'] = valid_from + timedelta(days=7)
            attrs['fare'] = 150
        elif pass_type == 'MONTHLY':
            attrs['valid_to'] = valid_from + timedelta(days=30)
            attrs['fare'] = 500
        elif pass_type == 'STUDENT':
            attrs['valid_to'] = valid_from + timedelta(days=30)
            attrs['fare'] = 250
        return attrs


class VerifyPassSerializer(serializers.Serializer):
    pass_number = serializers.CharField()


# ─── Pass Pricing ─────────────────────────────────────────────────────────────

class PassPricingSerializer(serializers.ModelSerializer):
    depot_name = serializers.CharField(source='depot.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    duration_display = serializers.CharField(source='get_duration_display', read_only=True)

    class Meta:
        model = PassPricing
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


# ─── Daily Pass ───────────────────────────────────────────────────────────────

class DailyPassSerializer(serializers.ModelSerializer):
    passenger_name = serializers.CharField(source='passenger.name', read_only=True)
    passenger_email = serializers.CharField(source='passenger.email', read_only=True)
    depot_name = serializers.CharField(source='depot.name', read_only=True)
    route_number = serializers.CharField(source='route.route_number', read_only=True)
    pass_type_display = serializers.CharField(source='get_pass_type_display', read_only=True)
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = DailyPass
        fields = '__all__'
        read_only_fields = ['pass_number', 'qr_code', 'created_at', 'updated_at']


class CreateDailyPassSerializer(serializers.Serializer):
    depot = serializers.IntegerField()
    route = serializers.IntegerField(required=False, allow_null=True)
    pass_type = serializers.ChoiceField(choices=['CITY', 'EXTENDED'])
    source = serializers.CharField(max_length=200, required=False, allow_blank=True)
    destination = serializers.CharField(max_length=200, required=False, allow_blank=True)

    def validate_depot(self, value):
        from apps.depots.models import Depot
        try:
            return Depot.objects.get(id=value, is_active=True)
        except Depot.DoesNotExist:
            raise serializers.ValidationError('Invalid or inactive depot.')

    def validate_route(self, value):
        if value is None:
            return None
        from apps.routes.models import Route
        try:
            return Route.objects.get(id=value)
        except Route.DoesNotExist:
            raise serializers.ValidationError('Invalid route.')


# ─── Pass Application ─────────────────────────────────────────────────────────

class PassDocumentSerializer(serializers.ModelSerializer):
    doc_type_display = serializers.CharField(source='get_doc_type_display', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = PassDocument
        fields = '__all__'
        read_only_fields = ['uploaded_at', 'updated_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class PassVerificationLogSerializer(serializers.ModelSerializer):
    admin_name = serializers.CharField(source='admin.name', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = PassVerificationLog
        fields = '__all__'
        read_only_fields = ['created_at']


class PassApplicationSerializer(serializers.ModelSerializer):
    passenger_name = serializers.CharField(source='passenger.name', read_only=True)
    passenger_email = serializers.CharField(source='passenger.email', read_only=True)
    passenger_phone = serializers.CharField(source='passenger.phone', read_only=True)
    depot_name = serializers.CharField(source='depot.name', read_only=True)
    route_number = serializers.CharField(source='route.route_number', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    duration_display = serializers.CharField(source='get_duration_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    documents = PassDocumentSerializer(many=True, read_only=True)
    verification_logs = PassVerificationLogSerializer(many=True, read_only=True)
    required_docs = serializers.SerializerMethodField()
    has_generated_pass = serializers.SerializerMethodField()

    class Meta:
        model = PassApplication
        fields = '__all__'
        read_only_fields = [
            'application_number', 'status', 'admin_remark',
            'reviewed_by', 'reviewed_at', 'created_at', 'updated_at'
        ]

    def get_required_docs(self, obj):
        return CATEGORY_REQUIRED_DOCS.get(obj.category, [])

    def get_has_generated_pass(self, obj):
        return hasattr(obj, 'generated_pass') and obj.generated_pass is not None


class CreatePassApplicationSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=PassApplication.CATEGORY_CHOICES)
    duration = serializers.ChoiceField(choices=PassApplication.DURATION_CHOICES)
    depot = serializers.IntegerField()
    route = serializers.IntegerField(required=False, allow_null=True)
    area = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate_depot(self, value):
        from apps.depots.models import Depot
        try:
            return Depot.objects.get(id=value, is_active=True)
        except Depot.DoesNotExist:
            raise serializers.ValidationError('Invalid or inactive depot.')

    def validate_route(self, value):
        if value is None:
            return None
        from apps.routes.models import Route
        try:
            return Route.objects.get(id=value)
        except Route.DoesNotExist:
            raise serializers.ValidationError('Invalid route.')


class AdminReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['approve', 'reject', 'request_reupload', 'start_review'])
    remark = serializers.CharField(required=False, allow_blank=True)
    valid_from = serializers.DateField(required=False)


# ─── Generated Pass ───────────────────────────────────────────────────────────

class GeneratedPassSerializer(serializers.ModelSerializer):
    passenger_name = serializers.CharField(source='passenger.name', read_only=True)
    passenger_email = serializers.CharField(source='passenger.email', read_only=True)
    depot_name = serializers.CharField(source='depot.name', read_only=True)
    route_number = serializers.CharField(source='route.route_number', read_only=True)
    issued_by_name = serializers.CharField(source='issued_by.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    duration_display = serializers.CharField(source='get_duration_display', read_only=True)
    is_valid = serializers.BooleanField(read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)
    application_number = serializers.CharField(source='application.application_number', read_only=True)

    class Meta:
        model = GeneratedPass
        fields = '__all__'
        read_only_fields = ['pass_number', 'qr_code', 'created_at', 'updated_at']
