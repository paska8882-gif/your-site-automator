

# Plan: Let teams work within credit limits without annoying notifications

## Problem
Teams have credit limits configured (e.g., KARMA has $500 limit, LLgenerator has $100) but are being bothered by:
1. **Amber "credit generation" warning** showing every time they generate when balance < cost (even though credit limit covers it)
2. **DebtNotificationPopup** appearing on page load when balance is negative (even if within credit limit)
3. Unnecessary friction for teams that are supposed to work on credit

## Changes

### 1. Remove the amber "generating on credit" warning (WebsiteGenerator.tsx)
- Remove or hide the `isGeneratingOnCredit` amber warning text near the generate button (lines ~3872-3877)
- Teams with credit limits should see no warning when working within their limit -- it's normal operation for them
- Only the red "credit limit exceeded" message should remain (when they truly can't generate)

### 2. Suppress DebtNotificationPopup for teams within credit limits (WebsiteGenerator.tsx)
- Change the popup trigger condition from `balance < -creditLimit` (only shows when exceeded) to **never show automatically** if the team has a credit limit > 0
- Only show the popup for teams with `credit_limit = 0` that somehow have negative balance (legacy edge case)
- For teams with credit limits, they know they're on credit -- no popup needed unless they exceed the limit

### 3. Remove amber warning from N8nGenerationPanel.tsx
- Same amber "insufficient balance" badge logic exists in the N8n panel
- Remove the visual noise for teams operating within credit limits

### Technical Details

**File: `src/components/WebsiteGenerator.tsx`**
- Line ~1229-1234: Change debt popup condition to only trigger when `creditLimit === 0 && balance < 0` (teams without credit that somehow went negative)
- Lines ~3872-3877: Remove the amber `isGeneratingOnCredit` warning entirely -- if they can generate, let them generate without warnings
- Keep the red `insufficientBalance` warning (lines ~3878-3883) as-is -- this correctly blocks when exceeding the limit

**File: `src/components/N8nGenerationPanel.tsx`**
- Remove or hide the amber `insufficientBalance` badge when the team is operating within credit limits

**No backend/edge function changes needed** -- the backend credit limit logic is already correct (blocks only when exceeding limit).
