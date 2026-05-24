USER_ROLE_CHOICES = (
    ("E", "Edit"),
    ("V", "ViewOnly"),
)

FULL_ROLE_CHOICES = (
    ("E", "Edit"),
    ("V", "ViewOnly"),
    ("O", "Owner"),
)


class FULL_ROLE_CLASS:
    EDIT = "E"
    VIEW_ONLY = "V"
    OWNER = "O"
