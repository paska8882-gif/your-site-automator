-- ============================================
-- ПОЛНАЯ МИГРАЦИЯ ПОЛЬЗОВАТЕЛЕЙ + КОМАНД
-- Выполнять в SQL Editor нового Supabase проекта
-- ПОРЯДОК: 1) Этот файл  2) docs/team-data-export.sql
-- ============================================

-- ⚠️ КРИТИЧНО: Переключаемся на роль с полными правами
-- (без этого SQL Editor не может писать в auth.users)
SET ROLE supabase_admin;

-- Отключаем триггер создания профилей, чтобы избежать конфликтов:
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- ============================================
-- 1. ИМПОРТ auth.users (с паролями и UUID)
-- ============================================
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token, email_change_token_new,
  email_change, last_sign_in_at, is_sso_user, deleted_at
) VALUES
-- 1) Роман (paska8882@gmail.com)
('00000000-0000-0000-0000-000000000000', 'c1d35aff-7150-44f0-a761-b12b456d02d9', 'authenticated', 'authenticated',
 'paska8882@gmail.com', '$2a$10$6HFgF5w7WNtny/Gp9ptpEOvKi3O4HVPEXD5DFNIdxXab9p5zXHE1G',
 '2025-12-15 10:49:05.693401+00', '2025-12-15 10:49:05.665086+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Роман","email":"paska8882@gmail.com","email_verified":true,"phone_verified":false,"sub":"c1d35aff-7150-44f0-a761-b12b456d02d9"}',
 false, '', '', '', '', '2025-12-15 10:49:05.693401+00', false, null),

-- 2) andrzej (df.roman.paskevych@gmail.com)
('00000000-0000-0000-0000-000000000000', 'a82e290b-1383-4be3-b3cd-e11004fe4056', 'authenticated', 'authenticated',
 'df.roman.paskevych@gmail.com', '$2a$10$Aj1mTCGeffSmA6ckmT/Niei7Mz21KbKEcpQ6kX14Sx1oBfSaojAmK',
 '2025-12-15 11:00:01.337834+00', '2025-12-15 11:00:01.310031+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"andrzej","email":"df.roman.paskevych@gmail.com","email_verified":true,"phone_verified":false,"sub":"a82e290b-1383-4be3-b3cd-e11004fe4056"}',
 false, '', '', '', '', '2025-12-15 11:00:01.337834+00', false, null),

-- 3) Макс (mellmax2517@gmail.com)
('00000000-0000-0000-0000-000000000000', '0bce4a3e-fbca-4bea-9aa2-8f426ce7a4e0', 'authenticated', 'authenticated',
 'mellmax2517@gmail.com', '$2a$10$Z4uLi9kwf7NEc3Rr.PBTwOVTGMqQklRt4NusIDqa4jipVku9sJA8K',
 '2025-12-15 11:14:36.708332+00', '2025-12-15 11:14:36.687759+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Макс","email":"mellmax2517@gmail.com","email_verified":true,"phone_verified":false,"sub":"0bce4a3e-fbca-4bea-9aa2-8f426ce7a4e0"}',
 false, '', '', '', '', '2025-12-15 11:14:36.708332+00', false, null),

-- 4) roman (drago@gmail.com)
('00000000-0000-0000-0000-000000000000', '0d9c637e-3617-4177-9683-2526e416b2e9', 'authenticated', 'authenticated',
 'drago@gmail.com', '$2a$10$xXsdNLSKTiAxtGBcpNoNdO4vmhi0SCKCUJc4zyxM9OX8W68YwURJG',
 '2025-12-16 07:03:06.320204+00', '2025-12-16 07:03:06.288032+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"roman","email":"drago@gmail.com","email_verified":true,"phone_verified":false,"sub":"0d9c637e-3617-4177-9683-2526e416b2e9"}',
 false, '', '', '', '', '2025-12-16 07:03:06.320204+00', false, null),

-- 5) chujpizda@sraka.net
('00000000-0000-0000-0000-000000000000', '2aed9872-3fa3-4414-bb86-257de084aef0', 'authenticated', 'authenticated',
 'chujpizda@sraka.net', '$2a$10$6YYURkz5MEcvLk6FfuZ3DuRDKdLcF6MhlqsZ7Bayw3aQsxIufsCp.',
 '2025-12-16 11:05:19.608184+00', '2025-12-16 11:05:19.542109+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"chujpizda@sraka.net","email":"chujpizda@sraka.net","email_verified":true,"phone_verified":false,"sub":"2aed9872-3fa3-4414-bb86-257de084aef0"}',
 false, '', '', '', '', '2025-12-16 11:05:19.608184+00', false, null),

-- 6) ffst (ffstnetlify23@gmail.com)
('00000000-0000-0000-0000-000000000000', 'c4f524ff-ede0-4b91-af9a-41b6d74a9238', 'authenticated', 'authenticated',
 'ffstnetlify23@gmail.com', '$2a$10$HtDXfMcKDh41Z8w4v39zFuFQlIexuqkEDsif0IL3uTf1kHOxSKeiO',
 '2025-12-16 11:29:07.113716+00', '2025-12-16 11:29:07.065527+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"ffst","email":"ffstnetlify23@gmail.com","email_verified":true,"phone_verified":false,"sub":"c4f524ff-ede0-4b91-af9a-41b6d74a9238"}',
 false, '', '', '', '', '2025-12-16 11:29:07.113716+00', false, null),

-- 7) ouy (allpartswork228@gmail.com)
('00000000-0000-0000-0000-000000000000', '50237c38-516b-494b-9a59-9dce7bca544f', 'authenticated', 'authenticated',
 'allpartswork228@gmail.com', '$2a$10$i4y4VaHHi/Pl3rKOFaYMdOxUzWcPVyBck0lfASS/iVd9qOjaisxOi',
 '2025-12-16 15:12:04.175401+00', '2025-12-16 15:12:04.13141+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"ouy","email":"allpartswork228@gmail.com","email_verified":true,"phone_verified":false,"sub":"50237c38-516b-494b-9a59-9dce7bca544f"}',
 false, '', '', '', '', '2025-12-16 15:12:04.175401+00', false, null),

-- 8) upiyo (upiyo@gmail.com)
('00000000-0000-0000-0000-000000000000', 'bcacad63-161e-4852-99c1-4b2f24735df5', 'authenticated', 'authenticated',
 'upiyo@gmail.com', '$2a$10$6W/Jsx/FdBzPJFTXCxX6FODJ8LvmUaD5bFw/ixs5ItvgxGSrEoX0a',
 '2025-12-16 15:12:20.292433+00', '2025-12-16 15:12:20.27743+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"upiyo","email":"upiyo@gmail.com","email_verified":true,"phone_verified":false,"sub":"bcacad63-161e-4852-99c1-4b2f24735df5"}',
 false, '', '', '', '', '2025-12-16 15:12:20.292433+00', false, null),

-- 9) Мінет по 5 грн (popa228229@gmail.com)
('00000000-0000-0000-0000-000000000000', 'a54848e1-f40a-40f3-bf58-3d2f8a741f98', 'authenticated', 'authenticated',
 'popa228229@gmail.com', '$2a$10$QofNJt/hMp.SSimgThrVnurOzSby.21tjeq4jwsKlIa6DnIHdqUue',
 '2025-12-16 15:15:06.111193+00', '2025-12-16 15:15:06.080715+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Мінет по 5 грн","email":"popa228229@gmail.com","email_verified":true,"phone_verified":false,"sub":"a54848e1-f40a-40f3-bf58-3d2f8a741f98"}',
 false, '', '', '', '', '2025-12-16 15:15:06.111193+00', false, null),

