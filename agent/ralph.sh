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
opencode_config_file="$script_dir/opencode-auto-allow.json"

has_marker() {
  local output="$1"
  local marker="$2"

  [[ "$output" == *"<promise>${marker}</promise>"* ]] || \
    [[ "$output" == *"\\u003cpromise\\u003e${marker}\\u003c/promise\\u003e"* ]] || \
    [[ "$output" == *"&lt;promise&gt;${marker}&lt;/promise&gt;"* ]]
}

has_auto_rejected_permission() {
  local output="$1"

  [[ "$output" == *"permission requested:"*"auto-rejecting"* ]] || \
    [[ "$output" == *"permission requested:"*"auto-rejected"* ]]
}

print_relevant_output() {
  local output="$1"
  local printed="false"

  while IFS= read -r line; do
    case "$line" in
      *"Selected Task:"*|*"✅ Task complete:"*|*"❌ Task blocked:"*|*"<promise>"*|*"\\u003cpromise\\u003e"*)
        echo "$line"
        printed="true"
        ;;
    esac
  done <<< "$output"

  if [ "$printed" = "false" ]; then
    echo "$output"
  fi
}

if [ ! -f "$prompt_file" ]; then
  echo "Missing prompt file: $prompt_file"
  exit 1
fi

if [ ! -f "$opencode_config_file" ]; then
  echo "Missing OpenCode config file: $opencode_config_file"
  exit 1
fi

for i in $(seq 1 "$iterations"); do
  echo "Iteration $i"
  echo "----------------------------------------"

  # Intentionally do not use --continue to force a fresh session/thread per task.
  session_title="ralph-task-${i}-$(date +%Y%m%d-%H%M%S)"
  prompt_content="$(<"$prompt_file")"

  if ! result=$(OPENCODE_CONFIG="$opencode_config_file" opencode run --format default --model "openai/gpt-5.3-codex" --variant high --title "$session_title" "$prompt_content" 2>&1); then
    echo "$result"
    echo "OpenCode run failed. Stopping."
    exit 1
  fi

  print_relevant_output "$result"

  if has_marker "$result" "COMPLETE"; then
    echo "All tasks complete!"
    exit 0
  fi

  if has_marker "$result" "TASK_COMPLETE"; then
    echo "Task complete. Starting next task in a new session..."
  fi
done

echo "Reached iteration limit. Review progress and continue if needed."
