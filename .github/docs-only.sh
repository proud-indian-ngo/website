#!/usr/bin/env bash
# Prints docs=true (for $GITHUB_OUTPUT) when every file a pull request or push changes is Markdown outside src/ (the
# README, AGENTS.md): the browser checks and Lighthouse then have nothing new to test. Anything it can't work out (other
# events, a new branch, a failed fetch) counts as a code change. Needs EVENT, and PR_BASE or BEFORE.
set -uo pipefail

case "$EVENT" in
  pull_request) base="${PR_BASE:-}" ;;
  push) base="${BEFORE:-}" ;;
  *) base="" ;;
esac

docs=false
# the checkout is shallow: fetch the base commit itself, then compare the two trees
if [[ -n "$base" && ! "$base" =~ ^0+$ ]] &&
  git fetch -q --depth=1 origin "$base" &&
  files=$(git diff --name-only "$base" HEAD) &&
  [[ -n "$files" ]] &&
  ! grep -qvE '\.md$' <<<"$files" &&
  ! grep -qE '^src/' <<<"$files"; then
  docs=true
  echo "Docs-only change:" >&2
  echo "$files" >&2
fi
echo "docs=$docs"
