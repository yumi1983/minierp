-- ============================================================
-- Mini ERP — Schema inicial para Supabase (PostgreSQL)
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS (idempotentes)
-- ============================================================
DO $$ BEGIN CREATE TYPE movement_type      AS ENUM ('IN','OUT','ADJ','TRANSFER');    EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE sale_type          AS ENUM ('cash','credit');                EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE sale_status        AS ENUM ('draft','confirmed','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE po_status          AS ENUM ('draft','sent','received','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE debt_status        AS ENUM ('active','paid','overdue');      EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE user_role          AS ENUM ('admin','seller','warehouse','accounting'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE cash_movement_type AS ENUM ('income','expense','adjustment'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE payment_method     AS ENUM ('cash','card','transfer','check'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE session_status     AS ENUM ('open','closed');                EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- ORGANIZATIONS (multi-tenant)
-- ============================================================
CREATE TABLE organizations (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- COMPANY SETTINGS
-- ============================================================
CREATE TABLE company_settings (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  trade_name       text,
  legal_name       text,
  tax_id           text,
  address          text,
  phone            text,
  email            text,
  logo_url         text,
  currency         text DEFAULT 'PEN',
  currency_symbol  text DEFAULT 'S/',
  tax_rate         numeric(5,2) DEFAULT 18.00,
  tax_label        text DEFAULT 'IGV',
  invoice_series   text DEFAULT 'F001',
  receipt_series   text DEFAULT 'B001',
  po_series        text DEFAULT 'OC001',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(org_id)
);

-- ============================================================
-- USER PROFILES
-- ============================================================
CREATE TABLE user_profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name  text,
  avatar_url text,
  role       user_role DEFAULT 'seller',
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_user_profiles_org ON user_profiles(org_id);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  parent_id   uuid REFERENCES categories(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX idx_categories_org ON categories(org_id);

-- ============================================================
-- BRANDS
-- ============================================================
CREATE TABLE brands (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_brands_org ON brands(org_id);

-- ============================================================
-- UNITS OF MEASURE
-- ============================================================
CREATE TABLE units_of_measure (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         text NOT NULL,
  abbreviation text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_units_org ON units_of_measure(org_id);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sku            text,
  barcode        text,
  name           text NOT NULL,
  description    text,
  category_id    uuid REFERENCES categories(id) ON DELETE SET NULL,
  brand_id       uuid REFERENCES brands(id) ON DELETE SET NULL,
  unit_id        uuid REFERENCES units_of_measure(id) ON DELETE SET NULL,
  purchase_price numeric(12,2) DEFAULT 0 NOT NULL,
  sale_price     numeric(12,2) DEFAULT 0 NOT NULL,
  stock          numeric(12,3) DEFAULT 0 NOT NULL,
  min_stock      numeric(12,3) DEFAULT 0 NOT NULL,
  image_url      text,
  is_active      boolean DEFAULT true NOT NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  deleted_at     timestamptz,
  UNIQUE(org_id, sku),
  UNIQUE(org_id, barcode)
);

CREATE INDEX idx_products_org        ON products(org_id);
CREATE INDEX idx_products_barcode    ON products(org_id, barcode);
CREATE INDEX idx_products_sku        ON products(org_id, sku);
CREATE INDEX idx_products_active     ON products(org_id, is_active);
CREATE INDEX idx_products_name_trgm  ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_products_low_stock  ON products(org_id) WHERE stock <= min_stock AND is_active = true;

-- ============================================================
-- INVENTORY MOVEMENTS (Kardex)
-- ============================================================
CREATE TABLE inventory_movements (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id     uuid NOT NULL REFERENCES products(id),
  type           movement_type NOT NULL,
  quantity       numeric(12,3) NOT NULL,
  stock_before   numeric(12,3) NOT NULL,
  stock_after    numeric(12,3) NOT NULL,
  unit_cost      numeric(12,2),
  reference_type text,
  reference_id   uuid,
  notes          text,
  user_id        uuid REFERENCES auth.users(id),
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_inv_mov_product ON inventory_movements(product_id);
CREATE INDEX idx_inv_mov_org_date ON inventory_movements(org_id, created_at DESC);
CREATE INDEX idx_inv_mov_ref ON inventory_movements(reference_type, reference_id);

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE suppliers (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         text NOT NULL,
  tax_id       text,
  contact_name text,
  phone        text,
  email        text,
  address      text,
  notes        text,
  is_active    boolean DEFAULT true NOT NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX idx_suppliers_org  ON suppliers(org_id);
CREATE INDEX idx_suppliers_name ON suppliers USING gin(name gin_trgm_ops);

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
CREATE TABLE purchase_orders (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id   uuid NOT NULL REFERENCES suppliers(id),
  series        text NOT NULL,
  number        integer NOT NULL,
  status        po_status DEFAULT 'draft' NOT NULL,
  subtotal      numeric(12,2) DEFAULT 0 NOT NULL,
  tax_amount    numeric(12,2) DEFAULT 0 NOT NULL,
  total         numeric(12,2) DEFAULT 0 NOT NULL,
  notes         text,
  expected_date date,
  user_id       uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  deleted_at    timestamptz,
  UNIQUE(org_id, series, number)
);

CREATE INDEX idx_po_org        ON purchase_orders(org_id);
CREATE INDEX idx_po_supplier   ON purchase_orders(supplier_id);
CREATE INDEX idx_po_status     ON purchase_orders(org_id, status);

CREATE TABLE purchase_order_items (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES products(id),
  quantity          numeric(12,3) NOT NULL,
  unit_price        numeric(12,2) NOT NULL,
  subtotal          numeric(12,2) NOT NULL,
  received_quantity numeric(12,3) DEFAULT 0 NOT NULL
);

CREATE INDEX idx_poi_order ON purchase_order_items(purchase_order_id);

-- ============================================================
-- PURCHASE RECEIPTS
-- ============================================================
CREATE TABLE purchase_receipts (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_order_id uuid REFERENCES purchase_orders(id),
  series            text NOT NULL,
  number            integer NOT NULL,
  notes             text,
  user_id           uuid REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_pr_order ON purchase_receipts(purchase_order_id);

CREATE TABLE purchase_receipt_items (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id  uuid NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES products(id),
  quantity    numeric(12,3) NOT NULL,
  unit_cost   numeric(12,2) NOT NULL
);

-- ============================================================
-- SUPPLIER DEBTS & PAYMENTS
-- ============================================================
CREATE TABLE supplier_debts (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id       uuid NOT NULL REFERENCES suppliers(id),
  purchase_order_id uuid REFERENCES purchase_orders(id),
  total_amount      numeric(12,2) NOT NULL,
  paid_amount       numeric(12,2) DEFAULT 0 NOT NULL,
  balance           numeric(12,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  due_date          date,
  status            debt_status DEFAULT 'active' NOT NULL,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_supplier_debts_org      ON supplier_debts(org_id);
CREATE INDEX idx_supplier_debts_supplier ON supplier_debts(supplier_id);
CREATE INDEX idx_supplier_debts_status   ON supplier_debts(org_id, status);

CREATE TABLE supplier_payments (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id    uuid NOT NULL REFERENCES suppliers(id),
  debt_id        uuid REFERENCES supplier_debts(id),
  amount         numeric(12,2) NOT NULL,
  payment_method payment_method DEFAULT 'cash' NOT NULL,
  reference      text,
  notes          text,
  user_id        uuid REFERENCES auth.users(id),
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_supplier_payments_org      ON supplier_payments(org_id);
CREATE INDEX idx_supplier_payments_supplier ON supplier_payments(supplier_id);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         text NOT NULL,
  tax_id       text,
  phone        text,
  email        text,
  address      text,
  credit_limit numeric(12,2) DEFAULT 0 NOT NULL,
  notes        text,
  is_active    boolean DEFAULT true NOT NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX idx_customers_org    ON customers(org_id);
CREATE INDEX idx_customers_name   ON customers USING gin(name gin_trgm_ops);
CREATE INDEX idx_customers_active ON customers(org_id, is_active);

-- ============================================================
-- CASH REGISTERS & SESSIONS
-- ============================================================
CREATE TABLE cash_registers (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       text NOT NULL,
  is_active  boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_registers_org ON cash_registers(org_id);

CREATE TABLE cash_sessions (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  register_id      uuid NOT NULL REFERENCES cash_registers(id),
  user_id          uuid NOT NULL REFERENCES auth.users(id),
  opening_amount   numeric(12,2) NOT NULL,
  closing_amount   numeric(12,2),
  expected_amount  numeric(12,2),
  difference       numeric(12,2),
  opened_at        timestamptz DEFAULT now(),
  closed_at        timestamptz,
  status           session_status DEFAULT 'open' NOT NULL
);

CREATE INDEX idx_sessions_org      ON cash_sessions(org_id);
CREATE INDEX idx_sessions_register ON cash_sessions(register_id, status);

CREATE TABLE cash_movements (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id     uuid NOT NULL REFERENCES cash_sessions(id),
  type           cash_movement_type NOT NULL,
  amount         numeric(12,2) NOT NULL,
  description    text,
  reference_type text,
  reference_id   uuid,
  user_id        uuid REFERENCES auth.users(id),
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_cash_mov_session ON cash_movements(session_id);

-- ============================================================
-- SALES
-- ============================================================
CREATE TABLE sales (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id     uuid REFERENCES customers(id) ON DELETE SET NULL,
  series          text NOT NULL,
  number          integer NOT NULL,
  type            sale_type DEFAULT 'cash' NOT NULL,
  status          sale_status DEFAULT 'draft' NOT NULL,
  subtotal        numeric(12,2) DEFAULT 0 NOT NULL,
  discount        numeric(12,2) DEFAULT 0 NOT NULL,
  tax_rate        numeric(5,2) DEFAULT 18 NOT NULL,
  tax_amount      numeric(12,2) DEFAULT 0 NOT NULL,
  total           numeric(12,2) DEFAULT 0 NOT NULL,
  payment_method  payment_method,
  cash_session_id uuid REFERENCES cash_sessions(id) ON DELETE SET NULL,
  notes           text,
  user_id         uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz,
  UNIQUE(org_id, series, number)
);

CREATE INDEX idx_sales_org      ON sales(org_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_status   ON sales(org_id, status);
CREATE INDEX idx_sales_date     ON sales(org_id, created_at DESC);
CREATE INDEX idx_sales_session  ON sales(cash_session_id);

CREATE TABLE sale_items (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id    uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity   numeric(12,3) NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  discount   numeric(12,2) DEFAULT 0 NOT NULL,
  subtotal   numeric(12,2) NOT NULL
);

CREATE INDEX idx_sale_items_sale    ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- ============================================================
-- CREDIT ACCOUNTS (Cuentas por cobrar)
-- ============================================================
CREATE TABLE credit_accounts (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sale_id      uuid NOT NULL REFERENCES sales(id),
  customer_id  uuid NOT NULL REFERENCES customers(id),
  total_amount numeric(12,2) NOT NULL,
  paid_amount  numeric(12,2) DEFAULT 0 NOT NULL,
  balance      numeric(12,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  due_date     date,
  status       debt_status DEFAULT 'active' NOT NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_credit_accounts_org      ON credit_accounts(org_id);
CREATE INDEX idx_credit_accounts_customer ON credit_accounts(customer_id);
CREATE INDEX idx_credit_accounts_status   ON credit_accounts(org_id, status);

CREATE TABLE credit_payments (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  credit_account_id uuid NOT NULL REFERENCES credit_accounts(id),
  amount            numeric(12,2) NOT NULL,
  payment_method    payment_method DEFAULT 'cash' NOT NULL,
  reference         text,
  notes             text,
  user_id           uuid REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_credit_payments_account ON credit_payments(credit_account_id);

-- ============================================================
-- SYNC LOG (auditoría offline)
-- ============================================================
CREATE TABLE sync_log (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id     uuid REFERENCES organizations(id),
  table_name text NOT NULL,
  record_id  uuid NOT NULL,
  operation  text NOT NULL,
  payload    jsonb,
  synced_at  timestamptz DEFAULT now(),
  device_id  text
);

CREATE INDEX idx_sync_log_org   ON sync_log(org_id);
CREATE INDEX idx_sync_log_table ON sync_log(table_name, record_id);

-- ============================================================
-- FUNCTION: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations','company_settings','user_profiles','categories',
    'products','suppliers','purchase_orders','supplier_debts',
    'customers','sales','credit_accounts'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- TRIGGER: calcular stock_before y stock_after automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION calc_inventory_movement()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE current_stock numeric;
BEGIN
  SELECT stock INTO current_stock
  FROM products
  WHERE id = NEW.product_id
  FOR UPDATE;

  NEW.stock_before := current_stock;
  NEW.stock_after := CASE
    WHEN NEW.type = 'IN'       THEN current_stock + NEW.quantity
    WHEN NEW.type = 'OUT'      THEN current_stock - NEW.quantity
    WHEN NEW.type = 'TRANSFER' THEN current_stock - NEW.quantity
    ELSE NEW.quantity  -- ADJ: quantity ES el nuevo stock absoluto
  END;

  UPDATE products
  SET stock = NEW.stock_after, updated_at = now()
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calc_inventory_movement
BEFORE INSERT ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION calc_inventory_movement();

-- ============================================================
-- TRIGGER: actualizar saldo de deuda de proveedor
-- ============================================================
CREATE OR REPLACE FUNCTION update_supplier_debt_on_payment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE supplier_debts
  SET
    paid_amount = paid_amount + NEW.amount,
    status = CASE
      WHEN paid_amount + NEW.amount >= total_amount THEN 'paid'::debt_status
      ELSE 'active'::debt_status
    END
  WHERE id = NEW.debt_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_supplier_payment
AFTER INSERT ON supplier_payments
FOR EACH ROW EXECUTE FUNCTION update_supplier_debt_on_payment();

-- ============================================================
-- TRIGGER: actualizar saldo de cuenta por cobrar
-- ============================================================
CREATE OR REPLACE FUNCTION update_credit_account_on_payment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE credit_accounts
  SET
    paid_amount = paid_amount + NEW.amount,
    status = CASE
      WHEN paid_amount + NEW.amount >= total_amount THEN 'paid'::debt_status
      ELSE 'active'::debt_status
    END
  WHERE id = NEW.credit_account_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_payment
AFTER INSERT ON credit_payments
FOR EACH ROW EXECUTE FUNCTION update_credit_account_on_payment();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE company_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands             ENABLE ROW LEVEL SECURITY;
ALTER TABLE units_of_measure   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receipts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_debts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales              ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log           ENABLE ROW LEVEL SECURITY;

-- Helper function para obtener el org_id del usuario actual
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT org_id FROM user_profiles WHERE id = auth.uid();
$$;

-- Helper function para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- Policy macro: todos los usuarios autenticados ven su organización
-- Aplicar a todas las tablas con org_id
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'company_settings','categories','brands','units_of_measure','products',
    'inventory_movements','suppliers','purchase_orders','supplier_debts',
    'supplier_payments','customers','cash_registers','cash_sessions',
    'cash_movements','sales','credit_accounts','credit_payments','sync_log'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY "org_isolation_%s" ON %s
       FOR ALL USING (org_id = get_user_org_id())',
      t, t
    );
  END LOOP;
END $$;

-- Policies para items (sin org_id directo)
CREATE POLICY "org_isolation_purchase_order_items" ON purchase_order_items
  FOR ALL USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY "org_isolation_purchase_receipt_items" ON purchase_receipt_items
  FOR ALL USING (
    receipt_id IN (
      SELECT id FROM purchase_receipts WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY "org_isolation_sale_items" ON sale_items
  FOR ALL USING (
    sale_id IN (
      SELECT id FROM sales WHERE org_id = get_user_org_id()
    )
  );

-- Policies de user_profiles
CREATE POLICY "users_see_own_profile" ON user_profiles
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "users_update_own_profile" ON user_profiles
  FOR UPDATE USING (id = auth.uid());

-- Solo admins pueden gestionar usuarios
CREATE POLICY "admin_manage_users" ON user_profiles
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

-- ============================================================
-- DATOS INICIALES (seed básico)
-- ============================================================

-- Las organizaciones se crean vía edge function o signup flow
-- No hay datos seed aquí para evitar conflictos multi-tenant
