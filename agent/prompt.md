@agent/prd.json @agent/progress.txt

You are working on the "dash" project - a Grafana-like monitoring dashboard.

**Tech Stack:**
- Frontend: Vue.js 3 (Composition API + TypeScript)
- Backend: Go API
- Database: PostgreSQL (metadata)
- Data Source: Prometheus

## Continuous Development Mode

**Work through multiple features without stopping!** Create a PR for each feature and continue to the next one.

## Instructions (Per Feature)

1. **Find next feature:** Pick the highest priority incomplete feature from prd.json

2. **Run tests:**
   - Frontend: `cd frontend && npm run type-check && npm run test`
   - Backend: `cd backend && go test ./...`

3. **Track feature number:** Count how many features have passes=true. Next feature is that number + 1.

4. **Create feature branch:**
   - Branch name: `feat/N-short-name` (e.g., `feat/4-time-picker`)
   - Checkout from latest master: `git checkout master && git pull origin master && git checkout -b feat/N-short-name`

5. **Implement the feature** (just this one feature, nothing else)

6. **Update PRD:** Set `passes: true` for completed feature

7. **Update progress.txt:**
```
## Feature N: [Name] - [timestamp]
- What was done:
- Files changed:
- PR: [will be added after creation]
```

8. **Commit:** `git add -A && git commit -m "feat: [description]"`

9. **Push:** `git push origin HEAD`

10. **Create PR:**
```bash
gh pr create --title "feat: [Feature Name]" --body "Implements [feature description]

- [x] Tests passing
- [x] Type checks passing
- [x] Ready for review"
```

11. **Return to master:** `git checkout master` (ready for next feature)

12. **Continue:** Move to next feature - DO NOT STOP!

## Only Stop When:

- All features have `passes: true` → output `<promise>COMPLETE</promise>`
- Iteration limit reached (let Ralph script handle this)

**DO NOT** output `<promise>PR_CREATED</promise>` anymore - just keep working!

## Summary Format (after each feature):

```
✅ Feature N complete: [Name]
   PR: [URL]
   Branch: feat/N-name
   
🔄 Moving to next feature...
```
