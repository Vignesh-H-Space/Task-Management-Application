/**
 * Seed data for Multi-Tier Task & Goal Management
 */
const INITIAL_TASKS = [
  {
    "id": "ann_01",
    "title": "Master Full-Stack Agentic AI Engineering & Cloud Architecture",
    "description": "Build and deploy 10 production-grade AI agent systems with comprehensive evaluation suites.",
    "tier": "annual",
    "completed": false,
    "completedAt": null,
    "createdAt": "2026-01-01T00:00:00Z",
    "dueDate": "2026-12-31",
    "priority": "urgent",
    "category": "Career",
    "parentId": null,
    "tags": [
      "ai",
      "career",
      "mastery"
    ],
    "subtasks": [
      { "id": "st_ann1_1", "title": "Build async subagent orchestrator", "completed": true },
      { "id": "st_ann1_2", "title": "Deploy evaluation benchmark suite", "completed": false },
      { "id": "st_ann1_3", "title": "Publish open-source MCP tools", "completed": false }
    ]
  },
  {
    "id": "ann_02",
    "title": "Achieve Financial Fitness: $50k Investment Portfolio & Zero High-Interest Debt",
    "description": "Maintain 40% monthly savings rate and dollar-cost average into index funds & dividend portfolio.",
    "tier": "annual",
    "completed": false,
    "completedAt": null,
    "createdAt": "2026-01-01T00:00:00Z",
    "dueDate": "2026-12-31",
    "priority": "high",
    "category": "Finance",
    "parentId": null,
    "tags": [
      "finance",
      "wealth",
      "investing"
    ],
    "subtasks": [
      { "id": "st_ann2_1", "title": "Automate monthly index fund DCA transfer", "completed": true },
      { "id": "st_ann2_2", "title": "Complete debt paydown milestone", "completed": true },
      { "id": "st_ann2_3", "title": "Rebalance portfolio for year-end dividends", "completed": false }
    ]
  },
  {
    "id": "ann_03",
    "title": "Complete Half-Marathon (21.1 km) & Maintain Peak Physical Health",
    "description": "Log 1,000 km running total and strength train 3x weekly throughout the year.",
    "tier": "annual",
    "completed": false,
    "completedAt": null,
    "createdAt": "2026-01-01T00:00:00Z",
    "dueDate": "2026-11-30",
    "priority": "medium",
    "category": "Health",
    "parentId": null,
    "tags": [
      "fitness",
      "running",
      "longevity"
    ],
    "subtasks": [
      { "id": "st_ann3_1", "title": "Base mileage buildup (500 km logged)", "completed": true },
      { "id": "st_ann3_2", "title": "Lactate threshold & tempo intervals", "completed": false },
      { "id": "st_ann3_3", "title": "Complete official race registration", "completed": true }
    ]
  },
  {
    "id": "qrt_01",
    "title": "Ship Multi-Agent Orchestration Engine & Benchmarks (Q3 Objective)",
    "description": "Build high-throughput async orchestrator with subagent communication and evaluation metrics.",
    "tier": "quarterly",
    "completed": false,
    "completedAt": null,
    "createdAt": "2026-07-01T00:00:00Z",
    "dueDate": "2026-09-30",
    "priority": "urgent",
    "category": "Engineering",
    "parentId": "ann_01",
    "tags": [
      "q3",
      "orchestrator",
      "ai"
    ],
    "subtasks": [
      { "id": "st_qrt1_1", "title": "Architecture specs & state graph design", "completed": true },
      { "id": "st_qrt1_2", "title": "Implement Web Audio engine & Focus Mode", "completed": true },
      { "id": "st_qrt1_3", "title": "Sub-task checklist breakdown system", "completed": false },
      { "id": "st_qrt1_4", "title": "Production stress & latency testing", "completed": false }
    ]
  },
  {
    "id": "qrt_02",
    "title": "Rebalance Asset Allocation & Automate Emergency Fund Sweep",
    "description": "Target 6-month buffer in high-yield account and review portfolio beta & dividend yields.",
    "tier": "quarterly",
    "completed": true,
    "completedAt": "2026-08-10T14:30:00Z",
    "createdAt": "2026-07-01T00:00:00Z",
    "dueDate": "2026-09-15",
    "priority": "medium",
    "category": "Finance",
    "parentId": "ann_02",
    "tags": [
      "q3",
      "investments",
      "emergency-fund"
    ],
    "subtasks": [
      { "id": "st_qrt2_1", "title": "Audit trailing 6-month SaaS expenses", "completed": true },
      { "id": "st_qrt2_2", "title": "Transfer buffer into high-yield account", "completed": true }
    ]
  },
  {
    "id": "qrt_03",
    "title": "Reach 15 km Continuous Long Run Milestone",
    "description": "Increase weekly mileage by 10% progressively and test hydration strategy.",
    "tier": "quarterly",
    "completed": false,
    "completedAt": null,
    "createdAt": "2026-07-01T00:00:00Z",
    "dueDate": "2026-09-20",
    "priority": "high",
    "category": "Health",
    "parentId": "ann_03",
    "tags": [
      "q3",
      "endurance",
      "running"
    ],
    "subtasks": [
      { "id": "st_qrt3_1", "title": "Hit 10 km continuous tempo run", "completed": true },
      { "id": "st_qrt3_2", "title": "Test electrolyte fuel strategy on 12km run", "completed": true },
      { "id": "st_qrt3_3", "title": "Execute 15 km continuous weekend run", "completed": false }
    ]
  },
  {
    "id": "mon_01",
    "title": "Deploy Reactive Task Management Suite & Interactive Web App",
    "description": "Build 5-tier goal tracker with smooth check animations, dark mode, and local persistence.",
    "tier": "monthly",
    "completed": false,
    "completedAt": null,
    "createdAt": "2026-08-01T00:00:00Z",
    "dueDate": "2026-08-31",
    "priority": "urgent",
    "category": "Product",
    "parentId": "qrt_01",
    "tags": [
      "august",
      "task-system",
      "webapp"
    ],
    "subtasks": [
      { "id": "st_mon1_1", "title": "Create MPA layout and shared navigation shell", "completed": true },
      { "id": "st_mon1_2", "title": "Build streak engine & milestone badges", "completed": true },
      { "id": "st_mon1_3", "title": "Deep work focus timer with soundscapes", "completed": true },
      { "id": "st_mon1_4", "title": "Sub-tasks & milestone decomposition", "completed": false }
    ]
  },
  {
    "id": "mon_02",
    "title": "Contribute to 2 Open-Source AI Tooling Repositories",
    "description": "Submit PRs improving documentation, test coverage, or MCP plugin integrations.",
    "tier": "monthly",
    "completed": true,
    "completedAt": "2026-08-15T18:00:00Z",
    "createdAt": "2026-08-01T00:00:00Z",
    "dueDate": "2026-08-25",
    "priority": "medium",
    "category": "Career",
    "parentId": "ann_01",
    "tags": [
      "august",
      "open-source",
      "git"
    ]
  },
  {
    "id": "mon_03",
    "title": "Complete 100 km Running Distance in August",
    "description": "Run 4 times per week; track pacing and heart rate zones in training log.",
    "tier": "monthly",
    "completed": false,
    "completedAt": null,
    "createdAt": "2026-08-01T00:00:00Z",
    "dueDate": "2026-08-31",
    "priority": "high",
    "category": "Health",
    "parentId": "qrt_03",
    "tags": [
      "august",
      "running",
      "mileage"
    ]
  },
  {
    "id": "wek_01",
    "title": "Design and finalize UI/UX architecture for Goal Cascade system",
    "description": "Draft wireframes, color palette, custom checkbox animations, and horizon switcher.",
    "tier": "weekly",
    "completed": true,
    "completedAt": "2026-08-17T11:20:00Z",
    "createdAt": "2026-08-17T08:00:00Z",
    "dueDate": "2026-08-19",
    "priority": "urgent",
    "category": "Product",
    "parentId": "mon_01",
    "tags": [
      "ui-ux",
      "frontend",
      "week34"
    ]
  },
  {
    "id": "wek_02",
    "title": "Implement deterministic Python CLI for task management & stats export",
    "description": "Build CLI commands for listing, filtering, toggling status, and generating productivity JSON summaries.",
    "tier": "weekly",
    "completed": false,
    "completedAt": null,
    "createdAt": "2026-08-17T08:00:00Z",
    "dueDate": "2026-08-21",
    "priority": "high",
    "category": "Engineering",
    "parentId": "mon_01",
    "tags": [
      "cli",
      "python",
      "week34"
    ]
  },
  {
    "id": "wek_03",
    "title": "Run 25 km total volume across 3 training sessions this week",
    "description": "Session 1: 7km easy, Session 2: 6km tempo intervals, Session 3: 12km long run.",
    "tier": "weekly",
    "completed": false,
    "completedAt": null,
    "createdAt": "2026-08-17T08:00:00Z",
    "dueDate": "2026-08-23",
    "priority": "medium",
    "category": "Health",
    "parentId": "mon_03",
    "tags": [
      "running",
      "training",
      "week34"
    ]
  },
  {
    "id": "wek_04",
    "title": "Review weekly budget, subscription audits & expense allocations",
    "description": "Categorize transactions, cancel unused SaaS subscriptions, and record net savings.",
    "tier": "weekly",
    "completed": true,
    "completedAt": "2026-08-18T16:00:00Z",
    "createdAt": "2026-08-17T08:00:00Z",
    "dueDate": "2026-08-20",
    "priority": "low",
    "category": "Finance",
    "parentId": "qrt_02",
    "tags": [
      "finance",
      "budget",
      "week34"
    ]
  },
  {
    "id": "day_01",
    "title": "Build interactive checkbox UI with micro-animations & confetti particle triggers",
    "description": "Ensure seamless check/uncheck experience with immediate visual feedback and ripple effect.",
    "tier": "daily",
    "completed": false,
    "completedAt": null,
    "createdAt": "2026-08-18T09:00:00Z",
    "dueDate": "2026-08-18",
    "priority": "urgent",
    "category": "Product",
    "parentId": "wek_01",
    "tags": [
      "checkbox",
      "animation",
      "ui"
    ]
  },
  {
    "id": "day_02",
    "title": "Connect LocalStorage synchronization & instant filter horizon tabs",
    "description": "Support instant switching between All, Daily, Weekly, Monthly, Quarterly, and Annual views.",
    "tier": "daily",
    "completed": false,
    "completedAt": null,
    "createdAt": "2026-08-18T09:00:00Z",
    "dueDate": "2026-08-18",
    "priority": "high",
    "category": "Engineering",
    "parentId": "wek_01",
    "tags": [
      "state",
      "storage",
      "tabs"
    ]
  },
  {
    "id": "day_03",
    "title": "Morning 7 km endurance run & stretching routine",
    "description": "Pace: 5:40 min/km. Hydration: 500ml electrolyte water.",
    "tier": "daily",
    "completed": true,
    "completedAt": "2026-08-18T07:15:00Z",
    "createdAt": "2026-08-18T06:00:00Z",
    "dueDate": "2026-08-18",
    "priority": "medium",
    "category": "Health",
    "parentId": "wek_03",
    "tags": [
      "run",
      "fitness",
      "routine"
    ]
  },
  {
    "id": "day_04",
    "title": "Review pull requests and benchmark latency on vector search pipeline",
    "description": "Check top-k retrieval performance and memory footprint under 50 concurrency.",
    "tier": "daily",
    "completed": false,
    "completedAt": null,
    "createdAt": "2026-08-18T10:30:00Z",
    "dueDate": "2026-08-18",
    "priority": "medium",
    "category": "Engineering",
    "parentId": "mon_02",
    "tags": [
      "code-review",
      "performance"
    ]
  },
  {
    "id": "day_05",
    "title": "Read 20 pages of Systems Thinking & Architecture Design",
    "description": "Take notes on feedback loops, decoupling heuristics, and state machine designs.",
    "tier": "daily",
    "completed": true,
    "completedAt": "2026-08-18T14:45:00Z",
    "createdAt": "2026-08-18T08:00:00Z",
    "dueDate": "2026-08-18",
    "priority": "low",
    "category": "Career",
    "parentId": "ann_01",
    "tags": [
      "reading",
      "knowledge",
      "habits"
    ]
  }
];
