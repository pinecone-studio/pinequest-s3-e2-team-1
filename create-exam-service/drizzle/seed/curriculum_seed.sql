-- Curriculum seed (2026-SPRING) — бүх анги (groups_seed-д байгаа 48) хамруулсан.
-- Эхлээд: subjects, users, groups seed ажилласан байх.
-- Энэ хичээлийн ID-ууд стандарт subjects_seed-д байхгүй тул энд нэмнэ.
PRAGMA foreign_keys = OFF;

INSERT OR IGNORE INTO subjects (id, name, requires_lab, category, level, status) VALUES
('MON_LANG', 'Монгол хэл (хичээл)', 0, 'LANGUAGE', 'ALL', 'ACTIVE'),
('MATH_HS', 'Математик', 0, 'STEM', 'ALL', 'ACTIVE'),
('ENG_LIT', 'Англи хэл / Уран зохиол', 0, 'LANGUAGE', 'ALL', 'ACTIVE'),
('PHYS_LAB', 'Физик (лаб)', 1, 'STEM', 'MIDDLE', 'ACTIVE'),
('ICT_BASIC', 'Мэдээлэл зүй (суурь)', 1, 'STEM', 'MIDDLE', 'ACTIVE');

-- master_schedules references curriculum; clear it first to avoid FK errors.
DELETE FROM master_schedules;

DELETE FROM curriculum WHERE semester_id = '2026-SPRING';

-- ==========================================================
-- 1–5-р анги (Бага: ээлж 1) — багш ELEM_01 … ELEM_20
-- ==========================================================

INSERT INTO curriculum (id, group_id, subject_id, teacher_id, weekly_hours, hours_per_session, semester_id) VALUES
('c-1a-mon', '1A', 'MON_LANG', 'ELEM_01', 8, 1, '2026-SPRING'), ('c-1a-mat', '1A', 'MATH_HS', 'ELEM_01', 5, 1, '2026-SPRING'),
('c-1b-mon', '1B', 'MON_LANG', 'ELEM_02', 8, 1, '2026-SPRING'), ('c-1b-mat', '1B', 'MATH_HS', 'ELEM_02', 5, 1, '2026-SPRING'),
('c-1c-mon', '1C', 'MON_LANG', 'ELEM_03', 8, 1, '2026-SPRING'), ('c-1c-mat', '1C', 'MATH_HS', 'ELEM_03', 5, 1, '2026-SPRING'),
('c-1d-mon', '1D', 'MON_LANG', 'ELEM_04', 8, 1, '2026-SPRING'), ('c-1d-mat', '1D', 'MATH_HS', 'ELEM_04', 5, 1, '2026-SPRING'),

('c-2a-mon', '2A', 'MON_LANG', 'ELEM_05', 8, 1, '2026-SPRING'), ('c-2a-mat', '2A', 'MATH_HS', 'ELEM_05', 5, 1, '2026-SPRING'),
('c-2b-mon', '2B', 'MON_LANG', 'ELEM_06', 8, 1, '2026-SPRING'), ('c-2b-mat', '2B', 'MATH_HS', 'ELEM_06', 5, 1, '2026-SPRING'),
('c-2c-mon', '2C', 'MON_LANG', 'ELEM_07', 8, 1, '2026-SPRING'), ('c-2c-mat', '2C', 'MATH_HS', 'ELEM_07', 5, 1, '2026-SPRING'),
('c-2d-mon', '2D', 'MON_LANG', 'ELEM_08', 8, 1, '2026-SPRING'), ('c-2d-mat', '2D', 'MATH_HS', 'ELEM_08', 5, 1, '2026-SPRING'),

('c-3a-mon', '3A', 'MON_LANG', 'ELEM_09', 7, 1, '2026-SPRING'), ('c-3a-mat', '3A', 'MATH_HS', 'ELEM_09', 5, 1, '2026-SPRING'),
('c-3b-mon', '3B', 'MON_LANG', 'ELEM_10', 7, 1, '2026-SPRING'), ('c-3b-mat', '3B', 'MATH_HS', 'ELEM_10', 5, 1, '2026-SPRING'),
('c-3c-mon', '3C', 'MON_LANG', 'ELEM_11', 7, 1, '2026-SPRING'), ('c-3c-mat', '3C', 'MATH_HS', 'ELEM_11', 5, 1, '2026-SPRING'),
('c-3d-mon', '3D', 'MON_LANG', 'ELEM_12', 7, 1, '2026-SPRING'), ('c-3d-mat', '3D', 'MATH_HS', 'ELEM_12', 5, 1, '2026-SPRING'),

