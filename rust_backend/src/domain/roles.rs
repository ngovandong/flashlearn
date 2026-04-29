//! Role constants mirroring `backend/constants/role.py`.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserRole {
    Edit,
    ViewOnly,
}

impl UserRole {
    pub fn as_char(self) -> char {
        match self {
            UserRole::Edit => 'E',
            UserRole::ViewOnly => 'V',
        }
    }

    pub fn from_char(c: char) -> Option<Self> {
        match c {
            'E' => Some(UserRole::Edit),
            'V' => Some(UserRole::ViewOnly),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FullRole {
    Edit,
    ViewOnly,
    Owner,
}

impl FullRole {
    pub fn as_char(self) -> char {
        match self {
            FullRole::Edit => 'E',
            FullRole::ViewOnly => 'V',
            FullRole::Owner => 'O',
        }
    }

    pub fn from_char(c: char) -> Option<Self> {
        match c {
            'E' => Some(FullRole::Edit),
            'V' => Some(FullRole::ViewOnly),
            'O' => Some(FullRole::Owner),
            _ => None,
        }
    }
}
