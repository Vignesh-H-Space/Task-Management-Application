import argparse
import json
import os
import sys
from datetime import datetime, timezone

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


TIERS = ["daily", "weekly", "monthly", "quarterly", "annual"]
TIER_EMOJIS = {
    "daily": "🌅",
    "weekly": "📅",
    "monthly": "🗓️",
    "quarterly": "🎯",
    "annual": "🏆"
}

def get_base_paths():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tmp_dir = os.path.join(base_dir, ".tmp")
    os.makedirs(tmp_dir, exist_ok=True)
    tasks_file = os.path.join(tmp_dir, "tasks.json")
    return base_dir, tmp_dir, tasks_file

def load_tasks(tasks_file):
    if not os.path.exists(tasks_file):
        # Generate initial sample data if not present
        from generate_sample_data import generate
        generate()
    with open(tasks_file, "r", encoding="utf-8") as f:
        return json.load(f)

def save_tasks(tasks_file, tasks):
    with open(tasks_file, "w", encoding="utf-8") as f:
        json.dump(tasks, f, indent=2)

def list_tasks(tasks, tier_filter=None, show_all=False):
    filtered = tasks
    if tier_filter and tier_filter.lower() != "all":
        filtered = [t for t in tasks if t.get("tier", "").lower() == tier_filter.lower()]
    
    print("\n" + "=" * 70)
    print(f"  TASK & GOAL MANAGEMENT SYSTEM - [{tier_filter.upper() if tier_filter else 'ALL'}]")
    print("=" * 70)
    
    if not filtered:
        print("  No tasks found for this selection.")
        return

    # Group by tier if showing all
    current_tier = None
    for t in filtered:
        tier = t.get("tier", "daily")
        if tier != current_tier and not tier_filter:
            current_tier = tier
            emoji = TIER_EMOJIS.get(tier, "📌")
            print(f"\n--- {emoji} {tier.upper()} GOALS ---")
        
        status_box = "[x]" if t.get("completed") else "[ ]"
        priority = f"[{t.get('priority', 'medium').upper()}]"
        due = f"Due: {t.get('dueDate', 'N/A')}"
        category = f"#{t.get('category', 'General')}"
        
        print(f"  {status_box} ({t.get('id')}) {priority:<8} {t.get('title')}")
        print(f"      {due} | {category} | Tags: {', '.join(t.get('tags', []))}")
        if t.get("description"):
            print(f"      Desc: {t.get('description')}")
        print()

def toggle_task(tasks_file, task_id):
    tasks = load_tasks(tasks_file)
    found = False
    for t in tasks:
        if t.get("id") == task_id:
            found = True
            t["completed"] = not t.get("completed", False)
            if t["completed"]:
                t["completedAt"] = datetime.now(timezone.utc).isoformat()
                print(f"[OK] Marked task {task_id} as COMPLETED [x]!")
            else:
                t["completedAt"] = None
                print(f"[OK] Marked task {task_id} as INCOMPLETE [ ]!")
            break
    
    if not found:
        print(f"[ERROR] Task with ID '{task_id}' not found.")
        return False
    
    save_tasks(tasks_file, tasks)
    return True

def add_task(tasks_file, title, tier, priority="medium", category="General", due_date=None, desc="", parent_id=None):
    if tier.lower() not in TIERS:
        print(f"[ERROR] Invalid tier '{tier}'. Must be one of: {', '.join(TIERS)}")
        return False
    
    tasks = load_tasks(tasks_file)
    prefix = tier[:3]
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    new_id = f"{prefix}_{timestamp}"
    
    new_task = {
        "id": new_id,
        "title": title,
        "description": desc,
        "tier": tier.lower(),
        "completed": False,
        "completedAt": None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "dueDate": due_date or datetime.now().strftime("%Y-%m-%d"),
        "priority": priority.lower(),
        "category": category,
        "parentId": parent_id,
        "tags": [tier.lower(), category.lower()]
    }
    
    tasks.append(new_task)
    save_tasks(tasks_file, tasks)
    print(f"[OK] Created new {tier.upper()} task [{new_id}]: '{title}'")
    return new_id

def compute_summary(tasks):
    stats = {}
    total_count = len(tasks)
    total_completed = sum(1 for t in tasks if t.get("completed"))
    overall_pct = (total_completed / total_count * 100) if total_count > 0 else 0
    
    print("\n" + "=" * 60)
    print(f"  PRODUCTIVITY & GOAL PROGRESS SUMMARY")
    print("=" * 60)
    print(f"  Overall Completion: {total_completed}/{total_count} ({overall_pct:.1f}%)\n")
    
    for tier in TIERS:
        tier_tasks = [t for t in tasks if t.get("tier", "").lower() == tier]
        count = len(tier_tasks)
        completed = sum(1 for t in tier_tasks if t.get("completed"))
        pct = (completed / count * 100) if count > 0 else 0
        emoji = TIER_EMOJIS.get(tier, "📌")
        bar_len = 20
        filled = int(bar_len * (pct / 100))
        bar = "█" * filled + "░" * (bar_len - filled)
        
        print(f"  {emoji} {tier.capitalize():<12} [{bar}] {pct:>5.1f}% ({completed}/{count})")
        stats[tier] = {
            "total": count,
            "completed": completed,
            "percentage": round(pct, 1)
        }
    
    stats["overall"] = {
        "total": total_count,
        "completed": total_completed,
        "percentage": round(overall_pct, 1)
    }
    print("=" * 60 + "\n")
    return stats

def main():
    parser = argparse.ArgumentParser(description="Multi-tier Task and Goal Management CLI")
    parser.add_argument("--list", nargs="?", const="all", help="List tasks by tier (all, daily, weekly, monthly, quarterly, annual)")
    parser.add_argument("--toggle", help="Toggle completion state of a task by ID")
    parser.add_argument("--add", action="store_true", help="Add a new task")
    parser.add_argument("--title", help="Task title")
    parser.add_argument("--tier", default="daily", choices=TIERS, help="Goal tier horizon")
    parser.add_argument("--priority", default="medium", choices=["low", "medium", "high", "urgent"])
    parser.add_argument("--category", default="General", help="Task category")
    parser.add_argument("--due", help="Due date (YYYY-MM-DD)")
    parser.add_argument("--desc", default="", help="Description")
    parser.add_argument("--parent", default=None, help="Parent task ID")
    parser.add_argument("--summary", action="store_true", help="Display productivity and completion summary")
    
    args = parser.parse_args()
    base_dir, tmp_dir, tasks_file = get_base_paths()
    
    if args.summary:
        tasks = load_tasks(tasks_file)
        stats = compute_summary(tasks)
        summary_out = os.path.join(tmp_dir, "productivity_report.json")
        with open(summary_out, "w", encoding="utf-8") as f:
            json.dump(stats, f, indent=2)
    elif args.toggle:
        toggle_task(tasks_file, args.toggle)
    elif args.add:
        if not args.title:
            print("[ERROR] --title is required when adding a task.")
            sys.exit(1)
        add_task(tasks_file, args.title, args.tier, args.priority, args.category, args.due, args.desc, args.parent)
    else:
        tier_filter = args.list or "all"
        tasks = load_tasks(tasks_file)
        list_tasks(tasks, tier_filter)

if __name__ == "__main__":
    main()
