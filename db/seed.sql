-- ============================================================
-- CI-Tech — seed projects (trilingual ZH / IT / EN)
-- Run AFTER db/schema.sql, in the Supabase SQL editor.
--
-- Run ONCE: ids are random UUIDs, so re-running adds duplicates.
-- To reseed from scratch, uncomment the next line first:
-- delete from ct_projects;
--
-- logo_url is intentionally left NULL — upload logos from the admin
-- panel as the first end-to-end test. sort_order is ascending, so
-- lower numbers show first (most recent projects on top).
--
-- NOTE: several external_url values are '#' placeholders because the
-- live URL wasn't provided. Search this file for '#' and replace with
-- the real link (or edit later from the admin panel).
-- ============================================================

insert into ct_projects
  (name_zh, name_it, name_en,
   tagline_zh, tagline_it, tagline_en,
   description_zh, description_it, description_en,
   category, external_url, tech_stack, sort_order, is_published)
values
-- 1. CLF Platform / 大卫学中文 -------------------------------------------------
('大卫学中文 · CLF 平台', 'CLF Platform', 'CLF Platform',
 '面向意大利学习者的中文学习 PWA', 'PWA per imparare il cinese', 'A Chinese-learning PWA',
 'CLF 平台是一款面向意大利学习者的中文学习渐进式网页应用，提供分级课程、汉字书写与发音练习。',
 'CLF Platform è una progressive web app per imparare il cinese, con lezioni graduate, scrittura dei caratteri ed esercizi di pronuncia.',
 'CLF Platform is a progressive web app for learning Chinese, with graded lessons, character writing, and pronunciation practice.',
 'education', 'https://zhongwen-world.netlify.app',
 ARRAY['React','Vite','Supabase','i18next','PWA'], 10, true),

-- 2. Miaohong / Wenzi-learn ---------------------------------------------------
('描红 · 文字学习', 'Miaohong', 'Miaohong',
 '甲骨文与拼音启蒙 PWA', 'PWA per pittogrammi e pinyin', 'Oracle-bone & pinyin learning PWA',
 '描红是一款汉字启蒙应用，从甲骨文到现代汉字，结合描红书写与拼音学习。',
 'Miaohong è un''app per avvicinarsi ai caratteri cinesi: dalle ossa oracolari ai caratteri moderni, con tracciamento della scrittura e pinyin.',
 'Miaohong introduces Chinese characters from oracle-bone script to modern forms, pairing guided stroke tracing with pinyin learning.',
 'education', 'https://miaohong.netlify.app',
 ARRAY['React','Vite','Supabase','PWA'], 20, true),

-- 3. AMI168 -------------------------------------------------------------------
('AMI168 医疗预约', 'AMI168', 'AMI168',
 '中意双语医疗预约平台', 'Prenotazioni mediche bilingue', 'Bilingual medical booking',
 'AMI168 是一个中意双语的医疗预约平台，帮助用户查找医生、预约就诊并管理记录。',
 'AMI168 è una piattaforma di prenotazioni mediche bilingue (cinese/italiano) per trovare medici, prenotare visite e gestire i propri dati.',
 'AMI168 is a bilingual (Chinese/Italian) medical booking platform to find doctors, book appointments, and manage records.',
 'tools', 'https://ami168.online',
 ARRAY['React','Vite','Supabase'], 30, true),

-- 4. JCX Events ---------------------------------------------------------------
('JCX 活动系统', 'JCX Events', 'JCX Events',
 '中意社区活动管理系统', 'Gestione eventi della comunità', 'Chinese-Italian community events',
 'JCX Events 是一个面向中意社区的活动管理系统，支持活动发布、报名与签到。',
 'JCX Events è un sistema di gestione eventi per la comunità cinese-italiana: pubblicazione, iscrizioni e check-in.',
 'JCX Events is an event-management system for the Chinese-Italian community, supporting listings, sign-ups, and check-in.',
 'community', '#',
 ARRAY['React','Vite','Supabase'], 40, true),

-- 5. Florence Lantern Festival 2026 ------------------------------------------
('佛罗伦萨花灯节 2026', 'Festival delle Lanterne di Firenze 2026', 'Florence Lantern Festival 2026',
 '2026 佛罗伦萨花灯节官网', 'Sito ufficiale del festival', 'Official festival site',
 '2026 年佛罗伦萨花灯节的官方网站，介绍活动安排、地点与购票信息。',
 'Sito ufficiale del Festival delle Lanterne di Firenze 2026, con programma, sedi e biglietti.',
 'The official site for the 2026 Florence Lantern Festival — programme, venues, and tickets.',
 'cultural', 'https://florence-lantern2026.com',
 ARRAY['React','Vite'], 50, true),

-- 6. ZANG Training Studio -----------------------------------------------------
('ZANG 训练工作室', 'ZANG Training Studio', 'ZANG Training Studio',
 '少数民族视觉艺术 LoRA 训练', 'Training LoRA per arte etnica', 'LoRA training for ethnic art',
 'ZANG 训练工作室专注于少数民族视觉艺术的 LoRA 模型训练与数据集管理。',
 'ZANG Training Studio è dedicato al training di modelli LoRA per l''arte visiva delle minoranze etniche e alla gestione dei dataset.',
 'ZANG Training Studio focuses on LoRA model training for ethnic-minority visual art, with dataset management.',
 'tools', '#',
 ARRAY['Python','LoRA','Diffusion'], 60, true),

