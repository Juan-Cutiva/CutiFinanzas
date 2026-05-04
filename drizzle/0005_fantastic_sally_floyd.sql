CREATE INDEX "idx_tx_user_kind_date" ON "transactions" USING btree ("user_id","kind","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_tx_user_account_kind" ON "transactions" USING btree ("user_id","account_id","kind");--> statement-breakpoint
CREATE INDEX "idx_tx_user_transfer_account" ON "transactions" USING btree ("user_id","transfer_account_id");