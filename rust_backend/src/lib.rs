//! Flashlearn server library — DDD-style layers: domain, application, infrastructure, interfaces.

pub mod application;
pub mod auth;
pub mod config;
pub mod domain;
pub mod error;
pub mod infrastructure;
pub mod interfaces;
pub mod state;
pub mod util;

pub use error::{AppError, AppResult};
