from django.db import connection
from uuid import UUID

def execute_raw_sql(query: str, **kwargs):
    kwargs = {
        k: str(v).replace("-", "") if isinstance(v, UUID) else v
        for k, v in kwargs.items()
    }
    
    with connection.cursor() as cursor:
        cursor.execute(query.format(**kwargs))
        row = cursor.fetchall()

    return row
