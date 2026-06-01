-- Migration: recurring_rules.account_id onDelete cascade -> set null
--
-- Cambia la política de borrado del FK recurring_rules.account_id → accounts.id.
-- Antes: si borrabas una cuenta, todas las reglas recurrentes vinculadas se
-- borraban en cascada. Esto causaba pérdida silenciosa de reglas activas
-- (cuotas de préstamo, pagos automáticos, etc.) cuando se eliminaba una cuenta
-- auxiliar. Ahora: la regla se preserva con account_id = NULL y el usuario debe
-- re-vincular manualmente.
--
-- Seguridad:
-- - Solo cambia la política del FK; no toca datos existentes.
-- - El zod del form ya valida que accountId sea NOT NULL para los kinds que lo
--   requieren (todos excepto loan_charge), así que reglas huérfanas no pueden
--   materializarse hasta ser re-vinculadas.

ALTER TABLE "recurring_rules"
  DROP CONSTRAINT IF EXISTS "recurring_rules_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "recurring_rules"
  ADD CONSTRAINT "recurring_rules_account_id_accounts_id_fk"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
