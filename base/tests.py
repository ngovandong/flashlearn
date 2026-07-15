import uuid
from types import SimpleNamespace
from typing import Any, cast

from django.test import SimpleTestCase
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

from base.models.custom_model import Char32UUIDField


class Char32UUIDFieldTest(SimpleTestCase):
    def setUp(self):
        self.field = Char32UUIDField()
        self.value = uuid.UUID("12345678-1234-5678-1234-567812345678")

    def test_prepares_hex_for_mariadb_native_uuid_connection(self):
        connection = cast(
            Any,
            SimpleNamespace(
                vendor="mysql",
                features=SimpleNamespace(has_native_uuid_field=True),
            ),
        )

        self.assertEqual(self.field.get_db_prep_value(self.value, connection), self.value.hex)

    def test_prepares_hex_for_mysql_connection(self):
        connection = cast(
            Any,
            SimpleNamespace(
                vendor="mysql",
                features=SimpleNamespace(has_native_uuid_field=False),
            ),
        )

        self.assertEqual(self.field.get_db_prep_value(self.value, connection), self.value.hex)

    def test_simplejwt_user_foreign_key_uses_compatible_uuid_field(self):
        user_field = cast(Any, OutstandingToken._meta.get_field("user"))

        self.assertIsInstance(user_field.target_field, Char32UUIDField)