-- 10) diablo (danyadrakon121@gmail.com)
('00000000-0000-0000-0000-000000000000', '4caf18dc-3744-43a5-bbcf-625fb27e44c2', 'authenticated', 'authenticated',
 'danyadrakon121@gmail.com', '$2a$10$Hte5ki4tvJOshV/96/WJxuP.c44X5qcBpmnGoP3dX2QDqRSxmgKkS',
 '2025-12-17 10:32:26.507245+00', '2025-12-17 10:32:26.456572+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"diablo","email":"danyadrakon121@gmail.com","email_verified":true,"phone_verified":false,"sub":"4caf18dc-3744-43a5-bbcf-625fb27e44c2"}',
 false, '', '', '', '', '2025-12-17 10:32:26.507245+00', false, null),

-- 11) .. (tryrrederre@gmail.com)
('00000000-0000-0000-0000-000000000000', '75e05cff-7bd3-4313-9640-c5a2b919e7d9', 'authenticated', 'authenticated',
 'tryrrederre@gmail.com', '$2a$10$ricRBuwKN/sgxzEkcOmxwuGwX4MsjwoLT66m1J6u82U/LVzcrWrTK',
 '2025-12-18 12:35:42.881538+00', '2025-12-18 12:35:42.761287+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"..","email":"tryrrederre@gmail.com","email_verified":true,"phone_verified":false,"sub":"75e05cff-7bd3-4313-9640-c5a2b919e7d9"}',
 false, '', '', '', '', '2025-12-18 12:35:42.881538+00', false, null),

-- 12) CHMK (viktordjim003@gmail.com)
('00000000-0000-0000-0000-000000000000', '3b32eb23-8cd5-46fc-912a-f7b47335a8da', 'authenticated', 'authenticated',
 'viktordjim003@gmail.com', '$2a$10$zGOLVQhM0OtzZ4FKL5YZgeRaxGqy.FTcc4SqVX5w.AvIOgE14tJMG',
 '2025-12-19 11:30:18.40985+00', '2025-12-19 11:30:18.199553+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"CHMK","email":"viktordjim003@gmail.com","email_verified":true,"phone_verified":false,"sub":"3b32eb23-8cd5-46fc-912a-f7b47335a8da"}',
 false, '', '', '', '', '2025-12-19 11:30:18.40985+00', false, null),

-- 13) Деркос (gmazda@gma.com)
('00000000-0000-0000-0000-000000000000', 'e25e4233-8953-40bb-9802-12bdee16007a', 'authenticated', 'authenticated',
 'gmazda@gma.com', '$2a$10$B0jDAlad2uJiXxIcGhy/B.nsRD1CFPp/RoIf2R0mfT6Mj1ptZsyhG',
 '2025-12-19 12:06:22.543983+00', '2025-12-19 12:06:22.486673+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Деркос ","email":"gmazda@gma.com","email_verified":true,"phone_verified":false,"sub":"e25e4233-8953-40bb-9802-12bdee16007a"}',
 false, '', '', '', '', '2025-12-19 12:06:22.543983+00', false, null),

-- 14) graoe (graoe@graoe.com)
('00000000-0000-0000-0000-000000000000', 'de101b02-e887-4705-a509-07e940b1430b', 'authenticated', 'authenticated',
 'graoe@graoe.com', '$2a$10$C8OuKWUbP2/Aebbshm3RxeDDxaX7qIn3fzpQgk6uJSRRrL1LMF0i2',
 '2025-12-21 14:18:02.367222+00', '2025-12-21 14:18:02.24327+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"graoe","email":"graoe@graoe.com","email_verified":true,"phone_verified":false,"sub":"de101b02-e887-4705-a509-07e940b1430b"}',
 false, '', '', '', '', '2025-12-21 14:18:02.367222+00', false, null),

-- 15) Баєрок (upiyo1212@gmail.com)
('00000000-0000-0000-0000-000000000000', 'd2d9a56b-5798-475d-a277-61bb4f4515ee', 'authenticated', 'authenticated',
 'upiyo1212@gmail.com', '$2a$10$dYhl/KXxiVajxozlpaH5iuw9MKjqpL6POKNlOTdt9B03r2UYnb6nS',
 '2025-12-22 09:19:06.89283+00', '2025-12-22 09:19:06.781894+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Баєрок","email":"upiyo1212@gmail.com","email_verified":true,"phone_verified":false,"sub":"d2d9a56b-5798-475d-a277-61bb4f4515ee"}',
 false, '', '', '', '', '2025-12-22 09:19:06.89283+00', false, null),

-- 16) Олексій (latonyator@gmail.com)
('00000000-0000-0000-0000-000000000000', '09366331-9c37-41d9-a89c-df59fdb3d0fd', 'authenticated', 'authenticated',
 'latonyator@gmail.com', '$2a$10$KbdtQ3kSoSoI6XjJVZm.keXGfq4I9CiLm.VOW5hcprYvlbaXs0.RS',
 '2025-12-22 11:40:25.813246+00', '2025-12-22 11:40:25.762589+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Олексій","email":"latonyator@gmail.com","email_verified":true,"phone_verified":false,"sub":"09366331-9c37-41d9-a89c-df59fdb3d0fd"}',
 false, '', '', '', '', '2025-12-22 11:40:25.813246+00', false, null),

-- 17) Avi (avi8998990@gmail.com)
('00000000-0000-0000-0000-000000000000', 'a921da1e-5ca4-44d3-a6dc-bd1922ddc176', 'authenticated', 'authenticated',
 'avi8998990@gmail.com', '$2a$10$2GvxKZeM6hRlOXK0R0G5rOscgLiu0We9tw6aSw8GqwbNyDG6qd5Oq',
 '2025-12-22 11:54:34.160537+00', '2025-12-22 11:54:34.061864+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Avi","email":"avi8998990@gmail.com","email_verified":true,"phone_verified":false,"sub":"a921da1e-5ca4-44d3-a6dc-bd1922ddc176"}',
 false, '', '', '', '', '2025-12-22 11:54:34.160537+00', false, null),

-- 18) Jenifer (jenifer666@gmai.com)
('00000000-0000-0000-0000-000000000000', '22343e7e-1bc3-4aef-9e56-8ccbe11b3a88', 'authenticated', 'authenticated',
 'jenifer666@gmai.com', '$2a$10$91qXBDvBQ9Uy.F5CEsEJnO8PUOl25voHWfrdCUWtzxSXcyRkP9/9.',
 '2025-12-22 12:02:56.17658+00', '2025-12-22 12:02:56.112583+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Jenifer","email":"jenifer666@gmai.com","email_verified":true,"phone_verified":false,"sub":"22343e7e-1bc3-4aef-9e56-8ccbe11b3a88"}',
 false, '', '', '', '', '2025-12-22 12:02:56.17658+00', false, null),

-- 19) xtati (xtatiwork@gmail.com)
('00000000-0000-0000-0000-000000000000', '158bcf00-6267-481e-b46b-44f75b3ec2e8', 'authenticated', 'authenticated',
 'xtatiwork@gmail.com', '$2a$10$ueK5X85DQI0aBJFqKez4Ge6PDnlcgyh8jIHznd4utNj5x4flQgnyK',
 '2026-01-04 15:37:00.472607+00', '2026-01-04 15:37:00.413209+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"xtati","email":"xtatiwork@gmail.com","email_verified":true,"phone_verified":false,"sub":"158bcf00-6267-481e-b46b-44f75b3ec2e8"}',
 false, '', '', '', '', '2026-01-04 15:37:00.472607+00', false, null),

