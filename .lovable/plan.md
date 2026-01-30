
# План: Виправлення превью React сайтів

## Виявлена проблема

`FilePreview.tsx` використовує застарілу логіку `buildReactPreviewHtml` яка:
1. Шукає `App.js` / `.jsx` файли - яких немає в CDN React
2. Видобуває код компонентів з окремих JS файлів - яких немає
3. Намагається запустити `window.App` - який не існує
4. Виводить "App component not found" замість контенту

CDN-based React сайти мають:
- `index.html` з інлайн `<script type="text/babel">` блоками
- Все працює одразу без трансформацій
- Ніяких окремих `.js`/`.jsx` файлів

## Технічне рішення

### Файл 1: `src/components/FilePreview.tsx`

Переписати функцію `buildReactPreviewHtml` з повною підтримкою CDN-based React:

```typescript
function buildReactPreviewHtml(files: GeneratedFile[]): string {
  // Check for CDN-based React - standalone HTML with inline React
  const htmlFile = files.find(f => f.path === "index.html") ||
                   files.find(f => f.path.endsWith(".html"));
  
  if (!htmlFile) {
    return buildLegacyReactPreview(files);
  }
  
  // Check if this is CDN React (has unpkg.com/react or text/babel)
  const isCdnReact = htmlFile.content.includes('unpkg.com/react') || 
                     htmlFile.content.includes('text/babel');
  
  if (isCdnReact) {
    // CDN React: return HTML as-is with CSS injected
    let html = htmlFile.content;
    
    // Inject styles.css if exists and not already in HTML
    const cssFile = files.find(f => f.path === "styles.css");
    if (cssFile && !html.includes('<link rel="stylesheet" href="styles.css"')) {
      // Inline the CSS
      const styleTag = `<style>${cssFile.content}</style>`;
      html = html.replace('</head>', `${styleTag}</head>`);
    }
    
    return html;
  }
  
  // Legacy CRA-style React
  return buildLegacyReactPreview(files);
}

// Move current logic to buildLegacyReactPreview (for backwards compatibility)
function buildLegacyReactPreview(files: GeneratedFile[]): string {
  // ... existing code that handles App.js etc
}
```

Також в `getPreviewContent()`:
- Для CDN React сайтів: просто повертати HTML файл з інлайновим CSS
- Не намагатися "збирати" React компоненти

## Очікуваний результат

1. CDN-based React сайти відображаються коректно в превью
2. Backward compatibility з CRA-style React проєктами
3. Коректна робота CSS стилів
4. Усунення помилки "App component not found"

## Файли для редагування

| Файл | Зміна |
|------|-------|
| `src/components/FilePreview.tsx` | Переписати `buildReactPreviewHtml` + оновити `getPreviewContent` |

## Обсяг роботи

~30 хвилин на переписання логіки та тестування
