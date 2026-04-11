CREATE TABLE IF NOT EXISTS "user" (
    net_id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    phone_number TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS domain (
    domain_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_domain TEXT NOT NULL UNIQUE
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
    discount_rate NUMERIC(5, 4) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS status (
    status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS listing (
    listing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_net_id TEXT NOT NULL REFERENCES "user"(net_id),
    preferred_location_id UUID NOT NULL REFERENCES location(location_id),
    urgency_id UUID REFERENCES urgency(urgency_id),
    type_id UUID REFERENCES type(type_id),
    discount_id UUID REFERENCES discount(discount_id),
    amount TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    posted_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiration_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE TABLE IF NOT EXISTS transaction (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id TEXT NOT NULL REFERENCES "user"(net_id),
    listing_id UUID NOT NULL REFERENCES listing(listing_id),
    status_id UUID NOT NULL REFERENCES status(status_id),
    buyer_confirm BOOLEAN NOT NULL DEFAULT FALSE,
    seller_confirm BOOLEAN NOT NULL DEFAULT FALSE,
    transaction_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT l.listing_id, l.price, l.amount, l.is_active, l.posted_date, l.expiration_date, l.seller_net_id,
    loc.location, u.urgency, d.discount_rate, t.type, t.semester_valid
FROM listing l
LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
LEFT JOIN urgency u ON l.urgency_id = u.urgency_id
LEFT JOIN discount d ON l.discount_id = d.discount_id
LEFT JOIN type t ON l.type_id = t.type_id
WHERE l.is_active = TRUE
ORDER BY l.posted_date DESC;

SELECT t.listing_id, s.status_name
FROM transaction t
JOIN status s ON t.status_id = s.status_id
WHERE t.buyer_id = 'buyer_net_id';

SELECT status_id, status_name FROM status;

SELECT l.listing_id, l.price, l.amount, l.is_active, l.posted_date, l.expiration_date, l.seller_net_id,
    loc.location_id, loc.location, u.urgency_id, u.urgency, t.type_id, t.type
FROM listing l
LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
LEFT JOIN urgency u ON l.urgency_id = u.urgency_id
LEFT JOIN type t ON l.type_id = t.type_id
WHERE l.seller_net_id = 'seller_net_id'
ORDER BY l.posted_date DESC;

SELECT location_id, location FROM location;
SELECT urgency_id, urgency FROM urgency;
SELECT type_id, type FROM type;

SELECT COUNT(t.transaction_id)
FROM transaction t
WHERE t.listing_id IN (
    SELECT listing_id FROM listing WHERE seller_net_id = 'seller_net_id'
)
AND t.status_id = (SELECT status_id FROM status WHERE status_name = 'Pending');

SELECT l.listing_id, l.price, l.amount, l.is_active, l.seller_net_id, l.preferred_location_id,
    l.urgency_id, l.type_id, loc.location_id, loc.location, u.urgency_id, u.urgency, t.type_id, t.type
FROM listing l
LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
LEFT JOIN urgency u ON l.urgency_id = u.urgency_id
LEFT JOIN type t ON l.type_id = t.type_id
WHERE l.seller_net_id = 'seller_net_id' AND l.is_active = TRUE
ORDER BY l.price ASC;

SELECT t.transaction_id, t.buyer_id, t.listing_id, t.buyer_confirm, t.seller_confirm, t.transaction_time,
    s.status_id, s.status_name, l.price, l.amount, l.seller_net_id, loc.location, ty.type
FROM transaction t
LEFT JOIN status s ON t.status_id = s.status_id
LEFT JOIN listing l ON t.listing_id = l.listing_id
LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
LEFT JOIN type ty ON l.type_id = ty.type_id
WHERE t.buyer_id = 'buyer_net_id'
ORDER BY t.transaction_time DESC;

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

SELECT email_domain FROM domain;

INSERT INTO domain (email_domain) VALUES
('nyu.edu'),
('illinois.edu'),
('umich.edu'),
('columbia.edu'),
('cornell.edu');

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
('No Rush');

INSERT INTO type (type, semester_valid) VALUES
('Guest Meal', 'Spring 2026'),
('Dining Dollar', 'Spring 2026'),
('Meal Swipe', 'Spring 2026'),
('Weekly Swipe', 'Spring 2026');

INSERT INTO discount (discount_rate) VALUES
(0.0000),
(0.1000),
(0.2000),
(0.1500);

INSERT INTO status (status_name) VALUES
('Pending'),
('Confirmed'),
('Completed'),
('Cancelled');

INSERT INTO listing (seller_net_id, preferred_location_id, urgency_id, type_id, discount_id, amount, price, is_active, posted_date, expiration_date)
VALUES (
    'jd1234',
    (SELECT location_id FROM location WHERE location = 'Third North Dining Hall'),
    (SELECT urgency_id FROM urgency WHERE urgency = 'Medium'),
    (SELECT type_id FROM type WHERE type = 'Meal Swipe'),
    (SELECT discount_id FROM discount WHERE discount_rate = 0.0000),
    '3', 5.00, TRUE, '2026-04-01 10:00:00+00', '2026-05-01 10:00:00+00'
);

INSERT INTO listing (seller_net_id, preferred_location_id, urgency_id, type_id, discount_id, amount, price, is_active, posted_date, expiration_date)
VALUES (
    'as5678',
    (SELECT location_id FROM location WHERE location = 'Weinstein Dining Hall'),
    (SELECT urgency_id FROM urgency WHERE urgency = 'Urgent'),
    (SELECT type_id FROM type WHERE type = 'Guest Meal'),
    (SELECT discount_id FROM discount WHERE discount_rate = 0.1000),
    '1', 4.00, TRUE, '2026-04-02 11:00:00+00', '2026-05-02 11:00:00+00'
);

INSERT INTO listing (seller_net_id, preferred_location_id, urgency_id, type_id, discount_id, amount, price, is_active, posted_date, expiration_date)
VALUES (
    'mb9012',
    (SELECT location_id FROM location WHERE location = 'Lipton Dining Hall'),
    (SELECT urgency_id FROM urgency WHERE urgency = 'No Rush'),
    (SELECT type_id FROM type WHERE type = 'Dining Dollar'),
    (SELECT discount_id FROM discount WHERE discount_rate = 0.2000),
    '5', 6.50, TRUE, '2026-04-03 09:00:00+00', '2026-05-03 09:00:00+00'
);

INSERT INTO listing (seller_net_id, preferred_location_id, urgency_id, type_id, discount_id, amount, price, is_active, posted_date, expiration_date)
VALUES (
    'el3456',
    (SELECT location_id FROM location WHERE location = 'Palladium Dining Hall'),
    (SELECT urgency_id FROM urgency WHERE urgency = 'High'),
    (SELECT type_id FROM type WHERE type = 'Weekly Swipe'),
    (SELECT discount_id FROM discount WHERE discount_rate = 0.1500),
    '2', 4.50, TRUE, '2026-04-04 14:00:00+00', '2026-05-04 14:00:00+00'
);

INSERT INTO listing (seller_net_id, preferred_location_id, urgency_id, type_id, discount_id, amount, price, is_active, posted_date, expiration_date)
VALUES (
    'rk7890',
    (SELECT location_id FROM location WHERE location = 'Brittany Dining Hall'),
    (SELECT urgency_id FROM urgency WHERE urgency = 'Low'),
    (SELECT type_id FROM type WHERE type = 'Meal Swipe'),
    (SELECT discount_id FROM discount WHERE discount_rate = 0.0000),
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

INSERT INTO listing (seller_net_id, preferred_location_id, urgency_id, type_id, amount, price, is_active, posted_date, expiration_date)
VALUES ('seller_net_id', 'location_uuid', 'urgency_uuid', 'type_uuid', '3', 5.00, TRUE, NOW(), NOW() + INTERVAL '30 days');

INSERT INTO transaction (buyer_id, listing_id, status_id, buyer_confirm, seller_confirm)
VALUES ('buyer_net_id', 'listing_uuid', 'pending_status_uuid', FALSE, FALSE);

INSERT INTO "user" (net_id, first_name, last_name, phone_number)
VALUES ('new_net_id', '', '', '')
ON CONFLICT (net_id) DO NOTHING;

UPDATE listing
SET preferred_location_id = 'new_location_uuid', urgency_id = 'new_urgency_uuid', type_id = 'new_type_uuid', amount = '4', price = 6.00
WHERE listing_id = 'listing_uuid';

UPDATE listing SET is_active = FALSE WHERE listing_id = 'listing_uuid';

UPDATE transaction
SET status_id = 'confirmed_status_uuid', seller_confirm = TRUE
WHERE transaction_id = 'transaction_uuid';

UPDATE transaction SET status_id = 'cancelled_status_uuid' WHERE transaction_id = 'transaction_uuid';

UPDATE transaction
SET status_id = 'completed_status_uuid', seller_confirm = TRUE
WHERE transaction_id = 'transaction_uuid';

UPDATE transaction SET buyer_confirm = TRUE WHERE transaction_id = 'transaction_uuid';

DELETE FROM listing WHERE listing_id = 'listing_uuid';

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

CREATE OR REPLACE VIEW active_listings_with_details AS
SELECT l.listing_id, l.price, l.amount, l.posted_date, l.expiration_date, l.seller_net_id,
    loc.location, u.urgency, d.discount_rate, t.type, t.semester_valid
FROM listing l
LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
LEFT JOIN urgency u ON l.urgency_id = u.urgency_id
LEFT JOIN discount d ON l.discount_id = d.discount_id
LEFT JOIN type t ON l.type_id = t.type_id
WHERE l.is_active = TRUE;

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