-- 20) alexrj (alexrjanov@gmail.com)
('00000000-0000-0000-0000-000000000000', '67e24af2-18cf-4b11-9fe9-d813924b1f67', 'authenticated', 'authenticated',
 'alexrjanov@gmail.com', '$2a$10$908fek/aBU2hHFOdXg0q/OWjXLHxs/KKGG4QqPir/DYfbHpXlYOz2',
 '2026-01-05 09:53:14.656429+00', '2026-01-05 09:53:14.548256+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"alexrj","email":"alexrjanov@gmail.com","email_verified":true,"phone_verified":false,"sub":"67e24af2-18cf-4b11-9fe9-d813924b1f67"}',
 false, '', '', '', '', '2026-01-05 09:53:14.656429+00', false, null),

-- 21) AgentH (h.xtatiteam@hotmail.com)
('00000000-0000-0000-0000-000000000000', 'cce134df-8a5c-43d6-b549-17845a16a03a', 'authenticated', 'authenticated',
 'h.xtatiteam@hotmail.com', '$2a$10$pdbLyC.CND0yLrnOGPn5TuM3RKXAx4vt36vWdRBD4PN1VavIYg02C',
 '2026-01-12 08:26:48.762385+00', '2026-01-12 08:26:48.700381+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"AgentH","email":"h.xtatiteam@hotmail.com","email_verified":true,"phone_verified":false,"sub":"cce134df-8a5c-43d6-b549-17845a16a03a"}',
 false, '', '', '', '', '2026-01-12 08:26:48.762385+00', false, null),

-- 22) shimo (shimokarma@outlook.com)
('00000000-0000-0000-0000-000000000000', '60932ee8-97bd-40f2-a1ed-9986df46915d', 'authenticated', 'authenticated',
 'shimokarma@outlook.com', '$2a$10$SfG9mAvRD8ih.Y4nEOCYa..b8HjYypESh3RVKS/1Rznpz2qYTHcGi',
 '2026-01-12 08:44:08.83859+00', '2026-01-12 08:44:08.730128+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"shimo","email":"shimokarma@outlook.com","email_verified":true,"phone_verified":false,"sub":"60932ee8-97bd-40f2-a1ed-9986df46915d"}',
 false, '', '', '', '', '2026-01-12 08:44:08.83859+00', false, null),

-- 23) mitjaj (mitjajkarma@outlook.com)
('00000000-0000-0000-0000-000000000000', '3fe5abe3-593b-4ed7-a5d9-bbb1e62a154f', 'authenticated', 'authenticated',
 'mitjajkarma@outlook.com', '$2a$10$21hMZGvksy/MhwylFsGapeeZQiGgg8YAycTKjNLgXeSXEiW56jbWe',
 '2026-01-12 09:45:12.139179+00', '2026-01-12 09:45:12.062008+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"mitjaj","email":"mitjajkarma@outlook.com","email_verified":true,"phone_verified":false,"sub":"3fe5abe3-593b-4ed7-a5d9-bbb1e62a154f"}',
 false, '', '', '', '', '2026-01-12 09:45:12.139179+00', false, null),

-- 24) Black (chikatilalala@gmail.com)
('00000000-0000-0000-0000-000000000000', 'f16e2e92-95ab-4a5a-a265-db04c75bc179', 'authenticated', 'authenticated',
 'chikatilalala@gmail.com', '$2a$10$igC4CI88GJ78jqEpQtT.de50JjnQzQno3Rcpejp0VhTXvdYoDUsAq',
 '2026-01-23 11:45:45.529704+00', '2026-01-23 11:45:45.521035+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Black","email":"chikatilalala@gmail.com","email_verified":true,"phone_verified":false,"sub":"f16e2e92-95ab-4a5a-a265-db04c75bc179"}',
 false, '', '', '', '', '2026-01-23 11:45:45.529704+00', false, null),

-- 25) Natali (nataliportman3388@protonmail.com)
('00000000-0000-0000-0000-000000000000', '3860ea04-5024-49d8-a7e6-6c68387e5abf', 'authenticated', 'authenticated',
 'nataliportman3388@protonmail.com', '$2a$10$up14Fa.gEJBi4TiqSgkZqOAiykcsUnfbkqWFo/wGDCJGoOTGbYHl2',
 '2026-01-23 13:10:52.509827+00', '2026-01-23 13:10:52.503458+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Natali","email":"nataliportman3388@protonmail.com","email_verified":true,"phone_verified":false,"sub":"3860ea04-5024-49d8-a7e6-6c68387e5abf"}',
 false, '', '', '', '', '2026-01-23 13:10:52.509827+00', false, null),

-- 26) VEX (noivex14@gmail.com)
('00000000-0000-0000-0000-000000000000', '5465c9f7-0777-4eca-b5d9-fa44d4a48346', 'authenticated', 'authenticated',
 'noivex14@gmail.com', '$2a$10$kicUOek.Nj2AbKV.8BekfurjwlMkOSCPIcz8LfPT5QPUEwB5h0uLS',
 '2026-01-23 13:12:42.512372+00', '2026-01-23 13:12:42.507587+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"VEX","email":"noivex14@gmail.com","email_verified":true,"phone_verified":false,"sub":"5465c9f7-0777-4eca-b5d9-fa44d4a48346"}',
 false, '', '', '', '', '2026-01-23 13:12:42.512372+00', false, null),

-- 27) nothing549 (darkwolf5479@gmail.com)
('00000000-0000-0000-0000-000000000000', '825f463c-7cd3-46fa-b911-b4ae9d372fb2', 'authenticated', 'authenticated',
 'darkwolf5479@gmail.com', '$2a$10$tHwSARC63PcdFJJPri.7u.WSzAx6TFTmWnu/SzxLa/wku5A76xRAW',
 '2026-01-23 13:20:21.870303+00', '2026-01-23 13:20:21.863316+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"nothing549","email":"darkwolf5479@gmail.com","email_verified":true,"phone_verified":false,"sub":"825f463c-7cd3-46fa-b911-b4ae9d372fb2"}',
 false, '', '', '', '', '2026-01-23 13:20:21.870303+00', false, null),

-- 28) Avi (akazomekozo788@gmail.com)
('00000000-0000-0000-0000-000000000000', 'b349c9dd-a04b-426a-bdf4-193c667a8f3a', 'authenticated', 'authenticated',
 'akazomekozo788@gmail.com', '$2a$10$dWSpIcE0Vsc47I7ZlGVVX.l8b0F/H0PzSHVNbv2jmEfzXRt1psp3C',
 '2026-01-23 13:42:19.838436+00', '2026-01-23 13:42:19.83254+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Avi","email":"akazomekozo788@gmail.com","email_verified":true,"phone_verified":false,"sub":"b349c9dd-a04b-426a-bdf4-193c667a8f3a"}',
 false, '', '', '', '', '2026-01-23 13:42:19.838436+00', false, null),

-- 29) Баєрок (baier12312312@gmail.com)
('00000000-0000-0000-0000-000000000000', '84224d27-a16e-4478-b847-03a008f7a9b1', 'authenticated', 'authenticated',
 'baier12312312@gmail.com', '$2a$10$wWqklKo5TonFCB/unOVi5.UiA3a4Hse2oL9NKIh9KRoQ5Plf5N.eC',
 '2026-01-26 09:44:10.611131+00', '2026-01-26 09:44:10.604612+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Баєрок","email":"baier12312312@gmail.com","email_verified":true,"phone_verified":false,"sub":"84224d27-a16e-4478-b847-03a008f7a9b1"}',
 false, '', '', '', '', '2026-01-26 09:44:10.611131+00', false, null),

