# /recap

Create a session recap capturing what was built today and log it to `docs/learnings.md`.

1. Run `git log --oneline -12` to see recent commits.
2. Read `docs/learnings.md` to understand existing entries.
3. Write a concise recap section at the top of the file, under a new dated heading:
   ```
   ### YYYY-MM-DD — Session Recap
   **Built:** [bullet list of features/fixes shipped]
   **Decisions:** [key design/technical decisions made]
   **Watch for:** [any gotchas or known rough edges]
   ```
4. Write the updated file.
5. Summarise the recap to the user in chat (3–5 bullets max).
