from django.core.management.base import BaseCommand
from apps.depots.models import Depot
from apps.passes.models import PassPricing


PUNE_DEPOTS = [
    {'name': 'Swargate', 'code': 'SWG', 'city': 'Pune', 'address': 'Swargate, Pune'},
    {'name': 'Kothrud', 'code': 'KTH', 'city': 'Pune', 'address': 'Kothrud, Pune'},
    {'name': 'Hadapsar', 'code': 'HDP', 'city': 'Pune', 'address': 'Hadapsar, Pune'},
    {'name': 'Shivajinagar', 'code': 'SHV', 'city': 'Pune', 'address': 'Shivajinagar, Pune'},
    {'name': 'Nigdi', 'code': 'NGD', 'city': 'Pimpri-Chinchwad', 'address': 'Nigdi, Pune'},
    {'name': 'Pimpri', 'code': 'PMP', 'city': 'Pimpri-Chinchwad', 'address': 'Pimpri, Pune'},
    {'name': 'Bhosari', 'code': 'BHS', 'city': 'Pimpri-Chinchwad', 'address': 'Bhosari, Pune'},
    {'name': 'Wakad', 'code': 'WKD', 'city': 'Pimpri-Chinchwad', 'address': 'Wakad, Pune'},
    {'name': 'Hinjawadi', 'code': 'HJW', 'city': 'Pune', 'address': 'Hinjawadi, Pune'},
    {'name': 'Pune Station', 'code': 'PST', 'city': 'Pune', 'address': 'Pune Railway Station, Pune'},
    {'name': 'Katraj', 'code': 'KTJ', 'city': 'Pune', 'address': 'Katraj, Pune'},
]

# Default global pricing (depot=None)
DEFAULT_PRICING = [
    # Student
    {'category': 'STUDENT', 'duration': 'MONTHLY',   'price': 250},
    {'category': 'STUDENT', 'duration': '3MONTHS',   'price': 700},
    {'category': 'STUDENT', 'duration': '6MONTHS',   'price': 1300},
    {'category': 'STUDENT', 'duration': 'YEARLY',    'price': 2400},
    # Worker
    {'category': 'WORKER',  'duration': 'MONTHLY',   'price': 500},
    {'category': 'WORKER',  'duration': '3MONTHS',   'price': 1400},
    {'category': 'WORKER',  'duration': '6MONTHS',   'price': 2600},
    {'category': 'WORKER',  'duration': 'YEARLY',    'price': 4800},
    # General
    {'category': 'GENERAL', 'duration': 'MONTHLY',   'price': 600},
    {'category': 'GENERAL', 'duration': '3MONTHS',   'price': 1700},
    {'category': 'GENERAL', 'duration': '6MONTHS',   'price': 3200},
    {'category': 'GENERAL', 'duration': 'YEARLY',    'price': 6000},
    # Senior Citizen
    {'category': 'SENIOR_CITIZEN', 'duration': 'MONTHLY',   'price': 200},
    {'category': 'SENIOR_CITIZEN', 'duration': '3MONTHS',   'price': 550},
    {'category': 'SENIOR_CITIZEN', 'duration': '6MONTHS',   'price': 1000},
    {'category': 'SENIOR_CITIZEN', 'duration': 'YEARLY',    'price': 1800},
    # Disabled
    {'category': 'DISABLED', 'duration': 'MONTHLY',   'price': 150},
    {'category': 'DISABLED', 'duration': '3MONTHS',   'price': 400},
    {'category': 'DISABLED', 'duration': '6MONTHS',   'price': 750},
    {'category': 'DISABLED', 'duration': 'YEARLY',    'price': 1400},
]


class Command(BaseCommand):
    help = 'Seed Pune depots and default pass pricing into the database'

    def handle(self, *args, **options):
        created_depots = 0
        for depot_data in PUNE_DEPOTS:
            _, created = Depot.objects.get_or_create(
                code=depot_data['code'],
                defaults={
                    'name': depot_data['name'],
                    'city': depot_data['city'],
                    'address': depot_data['address'],
                    'is_active': True,
                }
            )
            if created:
                created_depots += 1

        self.stdout.write(self.style.SUCCESS(
            f'Depots: {created_depots} created, {len(PUNE_DEPOTS) - created_depots} already existed.'
        ))

        created_pricing = 0
        for p in DEFAULT_PRICING:
            _, created = PassPricing.objects.get_or_create(
                category=p['category'],
                duration=p['duration'],
                depot=None,
                defaults={'price': p['price'], 'is_active': True},
            )
            if created:
                created_pricing += 1

        self.stdout.write(self.style.SUCCESS(
            f'Pricing: {created_pricing} created, {len(DEFAULT_PRICING) - created_pricing} already existed.'
        ))
        self.stdout.write(self.style.SUCCESS('Seeding complete!'))