-- 30) Олександр (sahok123444@gmail.com)
('00000000-0000-0000-0000-000000000000', 'fa903815-f573-456b-b54c-060216a3bf7e', 'authenticated', 'authenticated',
 'sahok123444@gmail.com', '$2a$10$Yyfs96gsUnCQQ/TQm/D5mOa8RrwC5eyF4zhBFI8uq0bd6UCG2AZla',
 '2026-01-27 09:52:05.642177+00', '2026-01-27 09:52:05.636229+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Олександр","email":"sahok123444@gmail.com","email_verified":true,"phone_verified":false,"sub":"fa903815-f573-456b-b54c-060216a3bf7e"}',
 false, '', '', '', '', '2026-01-27 09:52:05.642177+00', false, null),

-- 31) mmm (tor70398@gmail.com)
('00000000-0000-0000-0000-000000000000', '9b8ca40e-410f-40e7-88d1-bfa6dfb9743d', 'authenticated', 'authenticated',
 'tor70398@gmail.com', '$2a$10$TiMSzJUHYtXza1acewxjteE8RqD3xWnvWPCiZmJZu05RsMSIeaqL2',
 '2026-01-27 10:58:48.987137+00', '2026-01-27 10:58:48.980394+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"mmm","email":"tor70398@gmail.com","email_verified":true,"phone_verified":false,"sub":"9b8ca40e-410f-40e7-88d1-bfa6dfb9743d"}',
 false, '', '', '', '', '2026-01-27 10:58:48.987137+00', false, null),

-- 32) Nik (niktech@statsaff.fun)
('00000000-0000-0000-0000-000000000000', '632e3204-b94a-471c-93ce-16033b4f81b3', 'authenticated', 'authenticated',
 'niktech@statsaff.fun', '$2a$10$iFN.Xjl.eUQko9vThuineOVp.0j1.9bI87Xdhp6CsbMDLHOuo02n6',
 '2026-01-28 09:39:26.015211+00', '2026-01-28 09:39:26.008528+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Nik","email":"niktech@statsaff.fun","email_verified":true,"phone_verified":false,"sub":"632e3204-b94a-471c-93ce-16033b4f81b3"}',
 false, '', '', '', '', '2026-01-28 09:39:26.015211+00', false, null),

-- 33) Krip (kripozzzzz@gmail.com)
('00000000-0000-0000-0000-000000000000', 'dc5e159b-efae-44e5-a505-45b3f02760df', 'authenticated', 'authenticated',
 'kripozzzzz@gmail.com', '$2a$10$4GoT88Dn1BJgN6YTTy9hkuFeSilVZbYhIE6HWk/mMczaQK45a9Tmq',
 '2026-01-28 09:52:21.644014+00', '2026-01-28 09:52:21.637105+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Krip","email":"kripozzzzz@gmail.com","email_verified":true,"phone_verified":false,"sub":"dc5e159b-efae-44e5-a505-45b3f02760df"}',
 false, '', '', '', '', '2026-01-28 09:52:21.644014+00', false, null),

-- 34) Yaryyyk (yasha2004oo@gmail.com)
('00000000-0000-0000-0000-000000000000', 'fd951f28-73c1-4c9c-a2e6-018495560f37', 'authenticated', 'authenticated',
 'yasha2004oo@gmail.com', '$2a$10$a031sXHegVzWiDTsXWvajOaUaCsUEjTvMazu6b0puyqiNd9oImhXe',
 '2026-01-28 09:53:46.999166+00', '2026-01-28 09:53:46.9948+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Yaryyyk","email":"yasha2004oo@gmail.com","email_verified":true,"phone_verified":false,"sub":"fd951f28-73c1-4c9c-a2e6-018495560f37"}',
 false, '', '', '', '', '2026-01-28 09:53:46.999166+00', false, null),

-- 35) Foma (pierro.peka@gmai.com)
('00000000-0000-0000-0000-000000000000', '4fc06865-00a7-4ab1-808a-3030d28be251', 'authenticated', 'authenticated',
 'pierro.peka@gmai.com', '$2a$10$PVFukGBINjnm/e8dCHuzbO2.Aml9BpelyHbeYv.FBumz6y6GOnn/W',
 '2026-01-28 10:19:53.026153+00', '2026-01-28 10:19:53.019419+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Foma","email":"pierro.peka@gmai.com","email_verified":true,"phone_verified":false,"sub":"4fc06865-00a7-4ab1-808a-3030d28be251"}',
 false, '', '', '', '', '2026-01-28 10:19:53.026153+00', false, null),

-- 36) jimmy (jimmy003838@gmail.com)
('00000000-0000-0000-0000-000000000000', '85dffa49-86b3-4d16-aef7-7a19525e8c81', 'authenticated', 'authenticated',
 'jimmy003838@gmail.com', '$2a$10$WR6J/30UOS9SXnDOUGCap.C5ocWitUNiSHc0DEotKtL9ud6fCQsSq',
 '2026-01-30 08:53:45.81254+00', '2026-01-30 08:53:45.805973+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"jimmy","email":"jimmy003838@gmail.com","email_verified":true,"phone_verified":false,"sub":"85dffa49-86b3-4d16-aef7-7a19525e8c81"}',
 false, '', '', '', '', '2026-01-30 08:53:45.81254+00', false, null),

-- 37) Mara (popo228229@gmail.com)
('00000000-0000-0000-0000-000000000000', '20c0a0b8-b8b0-48e0-8273-f06d9db5e83b', 'authenticated', 'authenticated',
 'popo228229@gmail.com', '$2a$10$iIVQ7X3jLtnJjEnTN.mnCOqo5Ff7kZghWd2BM7WFLL/x7eKklRP4u',
 '2026-02-06 09:54:47.580989+00', '2026-02-06 09:54:47.573876+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Mara","email":"popo228229@gmail.com","email_verified":true,"phone_verified":false,"sub":"20c0a0b8-b8b0-48e0-8273-f06d9db5e83b"}',
 false, '', '', '', '', '2026-02-06 09:54:47.580989+00', false, null),

-- 38) @shimo_000 (guapshimo@gmail.com)
('00000000-0000-0000-0000-000000000000', '041494eb-ad99-46f9-95ca-495e3c25477d', 'authenticated', 'authenticated',
 'guapshimo@gmail.com', '$2a$10$piBq21yL4FAtxrWgxs.g1eOVJI5DC24RX6ZJmqpmD4d4jX.N8DTKi',
 '2026-02-09 15:14:40.462985+00', '2026-02-09 15:14:40.456664+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"@shimo_000","email":"guapshimo@gmail.com","email_verified":true,"phone_verified":false,"sub":"041494eb-ad99-46f9-95ca-495e3c25477d"}',
 false, '', '', '', '', '2026-02-09 15:14:40.462985+00', false, null),

-- 39) Magnetto (midasgogo707@gmail.com)
('00000000-0000-0000-0000-000000000000', '399a89cc-2c00-45e4-a65b-895acd939d2a', 'authenticated', 'authenticated',
 'midasgogo707@gmail.com', '$2a$10$E4asZWX0GjA8Hm8nnID.1ukcpCTRHh604msjyyMkKNsM7K0JJZVki',
 '2026-02-18 11:15:08.080642+00', '2026-02-18 11:15:08.06984+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Magnetto","email":"midasgogo707@gmail.com","email_verified":true,"phone_verified":false,"sub":"399a89cc-2c00-45e4-a65b-895acd939d2a"}',
 false, '', '', '', '', '2026-02-18 11:15:08.080642+00', false, null),

