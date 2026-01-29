
# План оптимізації відображення Google Maps

## Аналіз проблеми

Карти Google не відображаються належним чином через кілька причин:

1. **Обмеження iframe sandbox** - поточні атрибути `sandbox="allow-scripts allow-same-origin"` блокують вкладені iframe Google Maps
2. **Відсутні спеціальні інструкції для PHP генератора** - генератор каже "map placeholder" замість конкретного формату Google Maps
3. **Немає постпроцесингу карт** - функція `processHtmlForPreview` не обробляє та не оптимізує Google Maps iframe

---

## Зміни

### 1. Оновлення iframe sandbox атрибутів

**Файли:**
- `src/components/SimplePreview.tsx`
- `src/components/EditPreview.tsx`
- `src/components/FilePreview.tsx`
- `src/components/PhpPreviewDialog.tsx`
- `src/components/GenerationHistory.tsx`

**Зміни:**
Додати `allow-popups allow-popups-to-escape-sandbox` до атрибуту sandbox:
```
sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
```

---

### 2. Додати оптимізацію Google Maps в inlineAssets.ts

**Файл:** `src/lib/inlineAssets.ts`

**Нова функція `optimizeGoogleMaps`:**
- Знаходить всі iframe з Google Maps
- Нормалізує URL формат (заміна `maps.google.com/maps?q=...` якщо потрібно)
- Додає відсутні атрибути (`loading="lazy"`, `allowfullscreen`, `title`)
- Огортає карту в `.map-container` div якщо відсутній
- Інжектує CSS стилі для map-container

**Приклад логіки:**
```typescript
function optimizeGoogleMaps(html: string): string {
  // 1. Знайти всі iframe з google maps
  // 2. Додати відсутні атрибути
  // 3. Огорнути в map-container якщо немає
  // 4. Інжектувати CSS для .map-container
}
```

---

### 3. Додати Google Maps інструкції до PHP генератора

**Файл:** `supabase/functions/generate-php-website/index.ts`

**Локація:** У AI промпт (секція про contact.php)

**Додати інструкції аналогічні HTML генератору:**

```text
GOOGLE MAPS - MANDATORY REQUIREMENTS FOR CONTACT PAGE:
Every contact page MUST include a WORKING, PROPERLY DISPLAYED Google Map.

GOOGLE MAPS IN PHP - USE THIS SIMPLE FORMAT (works 100%):
<div class="map-container">
  <iframe 
    src="https://maps.google.com/maps?q=Berlin+Germany&t=&z=13&ie=UTF8&iwloc=&output=embed"
    width="100%" 
    height="450" 
    style="border:0;" 
    allowfullscreen="" 
    loading="lazy" 
    title="Our Location">
  </iframe>
</div>

MAP URL FORMAT - USE q= PARAMETER (ALWAYS WORKS):
https://maps.google.com/maps?q=CITY+COUNTRY&t=&z=13&ie=UTF8&iwloc=&output=embed

Match the city from the website GEO!
```

---

### 4. Додати CSS для map-container в injectBaseStyles

**Файл:** `src/lib/inlineAssets.ts`

**Додати в функцію `injectBaseStyles`:**
```css
/* Google Maps container */
.map-container {
  width: 100%;
  min-height: 350px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin: 20px 0;
}
.map-container iframe {
  width: 100%;
  height: 100%;
  min-height: 350px;
  border: none;
  display: block;
}
```

---

## Технічні деталі

### Порядок виконання

1. Оновити sandbox атрибути у всіх preview компонентах (5 файлів)
2. Додати функцію `optimizeGoogleMaps` в `inlineAssets.ts`
3. Додати CSS стилі для map-container в `injectBaseStyles`
4. Оновити `processHtmlForPreview` для виклику `optimizeGoogleMaps`
5. Додати Google Maps інструкції до PHP генератора
6. Задеплоїти оновлену edge function

### Очікуваний результат

- Google Maps iframe коректно відображається у preview
- Карти мають стильний контейнер з тінню та округленими кутами
- AI генерує правильні URL карт для обраної географії
- Карти працюють на мобільних пристроях (responsive)
