"""
Deployment helper: Load all fixtures in the correct order.

Run this after `python manage.py migrate` on a fresh deployment:
    python manage.py loaddata_all

Or use individual Django loaddata:
    python manage.py loaddata depots/fixtures/depots.json
    python manage.py loaddata routes/fixtures/routes.json
"""

from django.core.management.base import BaseCommand
from django.core.management import call_command
import os


FIXTURES = [
    # (app_label, fixture_path)
    ('depots',  'apps/depots/fixtures/depots.json'),
    ('routes',  'apps/routes/fixtures/routes.json'),
]


class Command(BaseCommand):
    help = 'Load all PMPL data fixtures into a fresh database (use after deploy + migrate)'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('\n=== Loading SMTS Fixtures ===\n'))

        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(
            os.path.dirname(os.path.abspath(__file__))
        )))

        for label, rel_path in FIXTURES:
            abs_path = os.path.join(base_dir, rel_path)
            if not os.path.exists(abs_path):
                self.stdout.write(self.style.ERROR(
                    f'  [SKIP] {rel_path} not found. Run seed_all first to generate it.'
                ))
                continue

            size_kb = os.path.getsize(abs_path) // 1024
            self.stdout.write(f'  Loading {label} ({size_kb} KB)...')
            call_command('loaddata', abs_path, verbosity=0)
            self.stdout.write(self.style.SUCCESS(f'  [OK] {label} loaded'))

        self.stdout.write(self.style.SUCCESS(
            '\n=== All fixtures loaded successfully! ==='
        ))
        self.stdout.write(
            '\nNext steps after deploy:\n'
            '  1. python manage.py migrate\n'
            '  2. python manage.py loaddata_all\n'
            '  3. python manage.py createsuperuser\n'
        )
