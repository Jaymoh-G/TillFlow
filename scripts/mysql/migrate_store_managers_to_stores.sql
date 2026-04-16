-- TillFlow — `stores` table (correct fields only: tenant, code, name, location, timestamps).
-- No email, phone, username, password, or status on this table.
-- BACK UP before running. Adjust tenant FK if your schema uses one.

DROP TABLE IF EXISTS `stores`;

CREATE TABLE `stores` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint unsigned NOT NULL,
  `code` varchar(32) NOT NULL COMMENT 'e.g. ST-001 per tenant, set in application code',
  `name` varchar(255) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stores_tenant_id_code_unique` (`tenant_id`,`code`),
  KEY `stores_tenant_id_index` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: add FK when `tenants` exists:
-- ALTER TABLE `stores`
--   ADD CONSTRAINT `stores_tenant_id_foreign`
--   FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

-- Optional: migrate from legacy `store_managers` (MySQL 8+), then drop old table after FK updates.
-- INSERT INTO `stores` (`tenant_id`, `code`, `name`, `location`, `created_at`, `updated_at`)
-- SELECT
--   `tenant_id`,
--   CONCAT('ST-', LPAD(ROW_NUMBER() OVER (PARTITION BY `tenant_id` ORDER BY `id`), 3, '0')),
--   `store_name`,
--   `location`,
--   `created_at`,
--   `updated_at`
-- FROM `store_managers`;
-- DROP TABLE IF EXISTS `store_managers`;
