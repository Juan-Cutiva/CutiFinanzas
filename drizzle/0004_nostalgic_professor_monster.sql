ALTER TABLE "transactions" ADD COLUMN "debt_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "savings_goal_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_debt_id_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_savings_goal_id_savings_goals_id_fk" FOREIGN KEY ("savings_goal_id") REFERENCES "public"."savings_goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tx_debt" ON "transactions" USING btree ("debt_id");--> statement-breakpoint
CREATE INDEX "idx_tx_savings_goal" ON "transactions" USING btree ("savings_goal_id");