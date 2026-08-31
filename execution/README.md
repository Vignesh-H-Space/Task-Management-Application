# Layer 3: Execution Scripts

This directory contains deterministic Python scripts that perform specific actions for Task Management.

## Guidelines for Execution Scripts

- Scripts handle API calls, data processing, file operations, and external system integrations.
- Always load environment variables and API keys from `.env`.
- Write intermediate output files to `.tmp/`.
- Ensure scripts are deterministic, well-commented, robustly handle errors, and return clear exit status and error tracebacks.

## Script Template

```python
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def main():
    # Deterministic logic here
    pass

if __name__ == "__main__":
    main()
```
