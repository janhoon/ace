#!/bin/bash

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <number of iterations>"
  exit 1
fi

iterations="$1"

if ! [[ "$iterations" =~ ^[0-9]+$ ]] || [ "$iterations" -lt 1 ]; then
  echo "Iterations must be a positive integer"
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
prompt_file="$script_dir/prompt.md"

if [ ! -f "$prompt_file" ]; then
  echo "Missing prompt file: $prompt_file"
  exit 1
fi

for i in $(seq 1 "$iterations"); do
  echo "Iteration $i"
  echo "----------------------------------------"

  # Intentionally do not use --continue to force a fresh session/thread per task.
  session_title="ralph-task-${i}-$(date +%Y%m%d-%H%M%S)"
  prompt_content="$(<"$prompt_file")"

  if ! result=$(opencode run --format json --title "$session_title" "$prompt_content" 2>&1); then
    echo "$result"
    echo "OpenCode run failed. Stopping."
    exit 1
  fi

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "All tasks complete!"
    exit 0
  fi

  if [[ "$result" == *"<promise>TASK_COMPLETE</promise>"* ]]; then
    echo "Task complete. Starting next task in a new session..."
    continue
  fi

  if [[ "$result" == *"<promise>BLOCKED</promise>"* ]]; then
    echo "Task blocked. Stopping for manual intervention."
    exit 1
  fi

  echo "No completion marker found. Stopping to avoid duplicate work."
  exit 1
done

echo "Reached iteration limit. Review progress and continue if needed."
