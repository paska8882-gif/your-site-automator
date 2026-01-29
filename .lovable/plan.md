

## План виправлення бага з підрахунком генерацій команди

### Суть проблеми
В `AdminTeamDetails.tsx` функція `fetchGenerations()` шукає генерації **по user_id членів команди**, а не **по team_id генерації**. Це призводить до того, що генерації членів з інших команд (наприклад, Black з KARMA) показуються в статистиці Zavod Lidov.

**Результат:** UI показує 72 генерації замість правильних 49.

### Технічне рішення

**Файл:** `src/pages/AdminTeamDetails.tsx`

Змінити функцію `fetchGenerations()` (рядки 288-320):

**Було (неправильно):**
```typescript
const fetchGenerations = async () => {
  const { data: membersData } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("status", "approved");

  const userIds = membersData.map(m => m.user_id);

  const { data: genData } = await supabase
    .from("generation_history")
    .select("*")
    .in("user_id", userIds)  // ❌ Фільтр по user_id
    .order("created_at", { ascending: false })
    .limit(100);
};
```

**Буде (правильно):**
```typescript
const fetchGenerations = async () => {
  // Отримуємо генерації по team_id
  const { data: genData } = await supabase
    .from("generation_history")
    .select("*")
    .eq("team_id", teamId)  // ✅ Фільтр по team_id
    .order("created_at", { ascending: false })
    .limit(100);

  // Отримуємо імена користувачів
  if (genData && genData.length > 0) {
    const userIds = [...new Set(genData.map(g => g.user_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

    setGenerations(genData.map(g => ({
      ...g,
      user_name: profileMap.get(g.user_id || "") || "Невідомий"
    })));
  } else {
    setGenerations([]);
  }
};
```

### Очікуваний результат
- Zavod Lidov буде показувати правильні **49 генерацій** замість 72
- Генерації Black з KARMA (23 шт) більше не будуть включатись
- Фінансова статистика буде коректною

