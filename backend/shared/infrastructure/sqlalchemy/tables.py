from django.db import models
from sqlalchemy import MetaData, Table

from .engine import get_engine

metadata = MetaData()
_tables: dict[str, Table] = {}


def table_for_model(model: type[models.Model]) -> Table:
    """Reflect a Django model's DB table into a SQLAlchemy Core Table.

    Prefer ``Model.sa_table`` (or ``Model.table``) on Django model classes.
    """
    table_name = model._meta.db_table
    if table_name not in _tables:
        _tables[table_name] = Table(table_name, metadata, autoload_with=get_engine())
    return _tables[table_name]


class SQLAlchemyTableDescriptor:
    """Class-level descriptor backing ``Model.sa_table`` and ``Model.table``."""

    def __get__(self, instance, owner: type[models.Model] | None = None):
        model = owner if owner is not None else type(instance)
        return table_for_model(model)


class SQLAlchemyTableMixin:
    """Mixin that exposes reflected SQLAlchemy Core tables on Django models."""

    sa_table = SQLAlchemyTableDescriptor()
    table = sa_table
