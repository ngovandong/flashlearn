//! Django-compatible `pbkdf2_sha256$...` password hashing.

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use constant_time_eq::constant_time_eq;
use pbkdf2::pbkdf2_hmac;
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
use sha2::Sha256;

/// Verify a plain password against Django's encoded string (e.g. `pbkdf2_sha256$600000$salt$hash`).
pub fn verify(password: &str, encoded: &str) -> bool {
    if encoded.is_empty() || encoded.starts_with('!') {
        return false;
    }
    let parts: Vec<&str> = encoded.split('$').collect();
    if parts.len() != 4 {
        return false;
    }
    let algorithm = parts[0];
    if algorithm != "pbkdf2_sha256" {
        tracing::warn!("unsupported django hasher: {algorithm}");
        return false;
    }
    let iterations: u32 = match parts[1].parse() {
        Ok(i) => i,
        Err(_) => return false,
    };
    let salt = parts[2].as_bytes();
    let hash_b64 = parts[3];
    let expected = match B64.decode(hash_b64) {
        Ok(b) => b,
        Err(_) => return false,
    };
    let mut out = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, iterations, &mut out);
    constant_time_eq(&out, expected.as_slice())
}

/// Encode a new password compatible with Django's default PBKDF2 hasher.
pub fn encode(password: &str, iterations: u32) -> String {
    let salt: String = thread_rng()
        .sample_iter(&Alphanumeric)
        .take(22)
        .map(char::from)
        .collect();
    let mut out = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt.as_bytes(), iterations, &mut out);
    let hash_b64 = B64.encode(out);
    format!("pbkdf2_sha256${iterations}${salt}${hash_b64}")
}