('c-4a-mon', '4A', 'MON_LANG', 'ELEM_13', 6, 1, '2026-SPRING'), ('c-4a-mat', '4A', 'MATH_HS', 'ELEM_13', 5, 1, '2026-SPRING'), ('c-4a-eng', '4A', 'ENG_LIT', 'LANG_01', 2, 1, '2026-SPRING'),
('c-4b-mon', '4B', 'MON_LANG', 'ELEM_14', 6, 1, '2026-SPRING'), ('c-4b-mat', '4B', 'MATH_HS', 'ELEM_14', 5, 1, '2026-SPRING'), ('c-4b-eng', '4B', 'ENG_LIT', 'LANG_02', 2, 1, '2026-SPRING'),
('c-4c-mon', '4C', 'MON_LANG', 'ELEM_15', 6, 1, '2026-SPRING'), ('c-4c-mat', '4C', 'MATH_HS', 'ELEM_15', 5, 1, '2026-SPRING'), ('c-4c-eng', '4C', 'ENG_LIT', 'LANG_03', 2, 1, '2026-SPRING'),
('c-4d-mon', '4D', 'MON_LANG', 'ELEM_16', 6, 1, '2026-SPRING'), ('c-4d-mat', '4D', 'MATH_HS', 'ELEM_16', 5, 1, '2026-SPRING'), ('c-4d-eng', '4D', 'ENG_LIT', 'LANG_04', 2, 1, '2026-SPRING'),

('c-5a-mon', '5A', 'MON_LANG', 'ELEM_17', 5, 1, '2026-SPRING'), ('c-5a-mat', '5A', 'MATH_HS', 'MATH_01', 5, 1, '2026-SPRING'), ('c-5a-eng', '5A', 'ENG_LIT', 'LANG_05', 3, 1, '2026-SPRING'),
('c-5b-mon', '5B', 'MON_LANG', 'ELEM_18', 5, 1, '2026-SPRING'), ('c-5b-mat', '5B', 'MATH_HS', 'MATH_02', 5, 1, '2026-SPRING'), ('c-5b-eng', '5B', 'ENG_LIT', 'LANG_06', 3, 1, '2026-SPRING'),
('c-5c-mon', '5C', 'MON_LANG', 'ELEM_19', 5, 1, '2026-SPRING'), ('c-5c-mat', '5C', 'MATH_HS', 'MATH_03', 5, 1, '2026-SPRING'), ('c-5c-eng', '5C', 'ENG_LIT', 'LANG_07', 3, 1, '2026-SPRING'),
('c-5d-mon', '5D', 'MON_LANG', 'ELEM_20', 5, 1, '2026-SPRING'), ('c-5d-mat', '5D', 'MATH_HS', 'MATH_04', 5, 1, '2026-SPRING'), ('c-5d-eng', '5D', 'ENG_LIT', 'LANG_08', 3, 1, '2026-SPRING');

-- ==========================================================
-- 6–9-р анги (Дунд: ээлж 2)
-- ==========================================================

INSERT INTO curriculum (id, group_id, subject_id, teacher_id, weekly_hours, hours_per_session, semester_id) VALUES
('c-6a-mat', '6A', 'MATH_HS', 'MATH_05', 5, 1, '2026-SPRING'), ('c-6a-mgl', '6A', 'MON_LANG', 'MGL_01', 4, 1, '2026-SPRING'), ('c-6a-eng', '6A', 'ENG_LIT', 'LANG_09', 4, 1, '2026-SPRING'),
('c-6b-mat', '6B', 'MATH_HS', 'MATH_06', 5, 1, '2026-SPRING'), ('c-6b-mgl', '6B', 'MON_LANG', 'MGL_02', 4, 1, '2026-SPRING'), ('c-6b-eng', '6B', 'ENG_LIT', 'LANG_01', 4, 1, '2026-SPRING'),
('c-6c-mat', '6C', 'MATH_HS', 'MATH_07', 5, 1, '2026-SPRING'), ('c-6c-mgl', '6C', 'MON_LANG', 'MGL_03', 4, 1, '2026-SPRING'), ('c-6c-eng', '6C', 'ENG_LIT', 'LANG_02', 4, 1, '2026-SPRING'),
('c-6d-mat', '6D', 'MATH_HS', 'MATH_08', 5, 1, '2026-SPRING'), ('c-6d-mgl', '6D', 'MON_LANG', 'MGL_04', 4, 1, '2026-SPRING'), ('c-6d-eng', '6D', 'ENG_LIT', 'LANG_03', 4, 1, '2026-SPRING');

