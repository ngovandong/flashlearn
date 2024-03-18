from django_elasticsearch_dsl import Document, fields
from django_elasticsearch_dsl.registries import registry
from ..models import Deck


@registry.register_document
class DeckDocument(Document):
    owner = fields.ObjectField(properties={
        'id': fields.TextField(),
        'name': fields.TextField(),
        'first_name': fields.TextField(),
        'last_name': fields.TextField(),
        'username': fields.TextField(),
        'email': fields.TextField(),
    })
    users = fields.NestedField(properties={
        'id': fields.TextField(),
        'first_name': fields.TextField(),
        'last_name': fields.TextField(),
        'username': fields.TextField(),
        'email': fields.TextField(),
    })

    class Index:
        name = 'decks'
        settings = {
            'number_of_shards': 1,
            'number_of_replicas': 1,
        }

    class Django:
        model = Deck
        fields = [
            'id',
            'name',
            'field',
            'description',
            'is_public',
        ]