-- 7. AtelierOS ----------------------------------------------------------------
('AtelierOS', 'AtelierOS', 'AtelierOS',
 '中国风高定时装设计流水线', 'Pipeline per alta moda', 'Luxury fashion design pipeline',
 'AtelierOS 是一条面向中国风高级定制时装的设计流水线，覆盖灵感、打版到成衣的全流程。',
 'AtelierOS è una pipeline di design per l''alta moda di ispirazione cinese, dall''idea al cartamodello fino al capo finito.',
 'AtelierOS is a design pipeline for Chinese-inspired luxury fashion, covering inspiration, patternmaking, and finished garments.',
 'tools', '#',
 ARRAY['React','AI','Design'], 70, true),

-- 8. 沪深智投 -----------------------------------------------------------------
('沪深智投', 'HuShen Smart Invest', 'HuShen Smart Invest',
 'A 股投资智能平台', 'Intelligence per il mercato A-share', 'A-share investment intelligence',
 '沪深智投是一个面向 A 股市场的投资智能平台，提供行情分析与策略洞察。',
 'HuShen Smart Invest è una piattaforma di intelligence per investimenti sul mercato azionario cinese (A-share), con analisi e strategie.',
 'HuShen Smart Invest is an investment-intelligence platform for the Chinese A-share market, with analytics and strategy insights.',
 'tools', '#',
 ARRAY['React','Python','Data'], 80, true),

-- 9. SASA exhibition guide ----------------------------------------------------
('SASA 展览导览', 'Guida alla mostra SASA', 'SASA Exhibition Guide',
 '藏族文化纹样展览导览', 'Motivi culturali tibetani', 'Tibetan cultural patterns',
 'SASA 展览导览是一款聚焦藏族文化纹样的展览导览应用。',
 'La guida alla mostra SASA è un''app dedicata ai motivi della cultura tibetana.',
 'The SASA Exhibition Guide is a companion app exploring Tibetan cultural patterns.',
 'cultural', '#',
 ARRAY['React','Vite','PWA'], 90, true),

-- 10. Travel in Italia (sibling) ---------------------------------------------
('意大利艺术之旅', 'Travel in Italia', 'Travel in Italia',
 '意大利艺术、音乐与科学的三语指南', 'Arte, musica e scienza italiane', 'Italian art, music & science',
 '一份三语指南，介绍意大利的博物馆、艺术作品，以及艺术家、音乐家与科学家，并附带艺术地图。',
 'Una guida trilingue ai musei e alle opere d''arte italiane, agli artisti, musicisti e scienziati, con una mappa dell''arte.',
 'A trilingual guide to Italian museums and artworks — and the artists, musicians and scientists behind them — with an Art Map.',
 'cultural', '#',
 ARRAY['React','Vite','Supabase','Leaflet','PWA'], 100, true),

-- 11. ST-Progress (sibling) ---------------------------------------------------
('人类进步里程碑', 'Milestones of Human Progress', 'Milestones of Human Progress',
 '伟大发现与发明的三语指南', 'Scoperte e invenzioni', 'Discoveries & inventions',
 '一份三语指南，按时代、领域或世界地图探索伟大的发现、发明及其背后的人物。',
 'Una guida trilingue alle grandi scoperte e invenzioni e alle persone che le hanno realizzate — per epoca, campo o sulla mappa.',
 'A trilingual guide to the great discoveries and inventions — and the people behind them — explored by era, field, or world map.',
 'education', '#',
 ARRAY['React','Vite','Supabase','PWA'], 110, true),

-- 12. Feiyi (sibling) ---------------------------------------------------------
('非遗 · Feiyi', '非遗 · Feiyi', '非遗 · Feiyi',
 '中国非物质文化遗产三语指南', 'Patrimonio immateriale cinese', 'China''s intangible heritage',
 '一份三语指南，介绍中国的非物质文化遗产——传统工艺、戏曲、音乐、舞蹈、节庆，以及守护它们的传承人，并附带非遗地图。',
 'Una guida trilingue al patrimonio culturale immateriale cinese — artigianato, opera, musica, danza, feste e i custodi che lo mantengono vivo, con una mappa.',
 'A trilingual guide to China''s intangible cultural heritage — crafts, opera, music, dance, festivals, and the inheritors who keep them alive, with a heritage map.',
 'cultural', '#',
 ARRAY['React','Vite','Supabase','Leaflet','PWA'], 120, true),

-- 13. Design World (sibling) --------------------------------------------------
('设计世界', 'Design World', 'Design World',
 '世界设计运动与设计师三语指南', 'Movimenti e designer', 'Movements & designers',
 '一份三语指南，带你走进设计的世界——伟大的设计运动、标志性的物件，以及背后的设计师，并附带世界设计之都地图。',
 'Una guida trilingue nel mondo del design — i grandi movimenti, gli oggetti iconici e i designer, con la mappa delle capitali del design.',
 'A trilingual journey through the world of design — the great movements, iconic objects, and the designers behind them, with a map of design capitals.',
 'cultural', '#',
 ARRAY['React','Vite','Supabase','Leaflet','PWA'], 130, true);
