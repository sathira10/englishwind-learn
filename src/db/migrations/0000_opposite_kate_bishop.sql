CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`data_json` text
);
--> statement-breakpoint
CREATE INDEX `audit_log_entity` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_log_at` ON `audit_log` (`at`);--> statement-breakpoint
CREATE TABLE `course_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`version` integer NOT NULL,
	`content_json` text NOT NULL,
	`published_at` integer NOT NULL,
	`published_by` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_publications_course_version` ON `course_publications` (`course_id`,`version`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`access_years` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `grants` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`course_id` text NOT NULL,
	`order_id` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`revoked_at` integer,
	`revoked_by` text,
	`reason` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grants_order_id_unique` ON `grants` (`order_id`);--> statement-breakpoint
CREATE INDEX `grants_student_course` ON `grants` (`student_id`,`course_id`);--> statement-breakpoint
CREATE TABLE `lesson_progress` (
	`student_id` text NOT NULL,
	`course_id` text NOT NULL,
	`lesson_key` text NOT NULL,
	`completed_at` integer,
	`last_visited_at` integer,
	PRIMARY KEY(`student_id`, `course_id`, `lesson_key`),
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`label` text NOT NULL,
	`price_cents` integer NOT NULL,
	`needs_staff_check` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "offers_price_check" CHECK("offers"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`student_id` text,
	`buyer_email` text NOT NULL,
	`buyer_name` text NOT NULL,
	`buyer_phone` text NOT NULL,
	`offer_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`provider` text DEFAULT 'bank_transfer' NOT NULL,
	`provider_ref` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`decided_at` integer,
	`decided_by` text,
	`note` text,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "orders_status_check" CHECK("orders"."status" in ('pending','approved','rejected')),
	CONSTRAINT "orders_amount_check" CHECK("orders"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_reference_unique` ON `orders` (`reference`);--> statement-breakpoint
CREATE INDEX `orders_status_created` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_buyer_email` ON `orders` (`buyer_email`);--> statement-breakpoint
CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`lesson_key` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "resources_kind_check" CHECK("resources"."kind" in ('worksheet'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resources_r2_key_unique` ON `resources` (`r2_key`);--> statement-breakpoint
CREATE INDEX `resources_course_lesson` ON `resources` (`course_id`,`lesson_key`);--> statement-breakpoint
CREATE TABLE `staff_roles` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "staff_roles_role_check" CHECK("staff_roles"."role" in ('owner','admin'))
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`user_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_email_unique` ON `students` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `students_user_id_unique` ON `students` (`user_id`);