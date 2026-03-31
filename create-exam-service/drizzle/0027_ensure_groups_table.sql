-- Remote/local: d1_migrations-д 0013/0015 applied байсан ч `groups` хүснэгт алга болсон тохиолдолд сэргээнэ.
CREATE TABLE IF NOT EXISTS `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`grade_level` integer NOT NULL,
	`student_count` integer NOT NULL DEFAULT 0,
	`advisor_id` text,
	`home_classroom_id` text,
	`shift` integer NOT NULL DEFAULT 1,
	`is_advanced` integer NOT NULL DEFAULT 0,
	`status` text NOT NULL DEFAULT 'ACTIVE',
	`created_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
	`updated_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
	FOREIGN KEY (`advisor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`home_classroom_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE restrict
);
