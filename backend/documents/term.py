from django_elasticsearch_dsl import Document, fields
from django_elasticsearch_dsl.registries import registry
from ..models import Term


@registry.register_document
class TermDocument(Document):
    deck = fields.ObjectField(properties={
        'id': fields.TextField(),
        'name': fields.TextField(),
    })
    deck_id = fields.TextField()

    class Index:
        name = 'terms'
        settings = {
            'number_of_shards': 3,
            'number_of_replicas': 1,
        }

    class Django:
        model = Term
        fields = [
            'id',
            'name',
            'description',
            'image'
        ]
