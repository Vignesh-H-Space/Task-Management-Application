import json
import os
from datetime import datetime, timezone

SAMPLE_GOALS = [
    # --- Annual Goals ---
    {
        "id": "ann_01",
        "title": "Master Full-Stack Agentic AI Engineering & Cloud Architecture",
        "description": "Build and deploy 10 production-grade AI agent systems with comprehensive evaluation suites.",
        "tier": "annual",
        "completed": False,
        "completedAt": None,
        "createdAt": "2026-01-01T00:00:00Z",
        "dueDate": "2026-12-31",
        "priority": "urgent",
        "category": "Career",
        "parentId": None,
        "tags": ["ai", "career", "mastery"]
    },
    {
        "id": "ann_02",
        "title": "Achieve Financial Fitness: $50k Investment Portfolio & Zero High-Interest Debt",
        "description": "Maintain 40% monthly savings rate and dollar-cost average into index funds & dividend portfolio.",
        "tier": "annual",
        "completed": False,
        "completedAt": None,
        "createdAt": "2026-01-01T00:00:00Z",
        "dueDate": "2026-12-31",
        "priority": "high",
        "category": "Finance",
        "parentId": None,
        "tags": ["finance", "wealth", "investing"]
    },
    {
        "id": "ann_03",
        "title": "Complete Half-Marathon (21.1 km) & Maintain Peak Physical Health",
        "description": "Log 1,000 km running total and strength train 3x weekly throughout the year.",
        "tier": "annual",
        "completed": False,
        "completedAt": None,
        "createdAt": "2026-01-01T00:00:00Z",
        "dueDate": "2026-11-30",
        "priority": "medium",
        "category": "Health",
        "parentId": None,
        "tags": ["fitness", "running", "longevity"]
    },

    # --- Quarterly Goals (Q3 2026) ---
    {
        "id": "qrt_01",
        "title": "Ship Multi-Agent Orchestration Engine & Benchmarks (Q3 Objective)",
        "description": "Build high-throughput async orchestrator with subagent communication and evaluation metrics.",
        "tier": "quarterly",
        "completed": False,
        "completedAt": None,
        "createdAt": "2026-07-01T00:00:00Z",
        "dueDate": "2026-09-30",
        "priority": "urgent",
        "category": "Engineering",
        "parentId": "ann_01",
        "tags": ["q3", "orchestrator", "ai"]
    },
    {
        "id": "qrt_02",
        "title": "Rebalance Asset Allocation & Automate Emergency Fund Sweep",
        "description": "Target 6-month buffer in high-yield account and review portfolio beta & dividend yields.",
        "tier": "quarterly",
        "completed": True,
        "completedAt": "2026-08-10T14:30:00Z",
        "createdAt": "2026-07-01T00:00:00Z",
        "dueDate": "2026-09-15",
        "priority": "medium",
        "category": "Finance",
        "parentId": "ann_02",
        "tags": ["q3", "investments", "emergency-fund"]
    },
    {
        "id": "qrt_03",
        "title": "Reach 15 km Continuous Long Run Milestone",
        "description": "Increase weekly mileage by 10% progressively and test hydration strategy.",
        "tier": "quarterly",
        "completed": False,
        "completedAt": None,
        "createdAt": "2026-07-01T00:00:00Z",
        "dueDate": "2026-09-20",
        "priority": "high",
        "category": "Health",
        "parentId": "ann_03",
        "tags": ["q3", "endurance", "running"]
    },

    # --- Monthly Goals (August 2026) ---
    {
        "id": "mon_01",
        "title": "Deploy Reactive Task Management Suite & Interactive Web App",
        "description": "Build 5-tier goal tracker with smooth check animations, dark mode, and local persistence.",
        "tier": "monthly",
        "completed": False,
        "completedAt": None,
        "createdAt": "2026-08-01T00:00:00Z",
        "dueDate": "2026-08-31",
        "priority": "urgent",
        "category": "Product",
        "parentId": "qrt_01",
        "tags": ["august", "task-system", "webapp"]
    },
    {
        "id": "mon_02",
        "title": "Contribute to 2 Open-Source AI Tooling Repositories",
        "description": "Submit PRs improving documentation, test coverage, or MCP plugin integrations.",
        "tier": "monthly",
        "completed": True,
        "completedAt": "2026-08-15T18:00:00Z",
        "createdAt": "2026-08-01T00:00:00Z",
        "dueDate": "2026-08-25",
        "priority": "medium",
        "category": "Career",
        "parentId": "ann_01",
        "tags": ["august", "open-source", "git"]
    },
    {
        "id": "mon_03",
        "title": "Complete 100 km Running Distance in August",
        "description": "Run 4 times per week; track pacing and heart rate zones in training log.",
        "tier": "monthly",
        "completed": False,
        "completedAt": None,
        "createdAt": "2026-08-01T00:00:00Z",
        "dueDate": "2026-08-31",
        "priority": "high",
        "category": "Health",
        "parentId": "qrt_03",
        "tags": ["august", "running", "mileage"]
    },

    # --- Weekly Milestones (Week 34) ---
    {
        "id": "wek_01",
        "title": "Design and finalize UI/UX architecture for Goal Cascade system",
        "description": "Draft wireframes, color palette, custom checkbox animations, and horizon switcher.",
        "tier": "weekly",
        "completed": True,
        "completedAt": "2026-08-17T11:20:00Z",
        "createdAt": "2026-08-17T08:00:00Z",
        "dueDate": "2026-08-19",
        "priority": "urgent",
        "category": "Product",
        "parentId": "mon_01",
        "tags": ["ui-ux", "frontend", "week34"]
    },
    {
        "id": "wek_02",
        "title": "Implement deterministic Python CLI for task management & stats export",
        "description": "Build CLI commands for listing, filtering, toggling status, and generating productivity JSON summaries.",
        "tier": "weekly",
        "completed": False,
        "completedAt": None,
        "createdAt": "2026-08-17T08:00:00Z",
        "dueDate": "2026-08-21",
        "priority": "high",
        "category": "Engineering",
        "parentId": "mon_01",
        "tags": ["cli", "python", "week34"]
    },
    {
        "id": "wek_03",
        "title": "Run 25 km total volume across 3 training sessions this week",
        "description": "Session 1: 7km easy, Session 2: 6km tempo intervals, Session 3: 12km long run.",
        "tier": "weekly",
        "completed": False,
        "completedAt": None,
        "createdAt": "2026-08-17T08:00:00Z",
        "dueDate": "2026-08-23",
        "priority": "medium",
        "category": "Health",
        "parentId": "mon_03",
        "tags": ["running", "training", "week34"]
    },
    {
        "id": "wek_04",
        "title": "Review weekly budget, subscription audits & expense allocations",
        "description": "Categorize transactions, cancel unused SaaS subscriptions, and record net savings.",
        "tier": "weekly",
        "completed": True,
        "completedAt": "2026-08-18T16:00:00Z",
        "createdAt": "2026-08-17T08:00:00Z",
        "dueDate": "2026-08-20",
        "priority": "low",
        "category": "Finance",
        "parentId": "qrt_02",
        "tags": ["finance", "budget", "week34"]
    },

    # --- Daily Tasks (Today) ---
    {
        "id": "day_01",
        "title": "Build interactive checkbox UI with micro-animations & confetti particle triggers",
        "description": "Ensure seamless check/uncheck experience with immediate visual feedback and ripple effect.",
        "tier": "daily",
        "completed": False,
        "completedAt": None,
        "createdAt": "2026-08-18T09:00:00Z",
        "dueDate": "2026-08-18",
        "priority": "urgent",
        "category": "Product",
        "parentId": "wek_01",
        "tags": ["checkbox", "animation", "ui"]
    },
    {
        "id": "day_02",
        "title": "Connect LocalStorage synchronization & instant filter horizon tabs",
        "description": "Support instant switching between All, Daily, Weekly, Monthly, Quarterly, and Annual views.",
        "tier": "daily",
        "completed": False,
        "completedAt": None,
        "createdAt": "2026-08-18T09:00:00Z",
        "dueDate": "2026-08-18",
        "priority": "high",
        "category": "Engineering",
        "parentId": "wek_01",
        "tags": ["state", "storage", "tabs"]
    },
    {
        "id": "day_03",
        "title": "Morning 7 km endurance run & stretching routine",
        "description": "Pace: 5:40 min/km. Hydration: 500ml electrolyte water.",
        "tier": "daily",
        "completed": True,
        "completedAt": "2026-08-18T07:15:00Z",
        "createdAt": "2026-08-18T06:00:00Z",
        "dueDate": "2026-08-18",
        "priority": "medium",
        "category": "Health",
        "parentId": "wek_03",
        "tags": ["run", "fitness", "routine"]
    },
    {
        "id": "day_04",
        "title": "Review pull requests and benchmark latency on vector search pipeline",
        "description": "Check top-k retrieval performance and memory footprint under 50 concurrency.",
        "tier": "daily",
        "completed": False,
        "completedAt": None,
        "createdAt": "2026-08-18T10:30:00Z",
        "dueDate": "2026-08-18",
        "priority": "medium",
        "category": "Engineering",
        "parentId": "mon_02",
        "tags": ["code-review", "performance"]
    },
    {
        "id": "day_05",
        "title": "Read 20 pages of Systems Thinking & Architecture Design",
        "description": "Take notes on feedback loops, decoupling heuristics, and state machine designs.",
        "tier": "daily",
        "completed": True,
        "completedAt": "2026-08-18T14:45:00Z",
        "createdAt": "2026-08-18T08:00:00Z",
        "dueDate": "2026-08-18",
        "priority": "low",
        "category": "Career",
        "parentId": "ann_01",
        "tags": ["reading", "knowledge", "habits"]
    }
]

def generate():
    # Write to .tmp/tasks.json
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tmp_dir = os.path.join(base_dir, ".tmp")
    os.makedirs(tmp_dir, exist_ok=True)
    
    json_path = os.path.join(tmp_dir, "tasks.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(SAMPLE_GOALS, f, indent=2)
    print(f"[OK] Generated {len(SAMPLE_GOALS)} tasks into {json_path}")
    
    # Write to webapp/js/initial_data.js
    webapp_js_dir = os.path.join(base_dir, "webapp", "js")
    os.makedirs(webapp_js_dir, exist_ok=True)
    
    js_path = os.path.join(webapp_js_dir, "initial_data.js")
    js_content = f"/**\n * Seed data for Multi-Tier Task & Goal Management\n */\nconst INITIAL_TASKS = {json.dumps(SAMPLE_GOALS, indent=2)};\n"
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"[OK] Generated initial data into {js_path}")

if __name__ == "__main__":
    generate()
