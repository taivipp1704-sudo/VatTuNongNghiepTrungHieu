CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY, name text NOT NULL, address text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY, name text UNIQUE NOT NULL, permissions text[] NOT NULL DEFAULT '{}', protected boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY, username text UNIQUE NOT NULL, name text NOT NULL, password_hash text NOT NULL,
  owner boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true, must_change_password boolean NOT NULL DEFAULT true,
  warehouse_ids uuid[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid REFERENCES users(id), role_id uuid REFERENCES roles(id), PRIMARY KEY(user_id, role_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY, sku text UNIQUE NOT NULL, barcode text UNIQUE, name text NOT NULL, category text NOT NULL,
  base_unit text NOT NULL, pack_unit text NOT NULL, pack_factor numeric(18,3) NOT NULL CHECK(pack_factor > 0),
  price_base numeric(18,0) NOT NULL CHECK(price_base >= 0), price_pack numeric(18,0) NOT NULL CHECK(price_pack >= 0),
  cost_base numeric(18,0) NOT NULL CHECK(cost_base >= 0), min_stock numeric(18,3) NOT NULL DEFAULT 0 CHECK(min_stock >= 0),
  track_lots boolean NOT NULL DEFAULT true, active boolean NOT NULL DEFAULT true, technical_info text NOT NULL DEFAULT ''
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS loyalty_rate numeric(7,4) NOT NULL DEFAULT 0 CHECK(loyalty_rate >= 0 AND loyalty_rate <= 100);
CREATE TABLE IF NOT EXISTS lots (
  id uuid PRIMARY KEY, product_id uuid NOT NULL REFERENCES products(id), warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  code text NOT NULL, expires_on date, location text NOT NULL DEFAULT '', state text NOT NULL DEFAULT 'AVAILABLE' CHECK(state IN ('AVAILABLE','QUARANTINE')),
  quantity numeric(18,3) NOT NULL DEFAULT 0 CHECK(quantity >= 0), reserved numeric(18,3) NOT NULL DEFAULT 0 CHECK(reserved >= 0 AND reserved <= quantity),
  cost_base numeric(18,0) NOT NULL CHECK(cost_base >= 0), UNIQUE(product_id, warehouse_id, code)
);
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY, name text NOT NULL, kind text NOT NULL CHECK(kind IN ('CUSTOMER','SUPPLIER')),
  phone text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', tax_code text NOT NULL DEFAULT '',
  credit_limit numeric(18,0) NOT NULL DEFAULT 10000000 CHECK(credit_limit >= 0)
);
CREATE TABLE IF NOT EXISTS stock_documents (
  id uuid PRIMARY KEY, code text UNIQUE NOT NULL, kind text NOT NULL CHECK(kind IN ('RECEIPT','ISSUE','COUNT','RETURN','TRANSFER','DISPOSAL')),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id), destination_id uuid REFERENCES warehouses(id), partner_id uuid REFERENCES partners(id),
  lines jsonb NOT NULL, reason text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('DRAFT','PENDING','POSTED','CANCELLED')),
  created_by uuid NOT NULL REFERENCES users(id), posted_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), posted_at timestamptz
);
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY, code text UNIQUE NOT NULL, customer_id uuid REFERENCES partners(id), warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  lines jsonb NOT NULL, subtotal numeric(18,0) NOT NULL, discount numeric(18,0) NOT NULL, total numeric(18,0) NOT NULL CHECK(total >= 0),
  paid numeric(18,0) NOT NULL CHECK(paid >= 0 AND paid <= total), payment_method text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'DELIVERED', payment_status text NOT NULL, returned boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS debts (
  id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES partners(id), warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  order_id uuid REFERENCES orders(id), document_id uuid REFERENCES stock_documents(id), kind text NOT NULL CHECK(kind IN ('RECEIVABLE','PAYABLE')),
  original numeric(18,0) NOT NULL CHECK(original > 0), balance numeric(18,0) NOT NULL CHECK(balance >= 0 AND balance <= original),
  due_on date NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY, debt_id uuid REFERENCES debts(id), order_id uuid REFERENCES orders(id),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id), amount numeric(18,0) NOT NULL CHECK(amount > 0),
  direction text NOT NULL CHECK(direction IN ('IN','OUT')), method text NOT NULL, note text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY, order_id uuid UNIQUE NOT NULL REFERENCES orders(id), code text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT', provider_reference text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS stock_ledger (
  id uuid PRIMARY KEY, lot_id uuid NOT NULL REFERENCES lots(id), document_id uuid REFERENCES stock_documents(id), order_id uuid REFERENCES orders(id),
  delta numeric(18,3) NOT NULL, balance numeric(18,3) NOT NULL CHECK(balance >= 0),
  reason text NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY, user_id uuid REFERENCES users(id), action text NOT NULL, entity_id text,
  detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS idempotency (
  user_id uuid NOT NULL REFERENCES users(id), key text NOT NULL, request_hash text NOT NULL,
  response jsonb, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,key)
);
CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value jsonb NOT NULL);
-- Only the internal shortage bucket may carry a negative balance. Real lots
-- retain their nonnegative quantity/reservation guarantees.
ALTER TABLE lots ADD COLUMN IF NOT EXISTS is_deficit boolean NOT NULL DEFAULT false;
DO $$ DECLARE c record; BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='lots'::regclass AND conname='lots_inventory_balance_check') THEN
    FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='lots'::regclass AND contype='c'
      AND (pg_get_constraintdef(oid) LIKE '%quantity%' OR pg_get_constraintdef(oid) LIKE '%reserved%') LOOP
      EXECUTE format('ALTER TABLE lots DROP CONSTRAINT %I',c.conname);
    END LOOP;
    ALTER TABLE lots ADD CONSTRAINT lots_inventory_balance_check CHECK (
      (NOT is_deficit AND quantity>=0 AND reserved>=0 AND reserved<=quantity) OR
      (is_deficit AND quantity BETWEEN -1000000000 AND 0 AND reserved=0 AND state='AVAILABLE' AND expires_on IS NULL)
    );
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS lots_deficit_bucket_idx ON lots(product_id,warehouse_id) WHERE is_deficit;
ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS stock_ledger_balance_check;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS is_reconciliation boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_snapshot jsonb NOT NULL DEFAULT '{}';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_earned numeric(18,0) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_spent numeric(18,0) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_discount numeric(18,0) NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  customer_id uuid PRIMARY KEY REFERENCES partners(id), balance numeric(18,0) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id uuid PRIMARY KEY, customer_id uuid NOT NULL REFERENCES partners(id), order_id uuid NOT NULL REFERENCES orders(id),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id), delta numeric(18,0) NOT NULL, balance numeric(18,0) NOT NULL,
  kind text NOT NULL CHECK(kind IN ('EARN','REDEEM','RETURN_EARN','RETURN_REDEEM')), source_key text UNIQUE NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loyalty_customer_history ON loyalty_ledger(customer_id,created_at DESC);
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS orders_warehouse_created_idx ON orders(warehouse_id,created_at);
CREATE INDEX IF NOT EXISTS orders_customer_created_idx ON orders(customer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS payments_order_created_idx ON payments(order_id,created_at);

CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('PRODUCT','DELIVERY')),
  data bytea NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 350000),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  product_id uuid REFERENCES products(id),
  order_id uuid REFERENCES orders(id),
  note text NOT NULL DEFAULT '' CHECK (length(note)<=500),
  CHECK ((kind='PRODUCT' AND order_id IS NULL) OR (kind='DELIVERY' AND product_id IS NULL AND order_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS photos_order_idx ON photos(order_id);
CREATE INDEX IF NOT EXISTS photos_product_idx ON photos(product_id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS returned_at timestamptz;
CREATE INDEX IF NOT EXISTS orders_returned_at_idx ON orders(returned_at) WHERE returned;
ALTER TABLE loyalty_ledger ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE loyalty_ledger ALTER COLUMN warehouse_id DROP NOT NULL;
ALTER TABLE loyalty_ledger ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';
ALTER TABLE loyalty_ledger DROP CONSTRAINT IF EXISTS loyalty_ledger_kind_check;
ALTER TABLE loyalty_ledger ADD CONSTRAINT loyalty_ledger_kind_check CHECK(kind IN ('EARN','REDEEM','RETURN_EARN','RETURN_REDEEM','ADJUST'));
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM roles) AND NOT EXISTS(SELECT 1 FROM settings WHERE key='_stitch_permissions_v1') THEN
    UPDATE roles SET permissions=permissions || ARRAY['loyalty.redeem'] WHERE 'sales.create'=ANY(permissions) AND NOT 'loyalty.redeem'=ANY(permissions);
    INSERT INTO settings(key,value) VALUES('_stitch_permissions_v1','true');
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS lots_lookup ON lots(warehouse_id,product_id,expires_on);
CREATE INDEX IF NOT EXISTS ledger_lot ON stock_ledger(lot_id,created_at DESC);
CREATE INDEX IF NOT EXISTS debts_balance ON debts(warehouse_id,balance);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS audit_created ON audit_log(created_at DESC);

-- Additive store-management fields; legacy clients omit these and preserve them.
ALTER TABLE products ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(details)='object');
ALTER TABLE partners ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(profile)='object');
CREATE TABLE IF NOT EXISTS product_warehouse_preferences (
  product_id uuid NOT NULL REFERENCES products(id), warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  location text NOT NULL DEFAULT '', min_stock numeric(18,3) NOT NULL DEFAULT 0 CHECK(min_stock>=0),
  max_stock numeric(18,3) CHECK(max_stock IS NULL OR max_stock>=min_stock),
  PRIMARY KEY(product_id,warehouse_id)
);
CREATE TABLE IF NOT EXISTS partner_adjustments (
  id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES partners(id), warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  delta numeric(18,0) NOT NULL CHECK(delta<>0 AND abs(delta)<=1000000000000),
  reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 500), created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_adjustments_scope ON partner_adjustments(partner_id,warehouse_id,created_at);
