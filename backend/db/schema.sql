-- Book Worm schema (PostgreSQL 14+). Idempotent: safe to run repeatedly.
-- All money values are integer paise (1 INR = 100 paise) to avoid float rounding.

CREATE TABLE IF NOT EXISTS stores (
  id                        smallint PRIMARY KEY CHECK (id = 1),
  name                      text NOT NULL,
  tax_percent               numeric(5,2) NOT NULL CHECK (tax_percent BETWEEN 0 AND 100),
  delivery_charge_paise     integer NOT NULL CHECK (delivery_charge_paise >= 0),
  free_delivery_above_paise integer NOT NULL CHECK (free_delivery_above_paise >= 0),
  cancel_window_hours       integer NOT NULL CHECK (cancel_window_hours BETWEEN 0 AND 720),
  point_value_paise         integer NOT NULL CHECK (point_value_paise > 0),
  earn_paise_per_point      integer NOT NULL CHECK (earn_paise_per_point > 0)
);

CREATE TABLE IF NOT EXISTS users (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL,
  name          text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  gift_points   integer NOT NULL DEFAULT 0 CHECK (gift_points >= 0),
  wallet_paise  integer NOT NULL DEFAULT 0 CHECK (wallet_paise >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS categories (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  slug       text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS brands (
  id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS authors (
  id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  bio  text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS books (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title         text NOT NULL,
  author_id     integer NOT NULL REFERENCES authors (id),
  brand_id      integer NOT NULL REFERENCES brands (id),
  category_id   integer NOT NULL REFERENCES categories (id),
  kind          text NOT NULL CHECK (kind IN ('Fiction', 'Non-Fiction')),
  tagline       text NOT NULL DEFAULT '',
  description   text NOT NULL DEFAULT '',
  format        text NOT NULL CHECK (format IN ('Paperback', 'Hardcover', 'eBook')),
  language      text NOT NULL DEFAULT 'English',
  price_paise   integer NOT NULL CHECK (price_paise > 0),
  stock         integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  delivery_days integer NOT NULL DEFAULT 3 CHECK (delivery_days BETWEEN 0 AND 60),
  published_on  date NOT NULL DEFAULT current_date,
  copies_sold   integer NOT NULL DEFAULT 0 CHECK (copies_sold >= 0),
  cover_bg      text NOT NULL DEFAULT '#243b55' CHECK (cover_bg ~ '^#[0-9a-fA-F]{6}$'),
  cover_fg      text NOT NULL DEFAULT '#ffffff' CHECK (cover_fg ~ '^#[0-9a-fA-F]{6}$'),
  cover_accent  text NOT NULL DEFAULT '#f5b942' CHECK (cover_accent ~ '^#[0-9a-fA-F]{6}$'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (title, author_id, format)
);
CREATE INDEX IF NOT EXISTS books_category_idx ON books (category_id);
CREATE INDEX IF NOT EXISTS books_brand_idx ON books (brand_id);
CREATE INDEX IF NOT EXISTS books_author_idx ON books (author_id);

CREATE TABLE IF NOT EXISTS reviews (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id    integer NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  user_id    integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rating     smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body       varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, user_id)
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  user_id    integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  book_id    integer NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS author_follows (
  user_id    integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  author_id  integer NOT NULL REFERENCES authors (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, author_id)
);

CREATE TABLE IF NOT EXISTS addresses (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name  text NOT NULL,
  line1      text NOT NULL,
  city       text NOT NULL,
  pin        text NOT NULL,
  state      text NOT NULL,
  country    text NOT NULL,
  email      text NOT NULL,
  phone      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS addresses_user_idx ON addresses (user_id);

CREATE TABLE IF NOT EXISTS coupons (
  code            text PRIMARY KEY CHECK (code = upper(code)),
  percent_off     smallint CHECK (percent_off BETWEEN 1 AND 100),
  flat_off_paise  integer CHECK (flat_off_paise > 0),
  max_off_paise   integer CHECK (max_off_paise > 0),
  min_order_paise integer NOT NULL DEFAULT 0 CHECK (min_order_paise >= 0),
  active          boolean NOT NULL DEFAULT true,
  expires_at      timestamptz,
  CHECK ((percent_off IS NULL) <> (flat_off_paise IS NULL))
);

CREATE TABLE IF NOT EXISTS orders (
  id                   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id              integer NOT NULL REFERENCES users (id),
  status               text NOT NULL DEFAULT 'PENDING_PAYMENT'
                       CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED')),
  subtotal_paise       integer NOT NULL CHECK (subtotal_paise >= 0),
  tax_paise            integer NOT NULL CHECK (tax_paise >= 0),
  delivery_paise       integer NOT NULL CHECK (delivery_paise >= 0),
  coupon_code          text REFERENCES coupons (code),
  coupon_off_paise     integer NOT NULL DEFAULT 0 CHECK (coupon_off_paise >= 0),
  points_used          integer NOT NULL DEFAULT 0 CHECK (points_used >= 0),
  points_off_paise     integer NOT NULL DEFAULT 0 CHECK (points_off_paise >= 0),
  total_paise          integer NOT NULL CHECK (total_paise >= 0),
  points_earned        integer NOT NULL DEFAULT 0 CHECK (points_earned >= 0),
  ship_address         jsonb NOT NULL,
  payment_method       text,
  estimated_delivery   date NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  paid_at              timestamptz,
  cancellable_until    timestamptz,
  cancelled_at         timestamptz
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id         integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  book_id          integer NOT NULL REFERENCES books (id),
  quantity         smallint NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  unit_price_paise integer NOT NULL CHECK (unit_price_paise > 0)
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_book_idx ON order_items (book_id);

CREATE TABLE IF NOT EXISTS payments (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id    integer NOT NULL REFERENCES orders (id),
  method      text NOT NULL CHECK (method IN ('credit_card', 'debit_card', 'upi', 'wallet', 'gift_points')),
  amount_paise integer NOT NULL CHECK (amount_paise >= 0),
  status      text NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'REFUNDED')),
  reference   text NOT NULL,
  card_last4  text CHECK (card_last4 ~ '^[0-9]{4}$'),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments (order_id);
