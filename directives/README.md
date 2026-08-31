# Layer 1: Directives (SOPs)

This directory contains standard operating procedures (SOPs) written in Markdown for the Task Management system.

## Guidelines for Directives

- Directives define **what to do** in natural language instructions.
- Specify clear goals, input expectations, execution scripts to call, expected outputs, and edge cases.
- Directives are living documents: update them as learnings, API rate limits, or new requirements emerge.

## Directive Structure Template

```markdown
# Directive: [Task Name]

## Overview
Brief description of the SOP's goal and purpose.

## Inputs
- Required input parameters, environment variables, or files.

## Workflow & Execution Scripts
1. Step 1: Run `execution/script_name.py` with required parameters.
2. Step 2: Process intermediate files saved to `.tmp/`.
3. Step 3: Produce final deliverable (e.g. cloud Google Sheet/Slides, webapp updates, etc.).

## Error Handling & Edge Cases
- Document known constraints, retry logic, rate limits, or error recovery steps.
```
