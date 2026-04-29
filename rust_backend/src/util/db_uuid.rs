//! Django MySQL `UUIDField` is stored as `CHAR(32)` (hex without hyphens).
//! sqlx's `Uuid` maps to `BINARY(16)` on MySQL; use [`MysqlUuid`] in `FromRow` structs.

use serde::{Deserialize, Serialize};
use sqlx::encode::IsNull;
use sqlx::error::BoxDynError;
use sqlx::mysql::{MySql, MySqlTypeInfo, MySqlValueRef};
use sqlx::{Decode, Encode, Type};
use uuid::Uuid;

#[inline]
pub fn to_mysql_char(u: impl Into<Uuid>) -> String {
    u.into().simple().to_string()
}

/// UUID stored as Django-style `CHAR(32)` hex (not MySQL `BINARY(16)`).
#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct MysqlUuid(pub Uuid);

impl From<Uuid> for MysqlUuid {
    fn from(value: Uuid) -> Self {
        MysqlUuid(value)
    }
}

impl From<MysqlUuid> for Uuid {
    fn from(value: MysqlUuid) -> Self {
        value.0
    }
}

impl std::fmt::Display for MysqlUuid {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

impl std::ops::Deref for MysqlUuid {
    type Target = Uuid;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Type<MySql> for MysqlUuid {
    fn type_info() -> MySqlTypeInfo {
        <String as Type<MySql>>::type_info()
    }

    fn compatible(ty: &MySqlTypeInfo) -> bool {
        <String as Type<MySql>>::compatible(ty)
    }
}

impl<'q> Encode<'q, MySql> for MysqlUuid {
    fn encode_by_ref(
        &self,
        buf: &mut <MySql as sqlx::Database>::ArgumentBuffer<'q>,
    ) -> Result<IsNull, BoxDynError> {
        let s = to_mysql_char(self.0);
        <&str as Encode<MySql>>::encode_by_ref(&s.as_str(), buf)
    }

    fn size_hint(&self) -> usize {
        32
    }
}

impl<'r> Decode<'r, MySql> for MysqlUuid {
    fn decode(value: MySqlValueRef<'r>) -> Result<Self, BoxDynError> {
        let s = <String as Decode<MySql>>::decode(value)?;
        let u = Uuid::parse_str(s.trim()).map_err(|e| e.to_string())?;
        Ok(MysqlUuid(u))
    }
}
