-- Migration: add loan_charge kind + make accountId nullable
--
-- Cambios:
-- 1. Agrega 'loan_charge' al enum transaction_kind (para registrar cargos
--    extra que aumentan la deuda: intereses, multas, desembolsos adicionales).
-- 2. Relaja NOT NULL en transactions.account_id y recurring_rules.account_id
--    porque loan_charge puede no involucrar ninguna cuenta asset (caso típico
--    de interés capitalizado por el banco).
--
-- Seguridad:
-- - ALTER TYPE ADD VALUE es no-bloqueante en Postgres ≥ 12.
-- - DROP NOT NULL solo cambia metadata; no toca filas existentes.
-- - El cambio es reversible: ADD NOT NULL si en algún momento no hay nulls.

ALTER TYPE "transaction_kind" ADD VALUE 'loan_charge' BEFORE 'savings_contribution';
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "account_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "recurring_rules" ALTER COLUMN "account_id" DROP NOT NULL;
