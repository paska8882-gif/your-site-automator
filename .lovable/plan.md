

# Plan: Split Appeals into Auto/Manual + Filter + Bulk Actions

## Overview

Add the ability to distinguish auto-generated appeals from manually written ones, filter by this type, and perform bulk approve/reject operations on pending appeals.

## How Auto-Appeals Are Identified

Auto-appeals are created by the system (cleanup functions) and have specific reason patterns:
- Starts with "Автоповідомлення:"
- Equals "-"

Everything else is a manual (human-written) appeal.

## Changes

### 1. Add Type Filter (Auto / Manual / All)

Add a segmented filter above the appeals table with three options:
- **Всі** (All) -- default
- **Авто** (Auto) -- system-generated timeout appeals
- **Ручні** (Manual) -- human-written appeals

Detection logic:
```text
isAutoAppeal = reason starts with "Автоповідомлення:" OR reason === "-"
```

A badge/icon will visually distinguish auto vs manual in the table rows (e.g., a robot icon for auto, a pencil icon for manual).

### 2. Add Type Column to Table

Add a narrow "Тип" (Type) column showing:
- Robot icon + "Авто" badge for auto-appeals
- Pencil icon + "Ручна" badge for manual appeals

### 3. Add Bulk Selection and Actions

- Add checkboxes to each pending appeal row
- Add a "Select all visible pending" checkbox in the header
- Show a bulk action bar when items are selected with:
  - **Схвалити вибрані (N)** -- approve all selected pending appeals with refund
  - **Відхилити вибрані (N)** -- reject all selected pending appeals without refund
  - **Зняти вибір** -- clear selection
- Bulk operations process sequentially with a progress indicator
- Confirmation dialog before bulk actions showing count and total refund amount

### 4. Stats Update

Update the stats bar to also show auto/manual counts for the current filter context.

## Technical Details

### File: `src/components/AdminAppealsTab.tsx`

**New state variables:**
```typescript
const [typeFilter, setTypeFilter] = useState<"all" | "auto" | "manual">("all");
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [bulkProcessing, setBulkProcessing] = useState(false);
const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
```

**Helper function:**
```typescript
const isAutoAppeal = (reason: string) =>
  reason.startsWith("Автоповідомлення:") || reason === "-";
```

**Filtering logic update:**
```typescript
const filteredAppeals = appeals
  .filter(a => !selectedTeamId || a.team_id === selectedTeamId)
  .filter(a => {
    if (typeFilter === "auto") return isAutoAppeal(a.reason);
    if (typeFilter === "manual") return !isAutoAppeal(a.reason);
    return true;
  });
```

**Bulk resolve function:**
- Iterates over selected IDs
- For each: updates status, handles refund if approved, logs transaction
- Sends batch notification via edge function
- Refreshes data after completion

**Confirmation dialog:**
- Shows number of selected appeals
- Shows total refund amount (for approve action)
- Requires explicit confirmation

### No Database Changes Required

The auto/manual distinction is derived from the `reason` field content -- no schema migration needed.

## Files to Modify

1. `src/components/AdminAppealsTab.tsx` -- all UI and logic changes (type filter, bulk selection, bulk actions, type column)