-- 40) марк (m88461963@gmail.com)
('00000000-0000-0000-0000-000000000000', '725484c6-597a-4e71-a417-3212a00fdd20', 'authenticated', 'authenticated',
 'm88461963@gmail.com', '$2a$10$u46bhyXvZwmAoDEdyQZkJOM0Rn1foCus1yhjfS.2gfeqVWomfivJ.',
 '2026-02-25 09:55:34.73216+00', '2026-02-25 09:55:34.724978+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"марк","email":"m88461963@gmail.com","email_verified":true,"phone_verified":false,"sub":"725484c6-597a-4e71-a417-3212a00fdd20"}',
 false, '', '', '', '', '2026-02-25 09:55:34.73216+00', false, null),

-- 41) Дмитрий (flyadsaccs@gmail.com)
('00000000-0000-0000-0000-000000000000', '95fee440-09f1-4767-945e-cf0957874fd3', 'authenticated', 'authenticated',
 'flyadsaccs@gmail.com', '$2a$10$MtwKXbf1PhKc9jKzZQ.XceNWcGKH32fyZHWyRQNFhSgw4n6GDwvhS',
 '2026-02-26 10:20:29.177446+00', '2026-02-26 10:20:29.170455+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Дмитрий","email":"flyadsaccs@gmail.com","email_verified":true,"phone_verified":false,"sub":"95fee440-09f1-4767-945e-cf0957874fd3"}',
 false, '', '', '', '', '2026-02-26 10:20:29.177446+00', false, null),

-- 42) 999 (jackfords618@outlook.com)
('00000000-0000-0000-0000-000000000000', '5a89ca95-5ed3-49c9-9543-239a35b4feea', 'authenticated', 'authenticated',
 'jackfords618@outlook.com', '$2a$10$4agqzU3DTKz7H82rFp2gR.c0SZZtHE90XdEUJT1PUjgVb4y2k0zE.',
 '2026-02-27 14:22:45.377323+00', '2026-02-27 14:22:45.371139+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"999","email":"jackfords618@outlook.com","email_verified":true,"phone_verified":false,"sub":"5a89ca95-5ed3-49c9-9543-239a35b4feea"}',
 false, '', '', '', '', '2026-02-27 14:22:45.377323+00', false, null),

-- 43) Контік Тестік (facto@gmail.com)
('00000000-0000-0000-0000-000000000000', 'a3ad78f2-f58b-4bb4-a1ed-c80180c62f19', 'authenticated', 'authenticated',
 'facto@gmail.com', '$2a$10$k8IcVvnY9AsePYHj3X.1qumpCOcqiS7ztC08pY369B8MnIlMadkvu',
 '2026-02-27 14:47:23.955661+00', '2026-02-27 14:47:23.9492+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Контік Тестік","email":"facto@gmail.com","email_verified":true,"phone_verified":false,"sub":"a3ad78f2-f58b-4bb4-a1ed-c80180c62f19"}',
 false, '', '', '', '', '2026-02-27 14:47:23.955661+00', false, null),

-- 44) Рома (brabarukr@gmail.com)
('00000000-0000-0000-0000-000000000000', '548ee676-8b13-454c-87f3-c01553c665ce', 'authenticated', 'authenticated',
 'brabarukr@gmail.com', '$2a$10$5NGbVldb7by9sQ.WjzA.MOs71nRnY1KPrL9cZ0C5ZVdt/hM/bCFUa',
 '2026-03-02 12:18:23.679872+00', '2026-03-02 12:18:23.673554+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Рома","email":"brabarukr@gmail.com","email_verified":true,"phone_verified":false,"sub":"548ee676-8b13-454c-87f3-c01553c665ce"}',
 false, '', '', '', '', '2026-03-02 12:18:23.679872+00', false, null),

