-- table definitions

CREATE TABLE IF NOT EXISTS school (
    school_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_name TEXT
);

CREATE TABLE IF NOT EXISTS "user" (
    net_id       TEXT        PRIMARY KEY,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_name   TEXT        NOT NULL DEFAULT '',
    last_name    TEXT        NOT NULL,
    phone_number TEXT        NOT NULL,
    school_id    UUID        REFERENCES school(school_id)
);

CREATE TABLE IF NOT EXISTS domain (
    email_domain TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS location (
    location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS urgency (
    urgency_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    urgency    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS type (
    type_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type           TEXT NOT NULL,
    semester_valid TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS discount (
    discount_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_rate REAL        NOT NULL,
    begin_date    TIMESTAMPTZ NOT NULL,
    end_date      TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS status (
    status_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS listing (
    listing_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_net_id         TEXT        NOT NULL REFERENCES "user"(net_id),
    preferred_location_id UUID        NOT NULL DEFAULT gen_random_uuid() REFERENCES location(location_id),
    urgency_id            UUID        REFERENCES urgency(urgency_id),
    type_id               UUID        REFERENCES type(type_id),
    discount_id           UUID        REFERENCES discount(discount_id),
    amount                TEXT        NOT NULL,
    price                 REAL        NOT NULL,
    is_active             BOOLEAN     NOT NULL,
    posted_date           TIMESTAMPTZ NOT NULL,
    expiration_date       TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS transaction (
    transaction_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id         TEXT        REFERENCES "user"(net_id),
    listing_id       UUID        REFERENCES listing(listing_id),
    status_id        UUID        REFERENCES status(status_id),
    buyer_confirm    BOOLEAN,
    seller_confirm   BOOLEAN,
    transaction_time TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comment (
    comment_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rating         REAL NOT NULL,
    comment        TEXT NOT NULL,
    transaction_id UUID REFERENCES transaction(transaction_id)
);

-- functions and triggers

CREATE OR REPLACE FUNCTION ensure_current_user_row()
RETURNS VOID
LANGUAGE plpgsql
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

-- procedures

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

-- purchase_listing: atomic buy that prevents double-purchasing
-- uses SELECT FOR UPDATE to lock the row, then checks active + no existing open transaction
CREATE OR REPLACE FUNCTION purchase_listing(p_listing_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_buyer_net_id      TEXT;
    v_listing           listing%ROWTYPE;
    v_pending_status_id UUID;
    v_transaction_id    UUID;
    v_open_count        INT;
BEGIN
    v_buyer_net_id := split_part(auth.email(), '@', 1);

    INSERT INTO "user" (net_id, first_name, last_name, phone_number)
    VALUES (v_buyer_net_id, '', '', '')
    ON CONFLICT (net_id) DO NOTHING;

    SELECT * INTO v_listing FROM listing WHERE listing_id = p_listing_id FOR UPDATE;

    IF NOT FOUND OR NOT v_listing.is_active THEN
        RAISE EXCEPTION 'listing_unavailable';
    END IF;

    IF v_listing.seller_net_id = v_buyer_net_id THEN
        RAISE EXCEPTION 'cannot_buy_own_listing';
    END IF;

    SELECT COUNT(*) INTO v_open_count
    FROM transaction t
    JOIN status s ON t.status_id = s.status_id
    WHERE t.listing_id = p_listing_id
      AND s.status_name NOT IN ('Cancelled', 'Completed');

    IF v_open_count > 0 THEN
        RAISE EXCEPTION 'listing_unavailable';
    END IF;

    SELECT status_id INTO v_pending_status_id FROM status WHERE status_name = 'Pending';

    INSERT INTO transaction (buyer_id, listing_id, status_id, buyer_confirm, seller_confirm)
    VALUES (v_buyer_net_id, p_listing_id, v_pending_status_id, FALSE, FALSE)
    RETURNING transaction_id INTO v_transaction_id;

    RETURN v_transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_listing(UUID) TO authenticated;

-- select queries

-- curr active listings
SELECT l.listing_id, l.price, l.amount, l.is_active, l.posted_date, l.expiration_date, l.seller_net_id,
    loc.location, u.urgency, d.discount_rate, t.type, t.semester_valid
FROM listing l
LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
LEFT JOIN urgency u ON l.urgency_id = u.urgency_id
LEFT JOIN discount d ON l.discount_id = d.discount_id
LEFT JOIN type t ON l.type_id = t.type_id
WHERE l.is_active = TRUE
ORDER BY l.posted_date DESC;

-- buyer transacs
SELECT t.listing_id, s.status_name
FROM transaction t
JOIN status s ON t.status_id = s.status_id
WHERE t.buyer_id = 'buyer_net_id';

-- statuses
SELECT status_id, status_name FROM status;

-- seller listings
SELECT l.listing_id, l.price, l.amount, l.is_active, l.posted_date, l.expiration_date, l.seller_net_id,
    loc.location_id, loc.location, u.urgency_id, u.urgency, t.type_id, t.type
FROM listing l
LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
LEFT JOIN urgency u ON l.urgency_id = u.urgency_id
LEFT JOIN type t ON l.type_id = t.type_id
WHERE l.seller_net_id = 'seller_net_id'
ORDER BY l.posted_date DESC;

-- dropdown data
SELECT location_id, location FROM location;
SELECT urgency_id, urgency FROM urgency;
SELECT type_id, type FROM type;

-- seller pending count
SELECT COUNT(t.transaction_id)
FROM transaction t
WHERE t.listing_id IN (
    SELECT listing_id FROM listing WHERE seller_net_id = 'seller_net_id'
)
AND t.status_id = (SELECT status_id FROM status WHERE status_name = 'Pending');

-- seller active listings
SELECT l.listing_id, l.price, l.amount, l.is_active, l.seller_net_id, l.preferred_location_id,
    l.urgency_id, l.type_id, loc.location_id, loc.location, u.urgency_id, u.urgency, t.type_id, t.type
FROM listing l
LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
LEFT JOIN urgency u ON l.urgency_id = u.urgency_id
LEFT JOIN type t ON l.type_id = t.type_id
WHERE l.seller_net_id = 'seller_net_id' AND l.is_active = TRUE
ORDER BY l.price ASC;

-- buyer history
SELECT t.transaction_id, t.buyer_id, t.listing_id, t.buyer_confirm, t.seller_confirm, t.transaction_time,
    s.status_id, s.status_name, l.price, l.amount, l.seller_net_id, loc.location, ty.type
FROM transaction t
LEFT JOIN status s ON t.status_id = s.status_id
LEFT JOIN listing l ON t.listing_id = l.listing_id
LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
LEFT JOIN type ty ON l.type_id = ty.type_id
WHERE t.buyer_id = 'buyer_net_id'
ORDER BY t.transaction_time DESC;

-- seller transactions
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

-- domains (email)
SELECT email_domain FROM domain;

-- comments on transacs
SELECT c.comment_id, c.rating, c.comment, c.transaction_id
FROM comment c
WHERE c.transaction_id = '39463cc4-a857-456e-a274-acdec819b7eb';

-- avg rating
SELECT AVG(c.rating) AS avg_rating
FROM comment c
JOIN transaction t ON c.transaction_id = t.transaction_id
JOIN listing l ON t.listing_id = l.listing_id
WHERE l.seller_net_id = 'seller_net_id';



--select statuements to get table schemas + row count
SELECT column_name, data_type, is_nullable, column_default,
(SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = 'school') AS row_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'school'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, column_default,
(SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = 'user') AS row_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, column_default,
(SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = 'domain') AS row_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'domain'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, column_default,
(SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = 'listing') AS row_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'listing'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, column_default,
(SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = 'transaction') AS row_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'transaction'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, column_default,
(SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = 'type') AS row_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'type'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, column_default,
(SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = 'urgency') AS row_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'urgency'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, column_default,
(SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = 'discount') AS row_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'discount'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, column_default,
(SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = 'location') AS row_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'location'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, column_default,
(SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = 'comment') AS row_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'comment'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, column_default,
(SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = 'status') AS row_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'status'
ORDER BY ordinal_position;

-- select row count from tables
SELECT COUNT(*) FROM public.school;
SELECT COUNT(*) FROM public."user";
SELECT COUNT(*) FROM public.domain;
SELECT COUNT(*) FROM public.location;
SELECT COUNT(*) FROM public.urgency;
SELECT COUNT(*) FROM public.type;
SELECT COUNT(*) FROM public.discount;
SELECT COUNT(*) FROM public.status;
SELECT COUNT(*) FROM public.listing;
SELECT COUNT(*) FROM public.transaction;
SELECT COUNT(*) FROM public.comment;

-- sample data

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

INSERT INTO "user" (net_id, first_name, last_name, phone_number, school_id) VALUES
('ak7745', 'Aisha',     'Khan',      '646-555-0203', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('al9012', 'Alex',      'Liu',       '212-555-0103', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('at6426', '',          '',          '',             NULL),
('bo2256', 'Ben',       'Okafor',    '646-555-0204', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('cf8831', 'Chloe',     'Ferreira',  '646-555-0205', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('dr7890', 'Dylan',     'Rodriguez', '212-555-0105', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('ej2345', 'Emma',      'Johnson',   '212-555-0106', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('hm1174', 'Hassan',    'Mohammed',  '646-555-0206', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('iy5509', 'Isabel',    'Young',     '646-555-0207', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('jk1234', 'Jake',      'Kim',       '212-555-0101', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('kn6643', 'Kevin',     'Nguyen',    '646-555-0208', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('lv9753', 'Lily',      'Vargas',    '212-555-0110', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('mb2468', 'Marcus',    'Brown',     '212-555-0109', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('ms5678', 'Maria',     'Santos',    '212-555-0102', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('np3456', 'Nina',      'Patel',     '212-555-0104', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('pl3328', 'Priya',     'Lee',       '646-555-0209', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('rp4821', 'Riya',      'Pillai',    '646-555-0201', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('sc1357', 'Sophie',    'Chen',      '212-555-0108', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('sg9917', 'Samuel',    'Garcia',    '646-555-0210', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('tw6789', 'Tyler',     'Wang',      '212-555-0107', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('vm0062', 'Valentina', 'Martinez',  '646-555-0211', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('wt7734', 'Winston',   'Thompson',  '646-555-0212', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('xw4415', 'Xiaoming',  'Wu',        '646-555-0213', (SELECT school_id FROM school WHERE school_name = 'New York University')),
('zc3390', 'Zach',      'Cohen',     '646-555-0202', (SELECT school_id FROM school WHERE school_name = 'New York University'));

INSERT INTO location (location) VALUES
('Café 181 (Paulson Center, 2nd Fl)'),
('Café 370 (370 Jay St, Brooklyn)'),
('Crave NYU (Paulson Center, 6th Fl)'),
('Downstein (Weinstein Hall)'),
('Dunkin'' (UHall, Union Square)'),
('Jasper Kane Café (Brooklyn)'),
('Lipton Dining Hall'),
('Palladium Dining Hall'),
('The Marketplace at Kimmel'),
('Third North Dining Hall'),
('True Burger (Paulson Center, 6th Fl)'),
('Upstein (Weinstein Hall)');

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
('Brunch Swipe',        'Fall 2026'),
('Buffet Entry',        'Spring 2026'),
('Catering Credit',     'Spring 2026'),
('Commuter Meal',       'Fall 2026'),
('Dining Dollar',       'Spring 2026'),
('Dining Swipe',        'Spring 2026'),
('Faculty Meal',        'Spring 2026'),
('Flex Points',         'Spring 2026'),
('Guest Meal',          'Spring 2026'),
('Guest Swipe',         'Spring 2026'),
('Late Night Swipe',    'Spring 2026'),
('Meal Swipe',          'Spring 2026'),
('Summer Dining Credit','Summer 2026'),
('Transfer Guest Swipe','Spring 2026'),
('Weekly Swipe',        'Spring 2026')
ON CONFLICT DO NOTHING;

INSERT INTO discount (discount_rate, begin_date, end_date) VALUES
(0.0000, '2026-01-01 00:00:00+00', '2026-12-31 23:59:59+00'),
(0.0500, '2026-03-01 00:00:00+00', '2026-05-31 00:00:00+00'),
(0.0750, '2026-01-15 00:00:00+00', '2026-05-15 23:59:59+00'),
(0.1000, '2026-01-01 00:00:00+00', '2026-05-31 00:00:00+00'),
(0.1250, '2026-02-01 00:00:00+00', '2026-06-30 23:59:59+00'),
(0.1500, '2026-01-01 00:00:00+00', '2026-05-31 00:00:00+00'),
(0.1750, '2026-03-01 00:00:00+00', '2026-08-31 23:59:59+00'),
(0.2000, '2026-02-01 00:00:00+00', '2026-04-30 00:00:00+00'),
(0.2500, '2026-04-01 00:00:00+00', '2026-04-30 00:00:00+00'),
(0.3000, '2026-04-01 00:00:00+00', '2026-07-31 23:59:59+00'),
(0.5000, '2026-04-01 00:00:00+00', '2026-05-31 23:59:59+00');

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

INSERT INTO listing (seller_net_id, preferred_location_id, urgency_id, type_id, discount_id, amount, price, is_active, posted_date, expiration_date) VALUES
('xw4415', (SELECT location_id FROM location WHERE location = 'The Marketplace at Kimmel'),      (SELECT urgency_id FROM urgency WHERE urgency = 'Urgent'),   (SELECT type_id FROM type WHERE type = 'Guest Swipe'),         (SELECT discount_id FROM discount WHERE discount_rate = 0.2000 LIMIT 1), '1', 7.00,   FALSE, '2026-04-04 17:00:00+00', '2026-04-11 17:00:00+00'),
('wt7734', (SELECT location_id FROM location WHERE location = 'Third North Dining Hall'),         (SELECT urgency_id FROM urgency WHERE urgency = 'No Rush'),  (SELECT type_id FROM type WHERE type = 'Dining Swipe'),        NULL,                                                                    '4', 4.75,   FALSE, '2026-04-05 09:00:00+00', '2026-05-05 09:00:00+00'),
('dr7890', (SELECT location_id FROM location WHERE location = 'Crave NYU (Paulson Center, 6th Fl)'),(SELECT urgency_id FROM urgency WHERE urgency = 'High'),   (SELECT type_id FROM type WHERE type = 'Guest Swipe'),         (SELECT discount_id FROM discount WHERE discount_rate = 0.1500 LIMIT 1), '1', 8.00,   TRUE,  '2026-04-05 11:45:00+00', '2026-05-05 11:45:00+00'),
('iy5509', (SELECT location_id FROM location WHERE location = 'Downstein (Weinstein Hall)'),      (SELECT urgency_id FROM urgency WHERE urgency = 'No Rush'),  (SELECT type_id FROM type WHERE type = 'Dining Swipe'),        NULL,                                                                    '6', 3.75,   TRUE,  '2026-04-06 10:00:00+00', '2026-05-06 10:00:00+00'),
('lv9753', (SELECT location_id FROM location WHERE location = 'Lipton Dining Hall'),              (SELECT urgency_id FROM urgency WHERE urgency = 'Low'),      (SELECT type_id FROM type WHERE type = 'Dining Swipe'),        NULL,                                                                    '8', 3.50,   FALSE, '2026-04-06 12:00:00+00', '2026-05-06 12:00:00+00'),
('np3456', (SELECT location_id FROM location WHERE location = 'Palladium Dining Hall'),           (SELECT urgency_id FROM urgency WHERE urgency = 'Low'),      (SELECT type_id FROM type WHERE type = 'Dining Swipe'),        NULL,                                                                    '5', 4.50,   TRUE,  '2026-04-06 16:00:00+00', '2026-05-06 16:00:00+00'),
('pl3328', (SELECT location_id FROM location WHERE location = 'Upstein (Weinstein Hall)'),        (SELECT urgency_id FROM urgency WHERE urgency = 'Low'),      (SELECT type_id FROM type WHERE type = 'Dining Swipe'),        NULL,                                                                    '5', 4.50,   TRUE,  '2026-04-07 12:00:00+00', '2026-05-07 12:00:00+00'),
('ms5678', (SELECT location_id FROM location WHERE location = 'Crave NYU (Paulson Center, 6th Fl)'),(SELECT urgency_id FROM urgency WHERE urgency = 'High'),   (SELECT type_id FROM type WHERE type = 'Dining Swipe'),        (SELECT discount_id FROM discount WHERE discount_rate = 0.1000 LIMIT 1), '3', 5.50,   TRUE,  '2026-04-07 14:30:00+00', '2026-05-07 14:30:00+00'),
('ak7745', (SELECT location_id FROM location WHERE location = 'Downstein (Weinstein Hall)'),      (SELECT urgency_id FROM urgency WHERE urgency = 'No Rush'),  (SELECT type_id FROM type WHERE type = 'Dining Swipe'),        NULL,                                                                    '4', 4.00,   TRUE,  '2026-04-07 15:00:00+00', '2026-05-07 15:00:00+00'),
('sc1357', (SELECT location_id FROM location WHERE location = 'Third North Dining Hall'),         (SELECT urgency_id FROM urgency WHERE urgency = 'No Rush'),  (SELECT type_id FROM type WHERE type = 'Dining Swipe'),        NULL,                                                                    '6', 4.00,   TRUE,  '2026-04-07 17:30:00+00', '2026-05-07 17:30:00+00'),
('zc3390', (SELECT location_id FROM location WHERE location = 'Third North Dining Hall'),         (SELECT urgency_id FROM urgency WHERE urgency = 'High'),     (SELECT type_id FROM type WHERE type = 'Guest Swipe'),         (SELECT discount_id FROM discount WHERE discount_rate = 0.1000 LIMIT 1), '1', 6.50,   TRUE,  '2026-04-08 09:30:00+00', '2026-05-08 09:30:00+00'),
('jk1234', (SELECT location_id FROM location WHERE location = 'Third North Dining Hall'),         (SELECT urgency_id FROM urgency WHERE urgency = 'Medium'),   (SELECT type_id FROM type WHERE type = 'Guest Swipe'),         NULL,                                                                    '2', 6.00,   TRUE,  '2026-04-08 10:00:00+00', '2026-05-08 10:00:00+00'),
('tw6789', (SELECT location_id FROM location WHERE location = 'Dunkin'' (UHall, Union Square)'),  (SELECT urgency_id FROM urgency WHERE urgency = 'Medium'),   (SELECT type_id FROM type WHERE type = 'Buffet Entry'),        (SELECT discount_id FROM discount WHERE discount_rate = 0.2000 LIMIT 1), '2', 6.50,   TRUE,  '2026-04-08 13:20:00+00', '2026-05-08 13:20:00+00'),
('sg9917', (SELECT location_id FROM location WHERE location = 'Downstein (Weinstein Hall)'),      (SELECT urgency_id FROM urgency WHERE urgency = 'Medium'),   (SELECT type_id FROM type WHERE type = 'Buffet Entry'),        (SELECT discount_id FROM discount WHERE discount_rate = 0.1000 LIMIT 1), '2', 5.25,   TRUE,  '2026-04-08 14:30:00+00', '2026-05-08 14:30:00+00'),
('hm1174', (SELECT location_id FROM location WHERE location = 'The Marketplace at Kimmel'),      (SELECT urgency_id FROM urgency WHERE urgency = 'Low'),      (SELECT type_id FROM type WHERE type = 'Guest Swipe'),         NULL,                                                                    '2', 6.00,   TRUE,  '2026-04-08 16:45:00+00', '2026-05-08 16:45:00+00'),
('mb2468', (SELECT location_id FROM location WHERE location = 'Downstein (Weinstein Hall)'),      (SELECT urgency_id FROM urgency WHERE urgency = 'Urgent'),   (SELECT type_id FROM type WHERE type = 'Guest Swipe'),         (SELECT discount_id FROM discount WHERE discount_rate = 0.0500 LIMIT 1), '1', 7.50,   FALSE, '2026-04-09 07:00:00+00', '2026-04-15 07:00:00+00'),
('ej2345', (SELECT location_id FROM location WHERE location = 'The Marketplace at Kimmel'),      (SELECT urgency_id FROM urgency WHERE urgency = 'No Rush'),  (SELECT type_id FROM type WHERE type = 'Dining Swipe'),        NULL,                                                                    '4', 5.00,   TRUE,  '2026-04-09 08:00:00+00', '2026-05-09 08:00:00+00'),
('kn6643', (SELECT location_id FROM location WHERE location = 'Downstein (Weinstein Hall)'),      (SELECT urgency_id FROM urgency WHERE urgency = 'High'),     (SELECT type_id FROM type WHERE type = 'Transfer Guest Swipe'),(SELECT discount_id FROM discount WHERE discount_rate = 0.1500 LIMIT 1), '1', 8.00,   TRUE,  '2026-04-09 08:15:00+00', '2026-04-14 08:15:00+00'),
('al9012', (SELECT location_id FROM location WHERE location = 'Lipton Dining Hall'),              (SELECT urgency_id FROM urgency WHERE urgency = 'Urgent'),   (SELECT type_id FROM type WHERE type = 'Buffet Entry'),        (SELECT discount_id FROM discount WHERE discount_rate = 0.2500 LIMIT 1), '1', 7.00,   TRUE,  '2026-04-09 09:15:00+00', '2026-04-16 09:15:00+00'),
('vm0062', (SELECT location_id FROM location WHERE location = 'Downstein (Weinstein Hall)'),      (SELECT urgency_id FROM urgency WHERE urgency = 'High'),     (SELECT type_id FROM type WHERE type = 'Dining Swipe'),        NULL,                                                                    '3', 6.00,   TRUE,  '2026-04-09 10:30:00+00', '2026-05-09 10:30:00+00'),
('rp4821', (SELECT location_id FROM location WHERE location = 'Downstein (Weinstein Hall)'),      (SELECT urgency_id FROM urgency WHERE urgency = 'Medium'),   (SELECT type_id FROM type WHERE type = 'Dining Swipe'),        NULL,                                                                    '2', 5.00,   TRUE,  '2026-04-09 11:00:00+00', '2026-05-09 11:00:00+00'),
('cf8831', (SELECT location_id FROM location WHERE location = 'Palladium Dining Hall'),           (SELECT urgency_id FROM urgency WHERE urgency = 'Medium'),   (SELECT type_id FROM type WHERE type = 'Dining Swipe'),        (SELECT discount_id FROM discount WHERE discount_rate = 0.0500 LIMIT 1), '3', 5.50,   TRUE,  '2026-04-09 13:00:00+00', '2026-05-09 13:00:00+00'),
('bo2256', (SELECT location_id FROM location WHERE location = 'Lipton Dining Hall'),              (SELECT urgency_id FROM urgency WHERE urgency = 'Urgent'),   (SELECT type_id FROM type WHERE type = 'Buffet Entry'),        (SELECT discount_id FROM discount WHERE discount_rate = 0.2500 LIMIT 1), '1', 7.50,   TRUE,  '2026-04-10 07:30:00+00', '2026-04-17 07:30:00+00'),
('at6426', (SELECT location_id FROM location WHERE location = 'Downstein (Weinstein Hall)'),      (SELECT urgency_id FROM urgency WHERE urgency = 'Medium'),   (SELECT type_id FROM type WHERE type = 'Dining Swipe'),        NULL,                                                                    '1', 111.00, TRUE,  '2026-04-11 02:09:29+00', '2026-05-11 02:09:29+00');

INSERT INTO transaction (buyer_id, listing_id, status_id, buyer_confirm, seller_confirm, transaction_time) VALUES
('al9012', (SELECT listing_id FROM listing WHERE seller_net_id = 'lv9753' AND posted_date = '2026-04-06 12:00:00+00'), (SELECT status_id FROM status WHERE status_name = 'Completed'), TRUE,  TRUE,  '2026-04-05 15:30:00+00'),
('ms5678', (SELECT listing_id FROM listing WHERE seller_net_id = 'xw4415' AND posted_date = '2026-04-04 17:00:00+00'), (SELECT status_id FROM status WHERE status_name = 'Completed'), TRUE,  TRUE,  '2026-04-05 18:00:00+00'),
('jk1234', (SELECT listing_id FROM listing WHERE seller_net_id = 'wt7734' AND posted_date = '2026-04-05 09:00:00+00'), (SELECT status_id FROM status WHERE status_name = 'Completed'), TRUE,  TRUE,  '2026-04-06 11:00:00+00'),
('dr7890', (SELECT listing_id FROM listing WHERE seller_net_id = 'mb2468' AND posted_date = '2026-04-09 07:00:00+00'), (SELECT status_id FROM status WHERE status_name = 'Completed'), TRUE,  TRUE,  '2026-04-06 12:00:00+00'),
('lv9753', (SELECT listing_id FROM listing WHERE seller_net_id = 'ej2345' AND posted_date = '2026-04-09 08:00:00+00'), (SELECT status_id FROM status WHERE status_name = 'Completed'), TRUE,  TRUE,  '2026-04-07 14:00:00+00'),
('rp4821', (SELECT listing_id FROM listing WHERE seller_net_id = 'iy5509' AND posted_date = '2026-04-06 10:00:00+00'), (SELECT status_id FROM status WHERE status_name = 'Cancelled'), FALSE, FALSE, '2026-04-07 16:00:00+00'),
('lv9753', (SELECT listing_id FROM listing WHERE seller_net_id = 'ak7745' AND posted_date = '2026-04-07 15:00:00+00'), (SELECT status_id FROM status WHERE status_name = 'Cancelled'), FALSE, FALSE, '2026-04-08 12:00:00+00'),
('ej2345', (SELECT listing_id FROM listing WHERE seller_net_id = 'tw6789' AND posted_date = '2026-04-08 13:20:00+00'), (SELECT status_id FROM status WHERE status_name = 'Confirmed'), FALSE, TRUE,  '2026-04-08 16:00:00+00'),
('np3456', (SELECT listing_id FROM listing WHERE seller_net_id = 'kn6643' AND posted_date = '2026-04-09 08:15:00+00'), (SELECT status_id FROM status WHERE status_name = 'Confirmed'), FALSE, TRUE,  '2026-04-09 09:00:00+00'),
('jk1234', (SELECT listing_id FROM listing WHERE seller_net_id = 'dr7890' AND posted_date = '2026-04-05 11:45:00+00'), (SELECT status_id FROM status WHERE status_name = 'Confirmed'), FALSE, TRUE,  '2026-04-09 10:00:00+00'),
('sc1357', (SELECT listing_id FROM listing WHERE seller_net_id = 'al9012' AND posted_date = '2026-04-09 09:15:00+00'), (SELECT status_id FROM status WHERE status_name = 'Cancelled'), FALSE, FALSE, '2026-04-09 11:00:00+00'),
('al9012', (SELECT listing_id FROM listing WHERE seller_net_id = 'rp4821' AND posted_date = '2026-04-09 11:00:00+00'), (SELECT status_id FROM status WHERE status_name = 'Confirmed'), FALSE, TRUE,  '2026-04-09 14:00:00+00'),
('dr7890', (SELECT listing_id FROM listing WHERE seller_net_id = 'cf8831' AND posted_date = '2026-04-09 13:00:00+00'), (SELECT status_id FROM status WHERE status_name = 'Confirmed'), TRUE,  TRUE,  '2026-04-09 15:30:00+00'),
('np3456', (SELECT listing_id FROM listing WHERE seller_net_id = 'sc1357' AND posted_date = '2026-04-07 17:30:00+00'), (SELECT status_id FROM status WHERE status_name = 'Confirmed'), FALSE, TRUE,  '2026-04-09 18:00:00+00'),
('mb2468', (SELECT listing_id FROM listing WHERE seller_net_id = 'jk1234' AND posted_date = '2026-04-08 10:00:00+00'), (SELECT status_id FROM status WHERE status_name = 'Pending'),   FALSE, FALSE, '2026-04-10 07:00:00+00'),
('tw6789', (SELECT listing_id FROM listing WHERE seller_net_id = 'bo2256' AND posted_date = '2026-04-10 07:30:00+00'), (SELECT status_id FROM status WHERE status_name = 'Pending'),   FALSE, FALSE, '2026-04-10 07:45:00+00'),
('ms5678', (SELECT listing_id FROM listing WHERE seller_net_id = 'np3456' AND posted_date = '2026-04-06 16:00:00+00'), (SELECT status_id FROM status WHERE status_name = 'Pending'),   FALSE, FALSE, '2026-04-10 08:00:00+00'),
('ej2345', (SELECT listing_id FROM listing WHERE seller_net_id = 'zc3390' AND posted_date = '2026-04-08 09:30:00+00'), (SELECT status_id FROM status WHERE status_name = 'Pending'),   FALSE, FALSE, '2026-04-10 08:30:00+00'),
('sc1357', (SELECT listing_id FROM listing WHERE seller_net_id = 'hm1174' AND posted_date = '2026-04-08 16:45:00+00'), (SELECT status_id FROM status WHERE status_name = 'Pending'),   FALSE, FALSE, '2026-04-10 09:00:00+00'),
('tw6789', (SELECT listing_id FROM listing WHERE seller_net_id = 'ms5678' AND posted_date = '2026-04-07 14:30:00+00'), (SELECT status_id FROM status WHERE status_name = 'Pending'),   FALSE, FALSE, '2026-04-10 09:30:00+00'),
('mb2468', (SELECT listing_id FROM listing WHERE seller_net_id = 'vm0062' AND posted_date = '2026-04-09 10:30:00+00'), (SELECT status_id FROM status WHERE status_name = 'Pending'),   FALSE, FALSE, '2026-04-10 10:00:00+00'),
('at6426', (SELECT listing_id FROM listing WHERE seller_net_id = 'al9012' AND posted_date = '2026-04-09 09:15:00+00'), (SELECT status_id FROM status WHERE status_name = 'Pending'),   FALSE, FALSE, '2026-04-11 02:09:12+00');

INSERT INTO comment (rating, comment, transaction_id) VALUES
(4.0, 'Solid transaction. Met at the right spot, no drama. Would use SwipeMarket again for sure.',       (SELECT transaction_id FROM transaction WHERE buyer_id = 'al9012' AND transaction_time = '2026-04-05 15:30:00+00')),
(4.5, 'Super easy swap at Third North, Jake was on time!',                                               (SELECT transaction_id FROM transaction WHERE buyer_id = 'al9012' AND transaction_time = '2026-04-05 15:30:00+00')),
(5.0, 'lv9753 was amazing, super fast and easy swap at Third North. Buffet was still open too!',         (SELECT transaction_id FROM transaction WHERE buyer_id = 'al9012' AND transaction_time = '2026-04-05 15:30:00+00')),
(4.0, 'Quick and easy. Buffet entry swipe at Weinstein, no fuss. Will buy again.',                      (SELECT transaction_id FROM transaction WHERE buyer_id = 'ms5678' AND transaction_time = '2026-04-05 18:00:00+00')),
(5.0, 'xw4415 is the best seller on here. Super chill, met me at Kimmel, whole thing took 2 minutes.',  (SELECT transaction_id FROM transaction WHERE buyer_id = 'ms5678' AND transaction_time = '2026-04-05 18:00:00+00')),
(4.5, 'Xw4415 was a bit late to Kimmel but overall smooth swap, no issues.',                             (SELECT transaction_id FROM transaction WHERE buyer_id = 'ms5678' AND transaction_time = '2026-04-05 18:00:00+00')),
(5.0, 'Wt7734 was super chill, met at Third North right on time. Would def buy again!',                  (SELECT transaction_id FROM transaction WHERE buyer_id = 'jk1234' AND transaction_time = '2026-04-06 11:00:00+00')),
(2.5, 'Swipe worked but the seller was 15 min late. Communication could be better. Still got my meal.',  (SELECT transaction_id FROM transaction WHERE buyer_id = 'jk1234' AND transaction_time = '2026-04-06 11:00:00+00')),
(4.5, 'wt7734 was responsive on the app and showed up at Third North exactly when planned.',              (SELECT transaction_id FROM transaction WHERE buyer_id = 'jk1234' AND transaction_time = '2026-04-06 11:00:00+00')),
(5.0, 'mb2468 came through clutch. I was starving and he showed up in like 5 minutes. 10/10',            (SELECT transaction_id FROM transaction WHERE buyer_id = 'dr7890' AND transaction_time = '2026-04-06 12:00:00+00')),
(5.0, 'Marcus was great, met at Sarge''s exactly when planned.',                                         (SELECT transaction_id FROM transaction WHERE buyer_id = 'dr7890' AND transaction_time = '2026-04-06 12:00:00+00')),
(4.5, 'Great seller, Sarge''s was a perfect meetup spot. Very professional.',                             (SELECT transaction_id FROM transaction WHERE buyer_id = 'dr7890' AND transaction_time = '2026-04-06 12:00:00+00')),
(5.0, 'Honestly one of the smoothest swaps I''ve done. Buyer confirmed immediately, no issues at all.',  (SELECT transaction_id FROM transaction WHERE buyer_id = 'lv9753' AND transaction_time = '2026-04-07 14:00:00+00')),
(4.0, 'Good experience at Kimmel, smooth transaction with Emma.',                                         (SELECT transaction_id FROM transaction WHERE buyer_id = 'lv9753' AND transaction_time = '2026-04-07 14:00:00+00')),
(3.0, 'ej2345 took a while to show at Kimmel but eventually came through. Swipe worked fine.',            (SELECT transaction_id FROM transaction WHERE buyer_id = 'lv9753' AND transaction_time = '2026-04-07 14:00:00+00')),
(4.0, 'Good experience at Weinstein buffet. Seller was friendly and on time!',                            (SELECT transaction_id FROM transaction WHERE buyer_id = 'al9012' AND transaction_time = '2026-04-09 14:00:00+00')),
(4.5, 'Really smooth swap at Bobst area. Seller came right away and the swipe worked first try.',         (SELECT transaction_id FROM transaction WHERE buyer_id = 'al9012' AND transaction_time = '2026-04-09 14:00:00+00')),
(4.0, 'Good vibes. Seller was chill, location was convenient, would recommend this app.',                 (SELECT transaction_id FROM transaction WHERE buyer_id = 'al9012' AND transaction_time = '2026-04-09 14:00:00+00')),
(5.0, 'Literally the easiest way to get into Lipton buffet without using your own swipes. 10/10.',        (SELECT transaction_id FROM transaction WHERE buyer_id = 'al9012' AND transaction_time = '2026-04-09 14:00:00+00')),
(3.5, 'Transaction went ok at Palladium. Took a while to coordinate but got there.',                     (SELECT transaction_id FROM transaction WHERE buyer_id = 'dr7890' AND transaction_time = '2026-04-09 15:30:00+00')),
(5.0, 'Weinstein buffet for $6.50 is an absolute steal. Seller was super friendly and on time!',          (SELECT transaction_id FROM transaction WHERE buyer_id = 'dr7890' AND transaction_time = '2026-04-09 15:30:00+00')),
(3.5, 'Decent experience overall. Palladium buffet was worth it. Seller was a little hard to reach.',     (SELECT transaction_id FROM transaction WHERE buyer_id = 'dr7890' AND transaction_time = '2026-04-09 15:30:00+00')),
(5.0, 'Dr7890 confirmed receipt super fast. Best buyer I''ve had, very responsive.',                      (SELECT transaction_id FROM transaction WHERE buyer_id = 'dr7890' AND transaction_time = '2026-04-09 15:30:00+00'));


-- updates

-- update listing
UPDATE listing
SET preferred_location_id = '454abf86-4d57-459e-8620-0d1d97d87cba', urgency_id = 'db99b787-956f-4374-ba00-b51332509225', type_id = '4d35363b-9509-42e4-ad20-e98a013919db', amount = '4', price = 6.00
WHERE listing_id = 'd0892216-ff4f-4ccd-9e34-f25d36af8bb1';

-- turn off listing
UPDATE listing SET is_active = FALSE WHERE listing_id = 'd0892216-ff4f-4ccd-9e34-f25d36af8bb1';

-- turn off expired listings
UPDATE listing SET is_active = FALSE WHERE expiration_date < NOW() AND is_active = TRUE;

-- seller confirms
UPDATE transaction
SET status_id = 'b17906ea-a3e7-491b-9aee-f3e513ac44ff', seller_confirm = TRUE
WHERE transaction_id = 'bdabd586-9919-4af7-b869-873e4bf808fe';

-- cancel transaction
UPDATE transaction SET status_id = '04c55596-284f-4aec-985e-91bd509a7219' WHERE transaction_id = 'bdabd586-9919-4af7-b869-873e4bf808fe';

-- complete transaction
UPDATE transaction
SET status_id = '65cfeb33-668c-4593-99de-79aba23a2e3c', seller_confirm = TRUE
WHERE transaction_id = 'cc17ec98-f51f-43ea-96a0-8284cf4995c6';

-- buyer confirms
UPDATE transaction SET buyer_confirm = TRUE WHERE transaction_id = 'bdabd586-9919-4af7-b869-873e4bf808fe';

-- update user
UPDATE "user"
SET first_name = 'Updated', last_name = 'Name', phone_number = '2125559999'
WHERE net_id = 'ak7745';

-- set school
UPDATE "user"
SET school_id = (SELECT school_id FROM school WHERE school_name = 'New York University')
WHERE net_id = 'ak7745';

-- update discount dates
UPDATE discount
SET begin_date = '2026-05-01 00:00:00+00', end_date = '2026-08-31 23:59:59+00'
WHERE discount_id = 'ecf3ccb2-b9b3-4e81-8368-1af2bc7d4583';

-- update review
UPDATE comment
SET rating = 5.0, comment = 'Updated review after reflection.'
WHERE comment_id = '1040e915-d1ad-4f62-8978-63e6af4d68f7';

-- deletes

-- delete listing
DELETE FROM listing WHERE listing_id = 'd0892216-ff4f-4ccd-9e34-f25d36af8bb1';

-- delete inactive listing
DELETE FROM listing WHERE listing_id = '356adc42-cbd2-4f03-aaaa-fd8ac58d86cc' AND is_active = FALSE;

-- delete cancelled transaction
DELETE FROM transaction
WHERE transaction_id = '3f9c904d-45a4-4984-b9b9-4bce883aa085'
AND status_id = '04c55596-284f-4aec-985e-91bd509a7219';

-- delete comment
DELETE FROM comment WHERE comment_id = '1040e915-d1ad-4f62-8978-63e6af4d68f7';

-- delete domain
DELETE FROM domain WHERE email_domain = 'berkeley.edu';

-- delete user
DELETE FROM "user" WHERE net_id = 'ak7745';

-- ============================================================
-- notification table (real-time accepted-swipe notifications)
-- ============================================================
CREATE TABLE IF NOT EXISTS notification (
    notification_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_net_id  TEXT        NOT NULL REFERENCES "user"(net_id) ON DELETE CASCADE,
    transaction_id    UUID        NOT NULL REFERENCES transaction(transaction_id) ON DELETE CASCADE,
    type              TEXT        NOT NULL DEFAULT 'swipe_accepted',
    message           TEXT        NOT NULL,
    is_read           BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_recipient_idx
    ON notification (recipient_net_id, created_at DESC);

ALTER TABLE notification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_select_own" ON notification FOR SELECT
    USING (recipient_net_id = split_part(auth.email(), '@', 1));
CREATE POLICY "notification_no_direct_insert" ON notification FOR INSERT
    WITH CHECK (FALSE);
CREATE POLICY "notification_update_own_read" ON notification FOR UPDATE
    USING  (recipient_net_id = split_part(auth.email(), '@', 1))
    WITH CHECK (recipient_net_id = split_part(auth.email(), '@', 1));
CREATE POLICY "notification_delete_own" ON notification FOR DELETE
    USING (recipient_net_id = split_part(auth.email(), '@', 1));

ALTER PUBLICATION supabase_realtime ADD TABLE notification;

CREATE OR REPLACE FUNCTION notify_buyer_on_confirm()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_confirmed_status_id UUID;
    v_buyer_net_id        TEXT;
    v_seller_net_id       TEXT;
    v_location            TEXT;
    v_price               REAL;
    v_amount              TEXT;
BEGIN
    SELECT status_id INTO v_confirmed_status_id FROM status WHERE status_name = 'Confirmed';
    IF NEW.status_id IS DISTINCT FROM v_confirmed_status_id THEN RETURN NEW; END IF;
    IF OLD.status_id = v_confirmed_status_id THEN RETURN NEW; END IF;
    SELECT t.buyer_id, l.seller_net_id, l.price, l.amount,
           COALESCE(loc.location, 'the agreed location')
    INTO   v_buyer_net_id, v_seller_net_id, v_price, v_amount, v_location
    FROM transaction t
    JOIN listing l ON t.listing_id = l.listing_id
    LEFT JOIN location loc ON l.preferred_location_id = loc.location_id
    WHERE t.transaction_id = NEW.transaction_id;
    INSERT INTO notification (recipient_net_id, transaction_id, type, message)
    VALUES (v_buyer_net_id, NEW.transaction_id, 'swipe_accepted',
            format('%s accepted your request for %s swipe(s) at $%s — meet at %s.',
                   v_seller_net_id, v_amount, v_price, v_location));
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_transaction_confirmed
AFTER UPDATE OF status_id ON transaction
FOR EACH ROW EXECUTE FUNCTION notify_buyer_on_confirm();

-- ============================================================
-- message table (buyer ↔ seller per-transaction chat)
-- ============================================================
CREATE TABLE IF NOT EXISTS message (
    message_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID        NOT NULL REFERENCES transaction(transaction_id) ON DELETE CASCADE,
    sender_net_id   TEXT        NOT NULL REFERENCES "user"(net_id),
    content         TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS message_transaction_idx
    ON message (transaction_id, created_at ASC);

ALTER TABLE message ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_select_participants" ON message FOR SELECT USING (
    transaction_id IN (
        SELECT t.transaction_id FROM transaction t
        JOIN listing l ON t.listing_id = l.listing_id
        WHERE t.buyer_id = split_part(auth.email(), '@', 1)
           OR l.seller_net_id = split_part(auth.email(), '@', 1)
    )
);

CREATE POLICY "message_insert_participants" ON message FOR INSERT WITH CHECK (
    sender_net_id = split_part(auth.email(), '@', 1)
    AND transaction_id IN (
        SELECT t.transaction_id FROM transaction t
        JOIN listing l ON t.listing_id = l.listing_id
        WHERE t.buyer_id = split_part(auth.email(), '@', 1)
           OR l.seller_net_id = split_part(auth.email(), '@', 1)
    )
);

ALTER PUBLICATION supabase_realtime ADD TABLE message;




GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE listing      TO anon;                                                                                                                                                                                                                                                                                                   
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE listing      TO authenticated;                                                                                                                                                                                                                                                                                          
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE transaction  TO anon;                                                                                                                                                                                                                                                                                                   
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE transaction  TO authenticated;                                                                                                                                                                                                                                                                                          
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "user"       TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "user"       TO authenticated;                                                                                                                                                                                                                                                                                          
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notification TO anon;                                                                                                                                                                                                                                                                                                   
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notification TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE message      TO anon;                                                                                                                                                                                                                                                                                                   
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE message      TO authenticated;                                                                                                                                                                                                                                                                                          
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE comment      TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE comment      TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE location  TO anon;                                                                                                                                                                                                                                                                                                      
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE urgency   TO anon;                                                                                                                                                                                                                                                                                                      
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE type      TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE discount  TO anon;                                                                                                                                                                                                                                                                                                      
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE status    TO anon;                                                                                                                                                                                                                                                                                                      
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE domain    TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE school    TO anon; 




                                                                                                            
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE listing      TO anon;                                                                                                                                                                                                                                                                                                   
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE listing      TO authenticated;                                                                                                                                                                                                                                                                                          
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE transaction  TO anon;                                                                                                                                                                                                                                                                                                   
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE transaction  TO authenticated;                                                                                                                                                                                                                                                                                          
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "user"       TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "user"       TO authenticated;                                                                                                                                                                                                                                                                                          
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notification TO anon;                                                                                                                                                                                                                                                                                                   
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notification TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE message      TO anon;                                                                                                                                                                                                                                                                                                   
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE message      TO authenticated;                                                                                                                                                                                                                                                                                          
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE comment      TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE comment      TO authenticated;                                                                                                                                                                                                                                                                                          
                                                                                                                                                                                                                                                                                                                                                                    
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE location  TO anon;                                                                                                                                                                                                                                                                                                      
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE urgency   TO anon;                                                                                                                                                                                                                                                                                                      
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE type      TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE discount  TO anon;                                                                                                                                                                                                                                                                                                      
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE status    TO anon;                                                                                                                                                                                                                                                                                                      
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE domain    TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE school    TO anon;                                                                                                                                                                                                                                                                                                      
                                                                                                                                                                                                                                                                                                                                                                    
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;                                                                                                                                                                                                                                                                                                           
                                                                                                                                                                                                                                                                                                                                                                    
                                                                                                                                                                                                                                                                                                                                                                    
REVOKE INSERT, UPDATE, DELETE ON TABLE transaction FROM anon;                                                                                                                                                                                                                                                                                                         
                                                                                                                                                                                                                                                                                                                                                                    
REVOKE INSERT, UPDATE, DELETE ON TABLE listing FROM anon;                                                                                                                                                                                                                                                                                                             
                                                                                                                                                                                                                                                                                                                                                                    
REVOKE INSERT ON TABLE notification FROM anon;                                                                                                                                                                                                                                                                                                                        
REVOKE INSERT ON TABLE notification FROM authenticated;                                                                                                                                                                                                                                                                                                             
                                                                                                                                                                                                                                                                                                                                                                    
REVOKE INSERT ON TABLE comment FROM anon;
                                                                                                                                                                                                                                                                                                                                                                    
GRANT EXECUTE ON FUNCTION public.ensure_current_user_row()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_buyer_on_confirm()     TO service_role;                                                                                                                                                                                                                                                                                       
GRANT EXECUTE ON FUNCTION public.notify_seller_on_new_purchase() TO service_role;                                                                                                                                                                                                                                                                                   
                                                                                                                                                                                                                                                                                                                                                                    

CREATE POLICY "public_read_active_listings"   ON listing FOR SELECT USING (is_active = true);                                                                                                                                                                                                                                                                         
CREATE POLICY "authenticated_insert_listing"  ON listing FOR INSERT                                                                                                                                                                                                                                                                                                   
    WITH CHECK (auth.role() = 'authenticated');                                                                                                                                                                                                                                                                                                                       
CREATE POLICY "seller_update_own_listing"     ON listing FOR UPDATE                                                                                                                                                                                                                                                                                                   
    USING (seller_net_id = split_part((auth.jwt() ->> 'email'), '@', 1));                                                                                                                                                                                                                                                                                             
CREATE POLICY "seller_delete_own_listing"     ON listing FOR DELETE                                                                                                                                                                                                                                                                                                   
    USING (seller_net_id = split_part((auth.jwt() ->> 'email'), '@', 1));                                                                                                                                                                                                                                                                                             
                                                                                                                                                                                                                                                                                                                                                                    
CREATE POLICY "buyer_insert_transaction"      ON transaction FOR INSERT                                                                                                                                                                                                                                                                                             
    WITH CHECK (auth.role() = 'authenticated');                                                                                                                                                                                                                                                                                                                       
CREATE POLICY "transaction_read_involved"     ON transaction FOR SELECT                                                                                                                                                                                                                                                                                               
    USING (buyer_id = split_part((auth.jwt() ->> 'email'), '@', 1)
        OR listing_id IN (SELECT listing_id FROM listing                                                                                                                                                                                                                                                                                                              
                        WHERE seller_net_id = split_part((auth.jwt() ->> 'email'), '@', 1)));                                                                                                                                                                                                                                                                       
CREATE POLICY "transaction_update_involved"   ON transaction FOR UPDATE                                                                                                                                                                                                                                                                                               
    USING (buyer_id = split_part((auth.jwt() ->> 'email'), '@', 1)                                                                                                                                                                                                                                                                                                    
        OR listing_id IN (SELECT listing_id FROM listing                                                                                                                                                                                                                                                                                                              
                        WHERE seller_net_id = split_part((auth.jwt() ->> 'email'), '@', 1)));                                                                                                                                                                                                                                                                     
                                                                                                                                                                                                                                                                                                                                                                    
CREATE POLICY "notification_select_own"       ON notification FOR SELECT                                                                                                                                                                                                                                                                                              
    USING (recipient_net_id = split_part(auth.email(), '@', 1));                                                                                                                                                                                                                                                                                                      
CREATE POLICY "notification_no_direct_insert" ON notification FOR INSERT                                                                                                                                                                                                                                                                                            
    WITH CHECK (false);                                                                                                                                                                                                                                                                                                                                               
CREATE POLICY "notification_update_own_read"  ON notification FOR UPDATE                                                                                                                                                                                                                                                                                            
    USING  (recipient_net_id = split_part(auth.email(), '@', 1))                                                                                                                                                                                                                                                                                                      
    WITH CHECK (recipient_net_id = split_part(auth.email(), '@', 1));
CREATE POLICY "notification_delete_own"       ON notification FOR DELETE                                                                                                                                                                                                                                                                                              
    USING (recipient_net_id = split_part(auth.email(), '@', 1));                                                                                                                                                                                                                                                                                                    
                                                                                                                                                                                                                                                                                                                                                                    
CREATE POLICY "message_select_participants"   ON message FOR SELECT                                                                                                                                                                                                                                                                                                   
    USING (transaction_id IN (                                                                                                                                                                                                                                                                                                                                        
        SELECT t.transaction_id FROM transaction t                                                                                                                                                                                                                                                                                                                    
        JOIN listing l ON t.listing_id = l.listing_id
        WHERE t.buyer_id      = split_part(auth.email(), '@', 1)                                                                                                                                                                                                                                                                                                      
            OR l.seller_net_id = split_part(auth.email(), '@', 1)                                                                                                                                                                                                                                                                                                      
    ));
CREATE POLICY "message_insert_participants"   ON message FOR INSERT                                                                                                                                                                                                                                                                                                   
    WITH CHECK (                                                                                                                                                                                                                                                                                                                                                    
        sender_net_id = split_part(auth.email(), '@', 1)                                                                                                                                                                                                                                                                                                              
        AND transaction_id IN (
            SELECT t.transaction_id FROM transaction t                                                                                                                                                                                                                                                                                                                
            JOIN listing l ON t.listing_id = l.listing_id                                                                                                                                                                                                                                                                                                             
            WHERE t.buyer_id      = split_part(auth.email(), '@', 1)
                OR l.seller_net_id = split_part(auth.email(), '@', 1)                                                                                                                                                                                                                                                                                                  
        )                                                                                                                                                                                                                                                                                                                                                             
    );
                                                                                                                                                                                                                                                                                                                                                                    
CREATE POLICY "user_insert_own"   ON "user" FOR INSERT
    WITH CHECK (net_id = split_part((auth.jwt() ->> 'email'), '@', 1));                                                                                                                                                                                                                                                                                               
CREATE POLICY "user_update_own"   ON "user" FOR UPDATE                                                                                                                                                                                                                                                                                                                
    USING (net_id = split_part((auth.jwt() ->> 'email'), '@', 1));
                                                                                                                                                                                                                                                                                                                                                                    
CREATE POLICY "public_read_comments"          ON comment FOR SELECT USING (true);                                                                                                                                                                                                                                                                                     
CREATE POLICY "authenticated_insert_comment"  ON comment FOR INSERT                                                                                                                                                                                                                                                                                                   
    WITH CHECK (auth.role() = 'authenticated');
                                                                                                                                                                                                                                                                                                        