-- =============================================
-- TABLE DEFINITIONS
-- =============================================

CREATE TABLE IF NOT EXISTS school (
    school_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_name TEXT
);

CREATE TABLE IF NOT EXISTS "user" (
    net_id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    phone_number TEXT NOT NULL DEFAULT '',
    school_id UUID REFERENCES school(school_id)
);

CREATE TABLE IF NOT EXISTS domain (
    email_domain TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS location (
    location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS urgency (
    urgency_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    urgency TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS type (
    type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    semester_valid TEXT
);

CREATE TABLE IF NOT EXISTS discount (
    discount_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_rate REAL NOT NULL DEFAULT 0,
    begin_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS status (
    status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS listing (
    listing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_net_id TEXT NOT NULL REFERENCES "user"(net_id),
    preferred_location_id UUID NOT NULL DEFAULT gen_random_uuid() REFERENCES location(location_id),
    urgency_id UUID REFERENCES urgency(urgency_id),
    type_id UUID REFERENCES type(type_id),
    discount_id UUID REFERENCES discount(discount_id),
    amount TEXT NOT NULL,
    price REAL NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    posted_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiration_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE TABLE IF NOT EXISTS transaction (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id TEXT REFERENCES "user"(net_id),
    listing_id UUID REFERENCES listing(listing_id),
    status_id UUID REFERENCES status(status_id),
    buyer_confirm BOOLEAN DEFAULT FALSE,
    seller_confirm BOOLEAN DEFAULT FALSE,
    transaction_time TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comment (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rating REAL,
    comment TEXT,
    transaction_id UUID REFERENCES transaction(transaction_id)
);

-- =============================================
-- VIEWS
-- =============================================

CREATE OR REPLACE VIEW active_listings_with_details AS
SELECT l.listing_id, l.price, l.amount, l.posted_date, l.expiration_date, l.seller_net_id,
    loc.location, u.urgency, d.discount_rate, t.type, t.semester_valid
FROM listing l
LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
LEFT JOIN urgency u ON l.urgency_id = u.urgency_id
LEFT JOIN discount d ON l.discount_id = d.discount_id
LEFT JOIN type t ON l.type_id = t.type_id
WHERE l.is_active = TRUE;

-- =============================================
-- FUNCTIONS & TRIGGERS (PL/pgSQL)
-- =============================================

CREATE OR REPLACE FUNCTION ensure_current_user_row()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_net_id TEXT;
BEGIN
    v_net_id := split_part(auth.email(), '@', 1);
    INSERT INTO "user" (net_id, first_name, last_name, phone_number)
    VALUES (v_net_id, '', '', '')
    ON CONFLICT (net_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION auto_create_user_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_net_id TEXT;
BEGIN
    v_net_id := split_part(NEW.email, '@', 1);
    INSERT INTO "user" (net_id, first_name, last_name, phone_number)
    VALUES (v_net_id, '', '', '')
    ON CONFLICT (net_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auto_create_user_on_signup();

CREATE OR REPLACE FUNCTION auto_expire_listings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE listing
    SET is_active = FALSE
    WHERE expiration_date < NOW() AND is_active = TRUE;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_avg_rating(p_net_id TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_avg_rating NUMERIC;
BEGIN
    SELECT AVG(c.rating) INTO v_avg_rating
    FROM comment c
    JOIN transaction t ON c.transaction_id = t.transaction_id
    JOIN listing l ON t.listing_id = l.listing_id
    WHERE l.seller_net_id = p_net_id;
    RETURN COALESCE(v_avg_rating, 0);
END;
$$;

-- =============================================
-- STORED PROCEDURES (PL/pgSQL)
-- =============================================

CREATE OR REPLACE PROCEDURE complete_transaction(p_transaction_id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
    v_listing_id UUID;
    v_status_id UUID;
BEGIN
    SELECT status_id INTO v_status_id FROM status WHERE status_name = 'Completed';
    UPDATE transaction
    SET status_id = v_status_id, seller_confirm = TRUE
    WHERE transaction_id = p_transaction_id
    RETURNING listing_id INTO v_listing_id;
    UPDATE listing SET is_active = FALSE WHERE listing_id = v_listing_id;
    COMMIT;
END;
$$;

CREATE OR REPLACE PROCEDURE cancel_transaction(p_transaction_id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status_id UUID;
BEGIN
    SELECT status_id INTO v_status_id FROM status WHERE status_name = 'Cancelled';
    UPDATE transaction
    SET status_id = v_status_id, buyer_confirm = FALSE, seller_confirm = FALSE
    WHERE transaction_id = p_transaction_id;
    COMMIT;
END;
$$;

-- =============================================
-- SELECT QUERIES (used in app)
-- =============================================

-- Get all active listings with details
SELECT l.listing_id, l.price, l.amount, l.is_active, l.posted_date, l.expiration_date, l.seller_net_id,
    loc.location, u.urgency, d.discount_rate, t.type, t.semester_valid
FROM listing l
LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
LEFT JOIN urgency u ON l.urgency_id = u.urgency_id
LEFT JOIN discount d ON l.discount_id = d.discount_id
LEFT JOIN type t ON l.type_id = t.type_id
WHERE l.is_active = TRUE
ORDER BY l.posted_date DESC;

-- Get transactions for a buyer (with status)
SELECT t.listing_id, s.status_name
FROM transaction t
JOIN status s ON t.status_id = s.status_id
WHERE t.buyer_id = 'buyer_net_id';

-- Get all statuses
SELECT status_id, status_name FROM status;

-- Get listings for a specific seller
SELECT l.listing_id, l.price, l.amount, l.is_active, l.posted_date, l.expiration_date, l.seller_net_id,
    loc.location_id, loc.location, u.urgency_id, u.urgency, t.type_id, t.type
FROM listing l
LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
LEFT JOIN urgency u ON l.urgency_id = u.urgency_id
LEFT JOIN type t ON l.type_id = t.type_id
WHERE l.seller_net_id = 'seller_net_id'
ORDER BY l.posted_date DESC;

-- Get reference data dropdowns
SELECT location_id, location FROM location;
SELECT urgency_id, urgency FROM urgency;
SELECT type_id, type FROM type;

-- Count pending transactions for a seller
SELECT COUNT(t.transaction_id)
FROM transaction t
WHERE t.listing_id IN (
    SELECT listing_id FROM listing WHERE seller_net_id = 'seller_net_id'
)
AND t.status_id = (SELECT status_id FROM status WHERE status_name = 'Pending');

-- Get active listings for a seller (for transaction creation)
SELECT l.listing_id, l.price, l.amount, l.is_active, l.seller_net_id, l.preferred_location_id,
    l.urgency_id, l.type_id, loc.location_id, loc.location, u.urgency_id, u.urgency, t.type_id, t.type
FROM listing l
LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
LEFT JOIN urgency u ON l.urgency_id = u.urgency_id
LEFT JOIN type t ON l.type_id = t.type_id
WHERE l.seller_net_id = 'seller_net_id' AND l.is_active = TRUE
ORDER BY l.price ASC;

-- Get buyer's transaction history with full details
SELECT t.transaction_id, t.buyer_id, t.listing_id, t.buyer_confirm, t.seller_confirm, t.transaction_time,
    s.status_id, s.status_name, l.price, l.amount, l.seller_net_id, loc.location, ty.type
FROM transaction t
LEFT JOIN status s ON t.status_id = s.status_id
LEFT JOIN listing l ON t.listing_id = l.listing_id
LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
LEFT JOIN type ty ON l.type_id = ty.type_id
WHERE t.buyer_id = 'buyer_net_id'
ORDER BY t.transaction_time DESC;

-- Get seller's incoming transactions with buyer info
SELECT t.transaction_id, t.buyer_id, t.listing_id, t.buyer_confirm, t.seller_confirm, t.transaction_time,
    s.status_id, s.status_name, l.price, l.amount, l.seller_net_id, loc.location, ty.type,
    u.net_id, u.first_name, u.last_name
FROM transaction t
LEFT JOIN status s ON t.status_id = s.status_id
LEFT JOIN listing l ON t.listing_id = l.listing_id
LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
LEFT JOIN type ty ON l.type_id = ty.type_id
LEFT JOIN "user" u ON t.buyer_id = u.net_id
WHERE t.listing_id IN (
    SELECT listing_id FROM listing WHERE seller_net_id = 'seller_net_id'
)
ORDER BY t.transaction_time DESC;

-- Get all allowed email domains
SELECT email_domain FROM domain;

-- Get comments/ratings for a transaction
SELECT c.comment_id, c.rating, c.comment, c.transaction_id
FROM comment c
WHERE c.transaction_id = 'transaction_uuid';

-- Get average seller rating
SELECT AVG(c.rating) AS avg_rating
FROM comment c
JOIN transaction t ON c.transaction_id = t.transaction_id
JOIN listing l ON t.listing_id = l.listing_id
WHERE l.seller_net_id = 'seller_net_id';

-- =============================================
-- INSERT SAMPLE DATA
-- =============================================

INSERT INTO school (school_id, school_name) VALUES
(gen_random_uuid(), 'New York University'),
(gen_random_uuid(), 'Columbia University'),
(gen_random_uuid(), 'Cornell University'),
(gen_random_uuid(), 'University of Michigan'),
(gen_random_uuid(), 'University of Illinois Urbana-Champaign'),
(gen_random_uuid(), 'Stanford University'),
(gen_random_uuid(), 'Massachusetts Institute of Technology'),
(gen_random_uuid(), 'Harvard University'),
(gen_random_uuid(), 'Yale University'),
(gen_random_uuid(), 'Princeton University'),
(gen_random_uuid(), 'University of Chicago'),
(gen_random_uuid(), 'UC Berkeley'),
(gen_random_uuid(), 'University of Pennsylvania');

INSERT INTO domain (email_domain) VALUES
('nyu.edu'),
('illinois.edu'),
('umich.edu'),
('columbia.edu'),
('cornell.edu'),
('stanford.edu'),
('mit.edu'),
('harvard.edu'),
('yale.edu'),
('princeton.edu'),
('uchicago.edu'),
('berkeley.edu'),
('upenn.edu')
ON CONFLICT DO NOTHING;

INSERT INTO "user" (net_id, first_name, last_name, phone_number) VALUES
('jd1234', 'John', 'Doe', '2125550101'),
('as5678', 'Alice', 'Smith', '2125550102'),
('mb9012', 'Mike', 'Brown', '2125550103'),
('el3456', 'Emma', 'Lee', '2125550104'),
('rk7890', 'Ryan', 'Kim', '2125550105');

INSERT INTO location (location) VALUES
('Third North Dining Hall'),
('Weinstein Dining Hall'),
('Lipton Dining Hall'),
('Palladium Dining Hall'),
('Brittany Dining Hall');

INSERT INTO urgency (urgency) VALUES
('Urgent'),
('High'),
('Medium'),
('Low'),
('No Rush'),
('Critical'),
('Very High'),
('Moderate'),
('Minimal'),
('Flexible'),
('ASAP'),
('Same Day'),
('This Week')
ON CONFLICT DO NOTHING;

INSERT INTO type (type, semester_valid) VALUES
('Guest Meal', 'Spring 2026'),
('Dining Dollar', 'Spring 2026'),
('Meal Swipe', 'Spring 2026'),
('Weekly Swipe', 'Spring 2026'),
('Faculty Meal', 'Spring 2026'),
('Late Night Swipe', 'Spring 2026'),
('Brunch Swipe', 'Fall 2026'),
('Summer Dining Credit', 'Summer 2026'),
('Catering Credit', 'Spring 2026'),
('Commuter Meal', 'Fall 2026')
ON CONFLICT DO NOTHING;

INSERT INTO discount (discount_rate, begin_date, end_date) VALUES
(0.0000, '2026-01-01 00:00:00+00', '2026-12-31 23:59:59+00'),
(0.1000, '2026-01-15 00:00:00+00', '2026-05-15 23:59:59+00'),
(0.2000, '2026-02-01 00:00:00+00', '2026-06-30 23:59:59+00'),
(0.1500, '2026-03-01 00:00:00+00', '2026-08-31 23:59:59+00');

INSERT INTO status (status_name) VALUES
('Pending'),
('Confirmed'),
('Completed'),
('Cancelled'),
('Disputed'),
('Expired'),
('Processing'),
('Refunded'),
('On Hold'),
('Awaiting Payment'),
('In Transit')
ON CONFLICT DO NOTHING;

INSERT INTO listing (seller_net_id, preferred_location_id, urgency_id, type_id, discount_id, amount, price, is_active, posted_date, expiration_date)
VALUES (
    'jd1234',
    (SELECT location_id FROM location WHERE location = 'Third North Dining Hall'),
    (SELECT urgency_id FROM urgency WHERE urgency = 'Medium'),
    (SELECT type_id FROM type WHERE type = 'Meal Swipe'),
    (SELECT discount_id FROM discount WHERE discount_rate = 0.0000 LIMIT 1),
    '3', 5.00, TRUE, '2026-04-01 10:00:00+00', '2026-05-01 10:00:00+00'
);

INSERT INTO listing (seller_net_id, preferred_location_id, urgency_id, type_id, discount_id, amount, price, is_active, posted_date, expiration_date)
VALUES (
    'as5678',
    (SELECT location_id FROM location WHERE location = 'Weinstein Dining Hall'),
    (SELECT urgency_id FROM urgency WHERE urgency = 'Urgent'),
    (SELECT type_id FROM type WHERE type = 'Guest Meal'),
    (SELECT discount_id FROM discount WHERE discount_rate = 0.1000 LIMIT 1),
    '1', 4.00, TRUE, '2026-04-02 11:00:00+00', '2026-05-02 11:00:00+00'
);

INSERT INTO listing (seller_net_id, preferred_location_id, urgency_id, type_id, discount_id, amount, price, is_active, posted_date, expiration_date)
VALUES (
    'mb9012',
    (SELECT location_id FROM location WHERE location = 'Lipton Dining Hall'),
    (SELECT urgency_id FROM urgency WHERE urgency = 'No Rush'),
    (SELECT type_id FROM type WHERE type = 'Dining Dollar'),
    (SELECT discount_id FROM discount WHERE discount_rate = 0.2000 LIMIT 1),
    '5', 6.50, TRUE, '2026-04-03 09:00:00+00', '2026-05-03 09:00:00+00'
);

INSERT INTO listing (seller_net_id, preferred_location_id, urgency_id, type_id, discount_id, amount, price, is_active, posted_date, expiration_date)
VALUES (
    'el3456',
    (SELECT location_id FROM location WHERE location = 'Palladium Dining Hall'),
    (SELECT urgency_id FROM urgency WHERE urgency = 'High'),
    (SELECT type_id FROM type WHERE type = 'Weekly Swipe'),
    (SELECT discount_id FROM discount WHERE discount_rate = 0.1500 LIMIT 1),
    '2', 4.50, TRUE, '2026-04-04 14:00:00+00', '2026-05-04 14:00:00+00'
);

INSERT INTO listing (seller_net_id, preferred_location_id, urgency_id, type_id, discount_id, amount, price, is_active, posted_date, expiration_date)
VALUES (
    'rk7890',
    (SELECT location_id FROM location WHERE location = 'Brittany Dining Hall'),
    (SELECT urgency_id FROM urgency WHERE urgency = 'Low'),
    (SELECT type_id FROM type WHERE type = 'Meal Swipe'),
    (SELECT discount_id FROM discount WHERE discount_rate = 0.0000 LIMIT 1),
    '4', 5.50, FALSE, '2026-03-20 08:00:00+00', '2026-04-20 08:00:00+00'
);

INSERT INTO transaction (buyer_id, listing_id, status_id, buyer_confirm, seller_confirm, transaction_time)
VALUES (
    'as5678',
    (SELECT listing_id FROM listing WHERE seller_net_id = 'jd1234' LIMIT 1),
    (SELECT status_id FROM status WHERE status_name = 'Confirmed'),
    TRUE, TRUE, '2026-04-05 12:00:00+00'
);

INSERT INTO transaction (buyer_id, listing_id, status_id, buyer_confirm, seller_confirm, transaction_time)
VALUES (
    'rk7890',
    (SELECT listing_id FROM listing WHERE seller_net_id = 'as5678' LIMIT 1),
    (SELECT status_id FROM status WHERE status_name = 'Pending'),
    FALSE, FALSE, '2026-04-06 13:00:00+00'
);

INSERT INTO transaction (buyer_id, listing_id, status_id, buyer_confirm, seller_confirm, transaction_time)
VALUES (
    'jd1234',
    (SELECT listing_id FROM listing WHERE seller_net_id = 'mb9012' LIMIT 1),
    (SELECT status_id FROM status WHERE status_name = 'Completed'),
    TRUE, TRUE, '2026-04-07 15:00:00+00'
);

INSERT INTO transaction (buyer_id, listing_id, status_id, buyer_confirm, seller_confirm, transaction_time)
VALUES (
    'mb9012',
    (SELECT listing_id FROM listing WHERE seller_net_id = 'el3456' LIMIT 1),
    (SELECT status_id FROM status WHERE status_name = 'Cancelled'),
    FALSE, FALSE, '2026-04-08 10:00:00+00'
);

INSERT INTO transaction (buyer_id, listing_id, status_id, buyer_confirm, seller_confirm, transaction_time)
VALUES (
    'el3456',
    (SELECT listing_id FROM listing WHERE seller_net_id = 'jd1234' LIMIT 1),
    (SELECT status_id FROM status WHERE status_name = 'Pending'),
    FALSE, FALSE, '2026-04-09 16:00:00+00'
);

INSERT INTO comment (rating, comment, transaction_id) VALUES
(4.5, 'Great transaction, smooth and easy!',
    (SELECT transaction_id FROM transaction WHERE buyer_id = 'as5678' LIMIT 1)),
(5.0, 'Seller was very responsive and reliable.',
    (SELECT transaction_id FROM transaction WHERE buyer_id = 'jd1234' LIMIT 1)),
(3.0, 'Transaction was okay, took a bit longer than expected.',
    (SELECT transaction_id FROM transaction WHERE buyer_id = 'mb9012' LIMIT 1));

-- =============================================
-- INSERT TEMPLATE STATEMENTS (used in app)
-- =============================================

INSERT INTO listing (seller_net_id, preferred_location_id, urgency_id, type_id, amount, price, is_active, posted_date, expiration_date)
VALUES ('seller_net_id', 'location_uuid', 'urgency_uuid', 'type_uuid', '3', 5.00, TRUE, NOW(), NOW() + INTERVAL '30 days');

INSERT INTO transaction (buyer_id, listing_id, status_id, buyer_confirm, seller_confirm)
VALUES ('buyer_net_id', 'listing_uuid', 'pending_status_uuid', FALSE, FALSE);

INSERT INTO "user" (net_id, first_name, last_name, phone_number)
VALUES ('new_net_id', '', '', '')
ON CONFLICT (net_id) DO NOTHING;

INSERT INTO comment (rating, comment, transaction_id)
VALUES (4.0, 'Transaction went smoothly.', 'transaction_uuid');

-- =============================================
-- UPDATE STATEMENTS (used in app)
-- =============================================

-- Update listing details
UPDATE listing
SET preferred_location_id = 'new_location_uuid', urgency_id = 'new_urgency_uuid', type_id = 'new_type_uuid', amount = '4', price = 6.00
WHERE listing_id = 'listing_uuid';

-- Deactivate a listing
UPDATE listing SET is_active = FALSE WHERE listing_id = 'listing_uuid';

-- Deactivate all expired listings
UPDATE listing SET is_active = FALSE WHERE expiration_date < NOW() AND is_active = TRUE;

-- Seller confirms a transaction
UPDATE transaction
SET status_id = 'confirmed_status_uuid', seller_confirm = TRUE
WHERE transaction_id = 'transaction_uuid';

-- Cancel a transaction
UPDATE transaction SET status_id = 'cancelled_status_uuid' WHERE transaction_id = 'transaction_uuid';

-- Complete a transaction (seller side)
UPDATE transaction
SET status_id = 'completed_status_uuid', seller_confirm = TRUE
WHERE transaction_id = 'transaction_uuid';

-- Buyer confirms receipt
UPDATE transaction SET buyer_confirm = TRUE WHERE transaction_id = 'transaction_uuid';

-- Update user profile info
UPDATE "user"
SET first_name = 'Updated', last_name = 'Name', phone_number = '2125559999'
WHERE net_id = 'user_net_id';

-- Assign a school to a user
UPDATE "user"
SET school_id = (SELECT school_id FROM school WHERE school_name = 'New York University')
WHERE net_id = 'user_net_id';

-- Update discount validity window
UPDATE discount
SET begin_date = '2026-05-01 00:00:00+00', end_date = '2026-08-31 23:59:59+00'
WHERE discount_id = 'discount_uuid';

-- Update a comment/rating
UPDATE comment
SET rating = 5.0, comment = 'Updated review after reflection.'
WHERE comment_id = 'comment_uuid';

-- =============================================
-- DELETE STATEMENTS (used in app)
-- =============================================

-- Delete a listing
DELETE FROM listing WHERE listing_id = 'listing_uuid';

-- Delete an inactive listing
DELETE FROM listing WHERE listing_id = 'listing_uuid' AND is_active = FALSE;

-- Delete a cancelled transaction
DELETE FROM transaction
WHERE transaction_id = 'transaction_uuid'
AND status_id = (SELECT status_id FROM status WHERE status_name = 'Cancelled');

-- Delete a comment
DELETE FROM comment WHERE comment_id = 'comment_uuid';

-- Remove a domain from the allowed list
DELETE FROM domain WHERE email_domain = 'removed.edu';

-- Remove a user (cascades to listings/transactions if configured)
DELETE FROM "user" WHERE net_id = 'user_net_id';
