# SOP: Multi-Tier Task & Goal Management System

## Goal
Establish standard operating guidelines for organizing, tracking, and cascading goals across 5 distinct time horizons:
1. **Daily Tasks**: Immediate actionable to-dos for today.
2. **Weekly Milestones**: Tactical weekly deliverables and recurring reviews.
3. **Monthly Goals**: Operational targets driving monthly focus.
4. **Quarterly Objectives (OKRs)**: Strategic 90-day key results and milestones.
5. **Annual Vision**: Broad yearly ambitions and high-level milestones.

---

## Horizon Specifications & Hierarchy

| Tier | Horizon | Key Purpose | Typical Count | Review Cadence |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Daily** | High-leverage execution items for the day | 3–8 tasks | Daily (Morning / Evening) |
| **2** | **Weekly** | Milestones & high-impact priorities | 3–6 milestones | Weekly (Sundays/Mondays) |
| **3** | **Monthly** | Concrete monthly projects & deliverables | 2–4 goals | End of Month |
| **4** | **Quarterly** | OKRs (Objectives & Key Results) | 2–3 Objectives | End of Quarter (Q1-Q4) |
| **5** | **Annual** | North-star vision, key milestones | 3–5 Pillars | Year-end / Mid-year review |

---

## Goal Schema Definition

Every task and goal entity adheres to the following JSON structure:

```json
{
  "id": "task_20260818_01",
  "title": "Complete Q3 product roadmap review",
  "description": "Align with engineering and design leads on priority deliverables.",
  "tier": "quarterly", // "daily" | "weekly" | "monthly" | "quarterly" | "annual"
  "completed": false,
  "completedAt": null,
  "createdAt": "2026-08-18T10:00:00.000Z",
  "dueDate": "2026-09-30",
  "priority": "high", // "low" | "medium" | "high" | "urgent"
  "category": "Product", // "Product" | "Engineering" | "Career" | "Health" | "Finance" | "Personal"
  "parentId": "task_annual_01", // Optional link to higher-tier goal
  "tags": ["roadmap", "strategy"]
}
```

---

## Operating Guidelines & Completion Rules

1. **Checkbox Interaction**:
   - Marking a task complete immediately timestamps `completedAt`.
   - If unchecking, `completedAt` is reset to `null`.
2. **Goal Cascading & Rollup**:
   - Higher-tier goals (Monthly, Quarterly, Annual) calculate progress percentage either from their direct completion status or dynamically based on linked sub-goals.
3. **Daily Carry-Over**:
   - Incomplete daily tasks prompt the user at day rollover for deferral, rescheduling, or carry-over.
4. **Celebration & Streaks**:
   - Completing 100% of daily tasks increments the daily streak counter.

---

## CLI & Execution Tools

- **Data Generator**: `python execution/generate_sample_data.py` generates standard sample goals across all 5 tiers into `.tmp/tasks.json` and `webapp/js/initial_data.js`.
- **Task CLI Manager**: `python execution/task_manager.py` supports:
  - `--list [all|daily|weekly|monthly|quarterly|annual]`
  - `--toggle <task_id>`
  - `--add --tier <tier> --title "<title>"`
  - `--summary` (outputs productivity metrics & completion % by tier)
