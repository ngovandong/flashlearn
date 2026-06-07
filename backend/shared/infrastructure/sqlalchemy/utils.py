from uuid import UUID


def as_uuid(value) -> UUID | str:
    if value is None:
        return ""
    if isinstance(value, UUID):
        return value
    text_value = str(value)
    if len(text_value) == 32:
        return UUID(hex=text_value)
    return UUID(text_value)


def normalize_uuid(value) -> str:
    if isinstance(value, UUID):
        return str(value).replace("-", "")
    return str(value).replace("-", "") if value is not None else value