-- 45) Igris (igrisrodos@gmail.com)
('00000000-0000-0000-0000-000000000000', '39def399-53ae-4573-8877-9f03060a0351', 'authenticated', 'authenticated',
 'igrisrodos@gmail.com', '$2a$10$xMmw5xebdyI12wM0ionje.n6ITmVv0On7ByWan8a2UgdV9prz2Q2e',
 '2026-03-02 14:06:39.212665+00', '2026-03-02 14:06:39.206617+00', now(),
 '{"provider":"email","providers":["email"]}',
 '{"display_name":"Igris","email":"igrisrodos@gmail.com","email_verified":true,"phone_verified":false,"sub":"39def399-53ae-4573-8877-9f03060a0351"}',
 false, '', '', '', '', '2026-03-02 14:06:39.212665+00', false, null)

ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. ИМПОРТ auth.identities (обязательно для логина)
-- ============================================
INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data,
  created_at, updated_at, last_sign_in_at
) VALUES
('ba31fb73-d485-442d-b928-73027878944e', 'c1d35aff-7150-44f0-a761-b12b456d02d9', 'c1d35aff-7150-44f0-a761-b12b456d02d9', 'email', '{"display_name":"Роман","email":"paska8882@gmail.com","email_verified":false,"phone_verified":false,"sub":"c1d35aff-7150-44f0-a761-b12b456d02d9"}', '2025-12-15 10:49:05.687632+00', '2025-12-15 10:49:05.687632+00', '2025-12-15 10:49:05.687578+00'),
('b449fd81-6a90-475b-ac92-9af3891c02d5', 'a82e290b-1383-4be3-b3cd-e11004fe4056', 'a82e290b-1383-4be3-b3cd-e11004fe4056', 'email', '{"display_name":"andrzej","email":"df.roman.paskevych@gmail.com","email_verified":false,"phone_verified":false,"sub":"a82e290b-1383-4be3-b3cd-e11004fe4056"}', '2025-12-15 11:00:01.334104+00', '2025-12-15 11:00:01.334104+00', '2025-12-15 11:00:01.334048+00'),
('8dd2ee29-b528-4b7e-ae63-b4c1a534f462', '0bce4a3e-fbca-4bea-9aa2-8f426ce7a4e0', '0bce4a3e-fbca-4bea-9aa2-8f426ce7a4e0', 'email', '{"display_name":"Макс","email":"mellmax2517@gmail.com","email_verified":false,"phone_verified":false,"sub":"0bce4a3e-fbca-4bea-9aa2-8f426ce7a4e0"}', '2025-12-15 11:14:36.702266+00', '2025-12-15 11:14:36.702266+00', '2025-12-15 11:14:36.701582+00'),
('178d3c9c-9094-4e48-8880-6810662bf566', '0d9c637e-3617-4177-9683-2526e416b2e9', '0d9c637e-3617-4177-9683-2526e416b2e9', 'email', '{"display_name":"roman","email":"drago@gmail.com","email_verified":false,"phone_verified":false,"sub":"0d9c637e-3617-4177-9683-2526e416b2e9"}', '2025-12-16 07:03:06.313527+00', '2025-12-16 07:03:06.313527+00', '2025-12-16 07:03:06.313435+00'),
('c1143340-6636-4b5c-b6e9-98b95d8cf283', '2aed9872-3fa3-4414-bb86-257de084aef0', '2aed9872-3fa3-4414-bb86-257de084aef0', 'email', '{"display_name":"chujpizda@sraka.net","email":"chujpizda@sraka.net","email_verified":false,"phone_verified":false,"sub":"2aed9872-3fa3-4414-bb86-257de084aef0"}', '2025-12-16 11:05:19.587135+00', '2025-12-16 11:05:19.587135+00', '2025-12-16 11:05:19.587081+00'),
('ac4e5cf9-a850-4e21-adb6-971367bd63c9', 'c4f524ff-ede0-4b91-af9a-41b6d74a9238', 'c4f524ff-ede0-4b91-af9a-41b6d74a9238', 'email', '{"display_name":"ffst","email":"ffstnetlify23@gmail.com","email_verified":false,"phone_verified":false,"sub":"c4f524ff-ede0-4b91-af9a-41b6d74a9238"}', '2025-12-16 11:29:07.105926+00', '2025-12-16 11:29:07.105926+00', '2025-12-16 11:29:07.105872+00'),
('4a1401d2-d072-4531-a50f-26801bbebba0', '50237c38-516b-494b-9a59-9dce7bca544f', '50237c38-516b-494b-9a59-9dce7bca544f', 'email', '{"display_name":"ouy","email":"allpartswork228@gmail.com","email_verified":false,"phone_verified":false,"sub":"50237c38-516b-494b-9a59-9dce7bca544f"}', '2025-12-16 15:12:04.1687+00', '2025-12-16 15:12:04.1687+00', '2025-12-16 15:12:04.168641+00'),
('a95c6a2d-3840-44e0-9246-178f15ee3834', 'bcacad63-161e-4852-99c1-4b2f24735df5', 'bcacad63-161e-4852-99c1-4b2f24735df5', 'email', '{"display_name":"upiyo","email":"upiyo@gmail.com","email_verified":false,"phone_verified":false,"sub":"bcacad63-161e-4852-99c1-4b2f24735df5"}', '2025-12-16 15:12:20.289161+00', '2025-12-16 15:12:20.289161+00', '2025-12-16 15:12:20.289111+00'),
('8aa8c397-0423-41b8-8896-45a21d0c7d5d', 'a54848e1-f40a-40f3-bf58-3d2f8a741f98', 'a54848e1-f40a-40f3-bf58-3d2f8a741f98', 'email', '{"display_name":"Мінет по 5 грн","email":"popa228229@gmail.com","email_verified":false,"phone_verified":false,"sub":"a54848e1-f40a-40f3-bf58-3d2f8a741f98"}', '2025-12-16 15:15:06.102742+00', '2025-12-16 15:15:06.102742+00', '2025-12-16 15:15:06.102684+00'),
('fc577241-f404-4fc9-bcce-f6e21cb48978', '4caf18dc-3744-43a5-bbcf-625fb27e44c2', '4caf18dc-3744-43a5-bbcf-625fb27e44c2', 'email', '{"display_name":"diablo","email":"danyadrakon121@gmail.com","email_verified":false,"phone_verified":false,"sub":"4caf18dc-3744-43a5-bbcf-625fb27e44c2"}', '2025-12-17 10:32:26.492289+00', '2025-12-17 10:32:26.492289+00', '2025-12-17 10:32:26.492235+00'),
('02eb7195-1451-46c7-9a50-5330066ac4ac', '75e05cff-7bd3-4313-9640-c5a2b919e7d9', '75e05cff-7bd3-4313-9640-c5a2b919e7d9', 'email', '{"display_name":"..","email":"tryrrederre@gmail.com","email_verified":false,"phone_verified":false,"sub":"75e05cff-7bd3-4313-9640-c5a2b919e7d9"}', '2025-12-18 12:35:42.872494+00', '2025-12-18 12:35:42.872494+00', '2025-12-18 12:35:42.872426+00'),
('5952fd79-2792-4051-a36f-edfdca713c43', '3b32eb23-8cd5-46fc-912a-f7b47335a8da', '3b32eb23-8cd5-46fc-912a-f7b47335a8da', 'email', '{"display_name":"CHMK","email":"viktordjim003@gmail.com","email_verified":false,"phone_verified":false,"sub":"3b32eb23-8cd5-46fc-912a-f7b47335a8da"}', '2025-12-19 11:30:18.295674+00', '2025-12-19 11:30:18.295674+00', '2025-12-19 11:30:18.295616+00'),
('4eff0d2b-b7b3-4cc7-a3a2-56b5e72e2a9b', 'e25e4233-8953-40bb-9802-12bdee16007a', 'e25e4233-8953-40bb-9802-12bdee16007a', 'email', '{"display_name":"Деркос ","email":"gmazda@gma.com","email_verified":false,"phone_verified":false,"sub":"e25e4233-8953-40bb-9802-12bdee16007a"}', '2025-12-19 12:06:22.534271+00', '2025-12-19 12:06:22.534271+00', '2025-12-19 12:06:22.534217+00'),
('a6e2d32f-1a2b-4c3d-8e4f-5a6b7c8d9e0f', 'de101b02-e887-4705-a509-07e940b1430b', 'de101b02-e887-4705-a509-07e940b1430b', 'email', '{"display_name":"graoe","email":"graoe@graoe.com","email_verified":false,"phone_verified":false,"sub":"de101b02-e887-4705-a509-07e940b1430b"}', '2025-12-21 14:18:02.361421+00', '2025-12-21 14:18:02.361421+00', '2025-12-21 14:18:02.361367+00'),
('b7f3e43g-2b3c-5d4e-9f50-6b7c8d9e0f1a', 'd2d9a56b-5798-475d-a277-61bb4f4515ee', 'd2d9a56b-5798-475d-a277-61bb4f4515ee', 'email', '{"display_name":"Баєрок","email":"upiyo1212@gmail.com","email_verified":false,"phone_verified":false,"sub":"d2d9a56b-5798-475d-a277-61bb4f4515ee"}', '2025-12-22 09:19:06.885321+00', '2025-12-22 09:19:06.885321+00', '2025-12-22 09:19:06.885267+00'),
('c8a4f54h-3c4d-6e5f-a061-7c8d9e0f1a2b', '09366331-9c37-41d9-a89c-df59fdb3d0fd', '09366331-9c37-41d9-a89c-df59fdb3d0fd', 'email', '{"display_name":"Олексій","email":"latonyator@gmail.com","email_verified":false,"phone_verified":false,"sub":"09366331-9c37-41d9-a89c-df59fdb3d0fd"}', '2025-12-22 11:40:25.808723+00', '2025-12-22 11:40:25.808723+00', '2025-12-22 11:40:25.808665+00'),
('d9b5a65i-4d5e-7f6a-b172-8d9e0f1a2b3c', 'a921da1e-5ca4-44d3-a6dc-bd1922ddc176', 'a921da1e-5ca4-44d3-a6dc-bd1922ddc176', 'email', '{"display_name":"Avi","email":"avi8998990@gmail.com","email_verified":false,"phone_verified":false,"sub":"a921da1e-5ca4-44d3-a6dc-bd1922ddc176"}', '2025-12-22 11:54:34.154321+00', '2025-12-22 11:54:34.154321+00', '2025-12-22 11:54:34.154268+00'),
('e0c6b76j-5e6f-8a7b-c283-9e0f1a2b3c4d', '22343e7e-1bc3-4aef-9e56-8ccbe11b3a88', '22343e7e-1bc3-4aef-9e56-8ccbe11b3a88', 'email', '{"display_name":"Jenifer","email":"jenifer666@gmai.com","email_verified":false,"phone_verified":false,"sub":"22343e7e-1bc3-4aef-9e56-8ccbe11b3a88"}', '2025-12-22 12:02:56.170123+00', '2025-12-22 12:02:56.170123+00', '2025-12-22 12:02:56.170067+00'),
('f1d7c87k-6f7a-9b8c-d394-0f1a2b3c4d5e', '158bcf00-6267-481e-b46b-44f75b3ec2e8', '158bcf00-6267-481e-b46b-44f75b3ec2e8', 'email', '{"display_name":"xtati","email":"xtatiwork@gmail.com","email_verified":false,"phone_verified":false,"sub":"158bcf00-6267-481e-b46b-44f75b3ec2e8"}', '2026-01-04 15:37:00.466321+00', '2026-01-04 15:37:00.466321+00', '2026-01-04 15:37:00.466267+00'),
('a2e8d98l-7a8b-0c9d-e4a5-1a2b3c4d5e6f', '67e24af2-18cf-4b11-9fe9-d813924b1f67', '67e24af2-18cf-4b11-9fe9-d813924b1f67', 'email', '{"display_name":"alexrj","email":"alexrjanov@gmail.com","email_verified":false,"phone_verified":false,"sub":"67e24af2-18cf-4b11-9fe9-d813924b1f67"}', '2026-01-05 09:53:14.650123+00', '2026-01-05 09:53:14.650123+00', '2026-01-05 09:53:14.650067+00'),
('b3f9e09m-8b9c-1d0e-f5b6-2b3c4d5e6f7a', 'cce134df-8a5c-43d6-b549-17845a16a03a', 'cce134df-8a5c-43d6-b549-17845a16a03a', 'email', '{"display_name":"AgentH","email":"h.xtatiteam@hotmail.com","email_verified":false,"phone_verified":false,"sub":"cce134df-8a5c-43d6-b549-17845a16a03a"}', '2026-01-12 08:26:48.756123+00', '2026-01-12 08:26:48.756123+00', '2026-01-12 08:26:48.756067+00'),
('c4a0f10n-9c0d-2e1f-a6c7-3c4d5e6f7a8b', '60932ee8-97bd-40f2-a1ed-9986df46915d', '60932ee8-97bd-40f2-a1ed-9986df46915d', 'email', '{"display_name":"shimo","email":"shimokarma@outlook.com","email_verified":false,"phone_verified":false,"sub":"60932ee8-97bd-40f2-a1ed-9986df46915d"}', '2026-01-12 08:44:08.832123+00', '2026-01-12 08:44:08.832123+00', '2026-01-12 08:44:08.832067+00'),
('d5b1a21o-0d1e-3f2a-b7d8-4d5e6f7a8b9c', '3fe5abe3-593b-4ed7-a5d9-bbb1e62a154f', '3fe5abe3-593b-4ed7-a5d9-bbb1e62a154f', 'email', '{"display_name":"mitjaj","email":"mitjajkarma@outlook.com","email_verified":false,"phone_verified":false,"sub":"3fe5abe3-593b-4ed7-a5d9-bbb1e62a154f"}', '2026-01-12 09:45:12.133123+00', '2026-01-12 09:45:12.133123+00', '2026-01-12 09:45:12.133067+00'),
('e6c2b32p-1e2f-4a3b-c8e9-5e6f7a8b9c0d', 'f16e2e92-95ab-4a5a-a265-db04c75bc179', 'f16e2e92-95ab-4a5a-a265-db04c75bc179', 'email', '{"display_name":"Black","email":"chikatilalala@gmail.com","email_verified":false,"phone_verified":false,"sub":"f16e2e92-95ab-4a5a-a265-db04c75bc179"}', '2026-01-23 11:45:45.523123+00', '2026-01-23 11:45:45.523123+00', '2026-01-23 11:45:45.523067+00'),
('f7d3c43q-2f3a-5b4c-d9f0-6f7a8b9c0d1e', '3860ea04-5024-49d8-a7e6-6c68387e5abf', '3860ea04-5024-49d8-a7e6-6c68387e5abf', 'email', '{"display_name":"Natali","email":"nataliportman3388@protonmail.com","email_verified":false,"phone_verified":false,"sub":"3860ea04-5024-49d8-a7e6-6c68387e5abf"}', '2026-01-23 13:10:52.503123+00', '2026-01-23 13:10:52.503123+00', '2026-01-23 13:10:52.503067+00'),
('a8e4d54r-3a4b-6c5d-e0a1-7a8b9c0d1e2f', '5465c9f7-0777-4eca-b5d9-fa44d4a48346', '5465c9f7-0777-4eca-b5d9-fa44d4a48346', 'email', '{"display_name":"VEX","email":"noivex14@gmail.com","email_verified":false,"phone_verified":false,"sub":"5465c9f7-0777-4eca-b5d9-fa44d4a48346"}', '2026-01-23 13:12:42.507123+00', '2026-01-23 13:12:42.507123+00', '2026-01-23 13:12:42.507067+00'),
('b9f5e65s-4b5c-7d6e-f1b2-8b9c0d1e2f3a', '825f463c-7cd3-46fa-b911-b4ae9d372fb2', '825f463c-7cd3-46fa-b911-b4ae9d372fb2', 'email', '{"display_name":"nothing549","email":"darkwolf5479@gmail.com","email_verified":false,"phone_verified":false,"sub":"825f463c-7cd3-46fa-b911-b4ae9d372fb2"}', '2026-01-23 13:20:21.863123+00', '2026-01-23 13:20:21.863123+00', '2026-01-23 13:20:21.863067+00'),
('c0a6f76t-5c6d-8e7f-a2c3-9c0d1e2f3a4b', 'b349c9dd-a04b-426a-bdf4-193c667a8f3a', 'b349c9dd-a04b-426a-bdf4-193c667a8f3a', 'email', '{"display_name":"Avi","email":"akazomekozo788@gmail.com","email_verified":false,"phone_verified":false,"sub":"b349c9dd-a04b-426a-bdf4-193c667a8f3a"}', '2026-01-23 13:42:19.832123+00', '2026-01-23 13:42:19.832123+00', '2026-01-23 13:42:19.832067+00'),
('d1b7a87u-6d7e-9f8a-b3d4-0d1e2f3a4b5c', '84224d27-a16e-4478-b847-03a008f7a9b1', '84224d27-a16e-4478-b847-03a008f7a9b1', 'email', '{"display_name":"Баєрок","email":"baier12312312@gmail.com","email_verified":false,"phone_verified":false,"sub":"84224d27-a16e-4478-b847-03a008f7a9b1"}', '2026-01-26 09:44:10.604123+00', '2026-01-26 09:44:10.604123+00', '2026-01-26 09:44:10.604067+00'),
('e2c8b98v-7e8f-0a9b-c4e5-1e2f3a4b5c6d', 'fa903815-f573-456b-b54c-060216a3bf7e', 'fa903815-f573-456b-b54c-060216a3bf7e', 'email', '{"display_name":"Олександр","email":"sahok123444@gmail.com","email_verified":false,"phone_verified":false,"sub":"fa903815-f573-456b-b54c-060216a3bf7e"}', '2026-01-27 09:52:05.636123+00', '2026-01-27 09:52:05.636123+00', '2026-01-27 09:52:05.636067+00'),
('f3d9c09w-8f9a-1b0c-d5f6-2f3a4b5c6d7e', '9b8ca40e-410f-40e7-88d1-bfa6dfb9743d', '9b8ca40e-410f-40e7-88d1-bfa6dfb9743d', 'email', '{"display_name":"mmm","email":"tor70398@gmail.com","email_verified":false,"phone_verified":false,"sub":"9b8ca40e-410f-40e7-88d1-bfa6dfb9743d"}', '2026-01-27 10:58:48.980123+00', '2026-01-27 10:58:48.980123+00', '2026-01-27 10:58:48.980067+00'),
('a4e0d10x-9a0b-2c1d-e6a7-3a4b5c6d7e8f', '632e3204-b94a-471c-93ce-16033b4f81b3', '632e3204-b94a-471c-93ce-16033b4f81b3', 'email', '{"display_name":"Nik","email":"niktech@statsaff.fun","email_verified":false,"phone_verified":false,"sub":"632e3204-b94a-471c-93ce-16033b4f81b3"}', '2026-01-28 09:39:26.008123+00', '2026-01-28 09:39:26.008123+00', '2026-01-28 09:39:26.008067+00'),
('b5f1e21y-0b1c-3d2e-f7b8-4b5c6d7e8f9a', 'dc5e159b-efae-44e5-a505-45b3f02760df', 'dc5e159b-efae-44e5-a505-45b3f02760df', 'email', '{"display_name":"Krip","email":"kripozzzzz@gmail.com","email_verified":false,"phone_verified":false,"sub":"dc5e159b-efae-44e5-a505-45b3f02760df"}', '2026-01-28 09:52:21.637123+00', '2026-01-28 09:52:21.637123+00', '2026-01-28 09:52:21.637067+00'),
('c6a2f32z-1c2d-4e3f-a8c9-5c6d7e8f9a0b', 'fd951f28-73c1-4c9c-a2e6-018495560f37', 'fd951f28-73c1-4c9c-a2e6-018495560f37', 'email', '{"display_name":"Yaryyyk","email":"yasha2004oo@gmail.com","email_verified":false,"phone_verified":false,"sub":"fd951f28-73c1-4c9c-a2e6-018495560f37"}', '2026-01-28 09:53:46.994123+00', '2026-01-28 09:53:46.994123+00', '2026-01-28 09:53:46.994067+00'),
('d7b3a43a-2d3e-5f4a-b9d0-6d7e8f9a0b1c', '4fc06865-00a7-4ab1-808a-3030d28be251', '4fc06865-00a7-4ab1-808a-3030d28be251', 'email', '{"display_name":"Foma","email":"pierro.peka@gmai.com","email_verified":false,"phone_verified":false,"sub":"4fc06865-00a7-4ab1-808a-3030d28be251"}', '2026-01-28 10:19:53.019123+00', '2026-01-28 10:19:53.019123+00', '2026-01-28 10:19:53.019067+00'),
('e8c4b54b-3e4f-6a5b-c0e1-7e8f9a0b1c2d', '85dffa49-86b3-4d16-aef7-7a19525e8c81', '85dffa49-86b3-4d16-aef7-7a19525e8c81', 'email', '{"display_name":"jimmy","email":"jimmy003838@gmail.com","email_verified":false,"phone_verified":false,"sub":"85dffa49-86b3-4d16-aef7-7a19525e8c81"}', '2026-01-30 08:53:45.805123+00', '2026-01-30 08:53:45.805123+00', '2026-01-30 08:53:45.805067+00'),
('f9d5c65c-4f5a-7b6c-d1f2-8f9a0b1c2d3e', '20c0a0b8-b8b0-48e0-8273-f06d9db5e83b', '20c0a0b8-b8b0-48e0-8273-f06d9db5e83b', 'email', '{"display_name":"Mara","email":"popo228229@gmail.com","email_verified":false,"phone_verified":false,"sub":"20c0a0b8-b8b0-48e0-8273-f06d9db5e83b"}', '2026-02-06 09:54:47.573123+00', '2026-02-06 09:54:47.573123+00', '2026-02-06 09:54:47.573067+00'),
('a0e6d76d-5a6b-8c7d-e2a3-9a0b1c2d3e4f', '041494eb-ad99-46f9-95ca-495e3c25477d', '041494eb-ad99-46f9-95ca-495e3c25477d', 'email', '{"display_name":"@shimo_000","email":"guapshimo@gmail.com","email_verified":false,"phone_verified":false,"sub":"041494eb-ad99-46f9-95ca-495e3c25477d"}', '2026-02-09 15:14:40.456123+00', '2026-02-09 15:14:40.456123+00', '2026-02-09 15:14:40.456067+00'),
('b1f7e87e-6b7c-9d8e-f3b4-0b1c2d3e4f5a', '399a89cc-2c00-45e4-a65b-895acd939d2a', '399a89cc-2c00-45e4-a65b-895acd939d2a', 'email', '{"display_name":"Magnetto","email":"midasgogo707@gmail.com","email_verified":false,"phone_verified":false,"sub":"399a89cc-2c00-45e4-a65b-895acd939d2a"}', '2026-02-18 11:15:08.069123+00', '2026-02-18 11:15:08.069123+00', '2026-02-18 11:15:08.069067+00'),
('c2a8f98f-7c8d-0e9f-a4c5-1c2d3e4f5a6b', '725484c6-597a-4e71-a417-3212a00fdd20', '725484c6-597a-4e71-a417-3212a00fdd20', 'email', '{"display_name":"марк","email":"m88461963@gmail.com","email_verified":false,"phone_verified":false,"sub":"725484c6-597a-4e71-a417-3212a00fdd20"}', '2026-02-25 09:55:34.724123+00', '2026-02-25 09:55:34.724123+00', '2026-02-25 09:55:34.724067+00'),
('d3b9a09a-8d9e-1f0a-b5d6-2d3e4f5a6b7c', '95fee440-09f1-4767-945e-cf0957874fd3', '95fee440-09f1-4767-945e-cf0957874fd3', 'email', '{"display_name":"Дмитрий","email":"flyadsaccs@gmail.com","email_verified":false,"phone_verified":false,"sub":"95fee440-09f1-4767-945e-cf0957874fd3"}', '2026-02-26 10:20:29.170123+00', '2026-02-26 10:20:29.170123+00', '2026-02-26 10:20:29.170067+00'),
('e4c0b10b-9e0f-2a1b-c6e7-3e4f5a6b7c8d', '5a89ca95-5ed3-49c9-9543-239a35b4feea', '5a89ca95-5ed3-49c9-9543-239a35b4feea', 'email', '{"display_name":"999","email":"jackfords618@outlook.com","email_verified":false,"phone_verified":false,"sub":"5a89ca95-5ed3-49c9-9543-239a35b4feea"}', '2026-02-27 14:22:45.371123+00', '2026-02-27 14:22:45.371123+00', '2026-02-27 14:22:45.371067+00'),
('f5d1c21c-0f1a-3b2c-d7f8-4f5a6b7c8d9e', 'a3ad78f2-f58b-4bb4-a1ed-c80180c62f19', 'a3ad78f2-f58b-4bb4-a1ed-c80180c62f19', 'email', '{"display_name":"Контік Тестік","email":"facto@gmail.com","email_verified":false,"phone_verified":false,"sub":"a3ad78f2-f58b-4bb4-a1ed-c80180c62f19"}', '2026-02-27 14:47:23.949123+00', '2026-02-27 14:47:23.949123+00', '2026-02-27 14:47:23.949067+00'),
('a6e2d32d-1a2b-4c3d-e8a9-5a6b7c8d9e0f', '548ee676-8b13-454c-87f3-c01553c665ce', '548ee676-8b13-454c-87f3-c01553c665ce', 'email', '{"display_name":"Рома","email":"brabarukr@gmail.com","email_verified":false,"phone_verified":false,"sub":"548ee676-8b13-454c-87f3-c01553c665ce"}', '2026-03-02 12:18:23.673123+00', '2026-03-02 12:18:23.673123+00', '2026-03-02 12:18:23.673067+00'),
('b7f3e43e-2b3c-5d4e-f9b0-6b7c8d9e0f1a', '39def399-53ae-4573-8877-9f03060a0351', '39def399-53ae-4573-8877-9f03060a0351', 'email', '{"display_name":"Igris","email":"igrisrodos@gmail.com","email_verified":false,"phone_verified":false,"sub":"39def399-53ae-4573-8877-9f03060a0351"}', '2026-03-02 14:06:39.206123+00', '2026-03-02 14:06:39.206123+00', '2026-03-02 14:06:39.206067+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. Включить обратно триггер профилей
-- ============================================
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

-- ============================================
-- 4. Создать профили для импортированных юзеров
--    (триггер не сработал, создаём вручную)
-- ============================================
INSERT INTO public.profiles (user_id, display_name)
SELECT id, raw_user_meta_data->>'display_name'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT DO NOTHING;

-- ============================================
-- ДАЛЕЕ: Выполнить docs/team-data-export.sql
-- для импорта команд, участников, тарифов и ролей
-- ============================================