-- 7–8-р анги (Дунд: ээлж 2) — 6-р ангитай ижил бүтэц
INSERT INTO curriculum (id, group_id, subject_id, teacher_id, weekly_hours, hours_per_session, semester_id) VALUES
('c-7a-mat', '7A', 'MATH_HS', 'MATH_05', 5, 1, '2026-SPRING'), ('c-7a-mgl', '7A', 'MON_LANG', 'MGL_01', 4, 1, '2026-SPRING'), ('c-7a-eng', '7A', 'ENG_LIT', 'LANG_09', 4, 1, '2026-SPRING'),
('c-7b-mat', '7B', 'MATH_HS', 'MATH_06', 5, 1, '2026-SPRING'), ('c-7b-mgl', '7B', 'MON_LANG', 'MGL_02', 4, 1, '2026-SPRING'), ('c-7b-eng', '7B', 'ENG_LIT', 'LANG_01', 4, 1, '2026-SPRING'),
('c-7c-mat', '7C', 'MATH_HS', 'MATH_07', 5, 1, '2026-SPRING'), ('c-7c-mgl', '7C', 'MON_LANG', 'MGL_03', 4, 1, '2026-SPRING'), ('c-7c-eng', '7C', 'ENG_LIT', 'LANG_02', 4, 1, '2026-SPRING'),
('c-7d-mat', '7D', 'MATH_HS', 'MATH_08', 5, 1, '2026-SPRING'), ('c-7d-mgl', '7D', 'MON_LANG', 'MGL_04', 4, 1, '2026-SPRING'), ('c-7d-eng', '7D', 'ENG_LIT', 'LANG_03', 4, 1, '2026-SPRING');

INSERT INTO curriculum (id, group_id, subject_id, teacher_id, weekly_hours, hours_per_session, semester_id) VALUES
('c-8a-mat', '8A', 'MATH_HS', 'MATH_05', 5, 1, '2026-SPRING'), ('c-8a-mgl', '8A', 'MON_LANG', 'MGL_01', 4, 1, '2026-SPRING'), ('c-8a-eng', '8A', 'ENG_LIT', 'LANG_09', 4, 1, '2026-SPRING'),
('c-8b-mat', '8B', 'MATH_HS', 'MATH_06', 5, 1, '2026-SPRING'), ('c-8b-mgl', '8B', 'MON_LANG', 'MGL_02', 4, 1, '2026-SPRING'), ('c-8b-eng', '8B', 'ENG_LIT', 'LANG_01', 4, 1, '2026-SPRING'),
('c-8c-mat', '8C', 'MATH_HS', 'MATH_07', 5, 1, '2026-SPRING'), ('c-8c-mgl', '8C', 'MON_LANG', 'MGL_03', 4, 1, '2026-SPRING'), ('c-8c-eng', '8C', 'ENG_LIT', 'LANG_02', 4, 1, '2026-SPRING'),
('c-8d-mat', '8D', 'MATH_HS', 'MATH_08', 5, 1, '2026-SPRING'), ('c-8d-mgl', '8D', 'MON_LANG', 'MGL_04', 4, 1, '2026-SPRING'), ('c-8d-eng', '8D', 'ENG_LIT', 'LANG_03', 4, 1, '2026-SPRING');

INSERT INTO curriculum (id, group_id, subject_id, teacher_id, weekly_hours, hours_per_session, semester_id) VALUES
('c-9a-phy', '9A', 'PHYS_LAB', 'SCI_01', 4, 2, '2026-SPRING'), ('c-9a-ict', '9A', 'ICT_BASIC', 'SCI_02', 2, 2, '2026-SPRING'), ('c-9a-mat', '9A', 'MATH_HS', 'MATH_09', 6, 1, '2026-SPRING'),
('c-9b-phy', '9B', 'PHYS_LAB', 'SCI_03', 4, 2, '2026-SPRING'), ('c-9b-ict', '9B', 'ICT_BASIC', 'SCI_04', 2, 2, '2026-SPRING'), ('c-9b-mat', '9B', 'MATH_HS', 'MATH_10', 6, 1, '2026-SPRING'),
('c-9c-phy', '9C', 'PHYS_LAB', 'SCI_01', 4, 2, '2026-SPRING'), ('c-9c-ict', '9C', 'ICT_BASIC', 'SCI_02', 2, 2, '2026-SPRING'), ('c-9c-mat', '9C', 'MATH_HS', 'MATH_09', 6, 1, '2026-SPRING'),
('c-9d-phy', '9D', 'PHYS_LAB', 'SCI_03', 4, 2, '2026-SPRING'), ('c-9d-ict', '9D', 'ICT_BASIC', 'SCI_04', 2, 2, '2026-SPRING'), ('c-9d-mat', '9D', 'MATH_HS', 'MATH_10', 6, 1, '2026-SPRING');

-- ==========================================================
-- 10–12-р анги (Ахлах: ээлж 1) — мат + физик + мэдээлэл зүй (суурь)
-- ==========================================================

