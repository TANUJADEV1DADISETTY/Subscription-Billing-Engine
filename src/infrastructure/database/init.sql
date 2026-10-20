-- Database Schema Initialization
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    stripe_customer_id VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    base_price DECIMAL(10, 2) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Seed Data for Testing and Verification
-- User 1: Expired subscription (valid for renewal)
INSERT INTO users (id, stripe_customer_id)
VALUES ('user-expired-001', 'cus_stripe_expired_001')
ON CONFLICT (id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id;

INSERT INTO subscriptions (id, user_id, base_price, expires_at)
VALUES ('sub-expired-001', 'user-expired-001', 100.00, '2023-01-01 00:00:00+00')
ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, base_price = EXCLUDED.base_price, expires_at = EXCLUDED.expires_at;

-- User 2: Active / Unexpired subscription (cannot be renewed yet)
INSERT INTO users (id, stripe_customer_id)
VALUES ('user-unexpired-002', 'cus_stripe_unexpired_002')
ON CONFLICT (id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id;

INSERT INTO subscriptions (id, user_id, base_price, expires_at)
VALUES ('sub-unexpired-002', 'user-unexpired-002', 150.00, '2099-12-31 23:59:59+00')
ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, base_price = EXCLUDED.base_price, expires_at = EXCLUDED.expires_at;

-- Additional Seed Users for demonstration / testing edge cases
INSERT INTO users (id, stripe_customer_id)
VALUES ('user-december-discount-003', 'cus_stripe_discount_003')
ON CONFLICT (id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id;

INSERT INTO subscriptions (id, user_id, base_price, expires_at)
VALUES ('sub-discount-003', 'user-december-discount-003', 200.00, '2022-12-01 00:00:00+00')
ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, base_price = EXCLUDED.base_price, expires_at = EXCLUDED.expires_at;
