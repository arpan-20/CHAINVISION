-- CHAINVISION P2.1: base schemas, UUID generation, and enum types.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS p1;
CREATE SCHEMA IF NOT EXISTS pr2;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'p1'::regnamespace AND typname = 'urgency') THEN
    CREATE TYPE p1.urgency AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'p1'::regnamespace AND typname = 'recommendation_status') THEN
    CREATE TYPE p1.recommendation_status AS ENUM ('NEW', 'SENT_TO_PROCUREMENT', 'ACKNOWLEDGED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'pr2'::regnamespace AND typname = 'requisition_source') THEN
    CREATE TYPE pr2.requisition_source AS ENUM ('SYSTEM', 'CHATBOT', 'MANUAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'pr2'::regnamespace AND typname = 'requisition_status') THEN
    CREATE TYPE pr2.requisition_status AS ENUM ('CREATED', 'SOURCED', 'PO_RAISED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'pr2'::regnamespace AND typname = 'purchase_order_status') THEN
    CREATE TYPE pr2.purchase_order_status AS ENUM ('ISSUED', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'pr2'::regnamespace AND typname = 'invoice_status') THEN
    CREATE TYPE pr2.invoice_status AS ENUM ('PENDING_MATCH', 'MATCHED', 'MISMATCHED', 'APPROVED', 'EXCEPTION');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'pr2'::regnamespace AND typname = 'match_result') THEN
    CREATE TYPE pr2.match_result AS ENUM ('MATCHED', 'MISMATCHED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'pr2'::regnamespace AND typname = 'payment_approval_status') THEN
    CREATE TYPE pr2.payment_approval_status AS ENUM ('AUTO_APPROVED', 'PENDING_REVIEW', 'REJECTED', 'APPROVED_MANUAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('PLANNER', 'PROCUREMENT_OFFICER', 'ADMIN');
  END IF;
END
$$;
