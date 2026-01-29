# План оптимізації відображення Google Maps

## ✅ ВИКОНАНО

### Зміни

1. **Оновлено iframe sandbox атрибути** - додано `allow-popups allow-popups-to-escape-sandbox`:
   - `SimplePreview.tsx`
   - `EditPreview.tsx` (4 місця)
   - `FilePreview.tsx`
   - `PhpPreviewDialog.tsx`
   - `GenerationHistory.tsx`

2. **Додано функцію `optimizeGoogleMaps`** в `inlineAssets.ts`:
   - Додає `loading="lazy"`, `allowfullscreen`, `title`, `referrerpolicy`
   - Забезпечує правильні атрибути для всіх Google Maps iframe

3. **Додано CSS стилі для map-container** в `injectBaseStyles`:
   - `.map-container`, `.map-wrapper`, `.google-map`
   - Fallback стилі для Google Maps iframe без контейнера

4. **Оновлено `processHtmlForPreview`** - додано виклик `optimizeGoogleMaps`

5. **Додано Google Maps інструкції до PHP генератора**:
   - Мандаторні вимоги для contact.php
   - Приклади робочих URL для різних країн
   - CSS стилі для map-container

6. **Edge function задеплоєно**
