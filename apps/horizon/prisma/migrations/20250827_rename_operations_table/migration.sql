-- Rename horizon_contract_operations to horizon_operations
ALTER TABLE horizon_contract_operations RENAME TO horizon_operations;

-- Update foreign key constraint name for consistency
ALTER TABLE horizon_events 
RENAME COLUMN contractOperationId TO operationId;