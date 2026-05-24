from uuid import UUID

from django.db import connection


def execute_raw_sql(query: str, params: list):
    params = [str(v).replace("-", "") if isinstance(v, UUID) else v for v in params]

    with connection.cursor() as cursor:
        cursor.execute(query, params)
        row = cursor.fetchall()

    return row
