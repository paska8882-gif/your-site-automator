
CREATE TABLE public.pricing_config (
  id text NOT NULL DEFAULT 'global' PRIMARY KEY,
  tiers jsonb NOT NULL DEFAULT '[]',
  volume_discounts jsonb NOT NULL DEFAULT '[]',
  footer_note text DEFAULT '* Ціна на ручну видачу також може змінюватись залежно від складності ТЗ. Обговорюється індивідуально.',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pricing config" ON public.pricing_config FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.pricing_config (id, tiers, volume_discounts) VALUES (
  'global',
  '[
    {"id":"basic","name":"Basic Landing","price":"$5","description":"Простий односторінковий сайт — ідеальний для швидкого старту. Автогенерація за лічені хвилини.","features":["Односторінковий лендінг","Адаптивний дизайн","Базова SEO-оптимізація","Швидка доставка — до 5 хвилин"]},
    {"id":"html","name":"HTML Multi-page","price":"$7","description":"Багатосторінковий HTML-сайт з кількома розділами, сторінками та контентом.","features":["Кілька сторінок (About, Services, Contact…)","Унікальний контент під тематику","Адаптивна верстка","AI-генеровані тексти та структура"]},
    {"id":"react","name":"React / Next.js","price":"$9","description":"Сучасний сайт на React — швидший, інтерактивніший та технологічніший.","features":["Сучасний фреймворк React / Next.js","Покращена швидкість завантаження","Компонентна архітектура","Розширені анімації та інтерактив"]},
    {"id":"bilingual","name":"Bilingual HTML","price":"$10","description":"Двомовний HTML-сайт — контент автоматично генерується на двох мовах з перемикачем.","features":["Дві мовні версії сайту","Перемикач мов у хедері","Контент перекладений під кожну мову","Коректні мета-теги для кожної мови"]},
    {"id":"manual","name":"Manual Premium","price":"від $20","description":"Ручна видача з модерацією живої людини. AI-генерація + професійне доведення: точні фото, будь-які вимоги, кастомні промпти.","features":["AI-генерація + ручна модерація","Фото що точно відповідають тематиці","Будь-які вимоги клієнта (промпти, структура)","Можливість розмістити фото клієнта","Індивідуальний підхід до кожного сайту"]}
  ]'::jsonb,
  '[
    {"min_sites":10,"price":"$18"},
    {"min_sites":25,"price":"$16"},
    {"min_sites":50,"price":"$14"}
  ]'::jsonb
);
