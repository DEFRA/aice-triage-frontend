#!/bin/bash

# Check for unpinned dependencies in package.json and package-lock.json
set -e

check_package_json() {
  local filename="$1"
  
  if [[ ! -f "$filename" ]]; then
    echo "ERROR: File not found: $filename"
    return 1
  fi
  
  local unpinned_deps
  unpinned_deps=$(jq -r '
    (.dependencies // {}, .devDependencies // {}) |
    to_entries[] |
    select(.value | test("^[^0-9]")) |
    "\(.key): \(.value)"
  ' "$filename")
  
  if [[ -n "$unpinned_deps" ]]; then
    echo "ERROR: Unpinned dependencies found in $filename:"
    echo "$unpinned_deps"
    return 1
  fi
  
  return 0
}

check_package_lock_json() {
  local filename="$1"
  
  if [[ ! -f "$filename" ]]; then
    echo "ERROR: File not found: $filename"
    return 1
  fi
  
  local unpinned_deps
  unpinned_deps=$(jq -r '
    .packages."".dependencies // {}, .packages."".devDependencies // {} |
    to_entries[] |
    select(.value | test("^[^0-9]")) |
    "\(.key): \(.value)"
  ' "$filename")
  
  if [[ -n "$unpinned_deps" ]]; then
    echo "ERROR: Unpinned dependencies found in $filename:"
    echo "$unpinned_deps"
    return 1
  fi
  
  return 0
}

# Check both files
check_package_json "package.json"
check_package_lock_json "package-lock.json"

echo "All dependencies are properly pinned."
exit 0