INSERT INTO curriculum (id, group_id, subject_id, teacher_id, weekly_hours, hours_per_session, semester_id) VALUES
('c-10a-mat', '10A', 'MATH_HS', 'MATH_11', 8, 1, '2026-SPRING'), ('c-10a-phy', '10A', 'PHYS_LAB', 'SCI_05', 6, 2, '2026-SPRING'), ('c-10a-ict', '10A', 'ICT_BASIC', 'SCI_06', 2, 2, '2026-SPRING'),
('c-10b-mat', '10B', 'MATH_HS', 'MATH_01', 8, 1, '2026-SPRING'), ('c-10b-phy', '10B', 'PHYS_LAB', 'SCI_07', 6, 2, '2026-SPRING'), ('c-10b-ict', '10B', 'ICT_BASIC', 'SCI_08', 2, 2, '2026-SPRING'),
('c-10c-mat', '10C', 'MATH_HS', 'MATH_02', 8, 1, '2026-SPRING'), ('c-10c-phy', '10C', 'PHYS_LAB', 'SCI_05', 6, 2, '2026-SPRING'), ('c-10c-ict', '10C', 'ICT_BASIC', 'SCI_06', 2, 2, '2026-SPRING'),
('c-10d-mat', '10D', 'MATH_HS', 'MATH_03', 8, 1, '2026-SPRING'), ('c-10d-phy', '10D', 'PHYS_LAB', 'SCI_07', 6, 2, '2026-SPRING'), ('c-10d-ict', '10D', 'ICT_BASIC', 'SCI_08', 2, 2, '2026-SPRING');

INSERT INTO curriculum (id, group_id, subject_id, teacher_id, weekly_hours, hours_per_session, semester_id) VALUES
('c-11a-mat', '11A', 'MATH_HS', 'MATH_04', 8, 1, '2026-SPRING'), ('c-11a-phy', '11A', 'PHYS_LAB', 'SCI_05', 6, 2, '2026-SPRING'), ('c-11a-ict', '11A', 'ICT_BASIC', 'SCI_06', 2, 2, '2026-SPRING'),
('c-11b-mat', '11B', 'MATH_HS', 'MATH_11', 8, 1, '2026-SPRING'), ('c-11b-phy', '11B', 'PHYS_LAB', 'SCI_07', 6, 2, '2026-SPRING'), ('c-11b-ict', '11B', 'ICT_BASIC', 'SCI_08', 2, 2, '2026-SPRING'),
('c-11c-mat', '11C', 'MATH_HS', 'MATH_01', 8, 1, '2026-SPRING'), ('c-11c-phy', '11C', 'PHYS_LAB', 'SCI_05', 6, 2, '2026-SPRING'), ('c-11c-ict', '11C', 'ICT_BASIC', 'SCI_06', 2, 2, '2026-SPRING'),
('c-11d-mat', '11D', 'MATH_HS', 'MATH_02', 8, 1, '2026-SPRING'), ('c-11d-phy', '11D', 'PHYS_LAB', 'SCI_07', 6, 2, '2026-SPRING'), ('c-11d-ict', '11D', 'ICT_BASIC', 'SCI_08', 2, 2, '2026-SPRING');

INSERT INTO curriculum (id, group_id, subject_id, teacher_id, weekly_hours, hours_per_session, semester_id) VALUES
('c-12a-mat', '12A', 'MATH_HS', 'MATH_11', 8, 1, '2026-SPRING'), ('c-12a-phy', '12A', 'PHYS_LAB', 'SCI_05', 6, 2, '2026-SPRING'), ('c-12a-ict', '12A', 'ICT_BASIC', 'SCI_06', 2, 2, '2026-SPRING'),
('c-12b-mat', '12B', 'MATH_HS', 'MATH_01', 8, 1, '2026-SPRING'), ('c-12b-phy', '12B', 'PHYS_LAB', 'SCI_07', 6, 2, '2026-SPRING'), ('c-12b-ict', '12B', 'ICT_BASIC', 'SCI_08', 2, 2, '2026-SPRING'),
('c-12c-mat', '12C', 'MATH_HS', 'MATH_03', 8, 1, '2026-SPRING'), ('c-12c-phy', '12C', 'PHYS_LAB', 'SCI_05', 6, 2, '2026-SPRING'), ('c-12c-ict', '12C', 'ICT_BASIC', 'SCI_06', 2, 2, '2026-SPRING'),
('c-12d-mat', '12D', 'MATH_HS', 'MATH_04', 8, 1, '2026-SPRING'), ('c-12d-phy', '12D', 'PHYS_LAB', 'SCI_07', 6, 2, '2026-SPRING'), ('c-12d-ict', '12D', 'ICT_BASIC', 'SCI_08', 2, 2, '2026-SPRING');

PRAGMA foreign_keys = ON;
