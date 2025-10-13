# Daily Development Logs

## Purpose

Track **day-by-day development work** including tasks completed, decisions made, blockers encountered, and plans for the next day. This creates a chronological record of project evolution.

---

## 📁 Organization

```
daily-logs/
├── TEMPLATE.md                    # Copy this to start new log
├── 2025-01/                       # Year-Month folders
│   ├── 2025-01-13_template-system-planning.md
│   ├── 2025-01-14_mongodb-setup.md
│   ├── 2025-01-15_component-extraction.md
│   └── ...
├── 2025-02/
│   └── ...
└── archive/                       # Logs older than 6 months
    └── 2024-07/
```

---

## 📝 Naming Convention

### Format
```
YYYY-MM-DD_descriptive-topic.md
```

### Examples
✅ **Good**:
- `2025-01-13_template-system-planning.md`
- `2025-01-14_mongodb-integration-setup.md`
- `2025-01-15_hero-component-extraction.md`
- `2025-01-16_api-endpoints-implementation.md`

❌ **Bad**:
- `jan13.md` (not sortable)
- `2025-01-13.md` (no topic context)
- `Template_System.md` (wrong format)
- `work.md` (not descriptive)

### Rules
1. Always start with ISO date: `YYYY-MM-DD`
2. Use lowercase for topic
3. Separate words with hyphens
4. Be descriptive but concise (2-5 words)
5. Focus on main task of the day

---

## 🚀 Quick Start

### 1. Create Today's Log

```bash
# Copy template
cp doc/02-development/daily-logs/TEMPLATE.md \
   doc/02-development/daily-logs/$(date +%Y-%m)/$(date +%Y-%m-%d)_your-topic.md

# Edit the file
code doc/02-development/daily-logs/$(date +%Y-%m)/$(date +%Y-%m-%d)_your-topic.md
```

### 2. Fill In Sections

- **Morning**: Set objectives for the day
- **During work**: Update as you complete tasks
- **End of day**: Summarize, note learnings, plan tomorrow

### 3. Commit Daily

```bash
git add doc/02-development/daily-logs/
git commit -m "docs: daily log for $(date +%Y-%m-%d)"
git push
```

---

## 📋 When to Create a Daily Log

### ✅ DO create a log when:

- Working on implementation tasks
- Making technical decisions
- Solving complex problems
- Learning new technologies
- Conducting experiments
- Pair programming sessions
- Major refactoring work
- Performance optimization
- Bug investigation

### ❌ DON'T create a log when:

- Only attending meetings (add to previous day)
- Out sick or on vacation
- Working on trivial tasks (<30 min)
- Doing administrative work only
- Day off or holiday

**Rule of thumb**: If you wrote code or made decisions, write a log.

---

## ✍️ What to Include

### Required Sections

1. **Objectives** - What you planned to do
2. **Completed** - What you actually did
3. **In Progress** - What's still ongoing
4. **Blockers** - What's stopping you
5. **Tomorrow's Plan** - What's next

### Optional Sections (but highly recommended)

6. **Decisions Made** - Choices and rationale
7. **Learnings** - What you discovered
8. **Questions** - Things you need to clarify
9. **Code References** - Links to files/commits
10. **Metrics** - Time spent, tests added, etc.

### What Makes a Good Entry

✅ **Good**: Specific, actionable, referenced
```markdown
### Extract Hero Component
**Time**: 2 hours
**Files**: `src/App.tsx:233-265` → `components/blocks/HeroSection/HeroSection.tsx`
**Decision**: Used variant prop instead of separate components for maintainability
**Learnings**: Next.js Image requires explicit width/height props
**Next**: Add SSR compatibility and test with different configs
```

❌ **Bad**: Vague, no context
```markdown
### Worked on components
Did some component stuff. Made progress.
```

---

## 🎯 Daily Log Workflow

### Morning Routine (9:00 AM)

1. **Review yesterday's log**
   - What did I plan to do today?
   - Any blockers to address first?

2. **Create today's log**
   - Copy template
   - List objectives
   - Prioritize tasks

3. **Check team updates**
   - Read others' logs
   - Identify dependencies

### During Work

4. **Update as you go**
   - Mark tasks complete ✅
   - Document decisions immediately
   - Note blockers when they happen
   - Add code references

### End of Day (5:30 PM)

5. **Complete the log**
   - Fill in remaining sections
   - Add time tracking
   - Document learnings
   - Plan tomorrow

6. **Review and commit**
   - Proofread
   - Add links
   - Commit to git
   - Share in team chat if needed

---

## 📊 Using Daily Logs

### For You

- **Track progress** - See what you accomplished
- **Remember decisions** - Why did I do that?
- **Estimate better** - How long do things take?
- **Performance reviews** - Evidence of work

### For Team

- **Stay aligned** - Know what others are doing
- **Avoid duplicates** - See who's working on what
- **Share knowledge** - Learn from others
- **Help blockers** - Identify who needs help

### For Managers

- **Project status** - Daily progress updates
- **Resource allocation** - Who's overloaded?
- **Risk identification** - Recurring blockers
- **Team velocity** - Actual vs estimated time

---

## 🔍 Searching Logs

### By Date Range

```bash
# Find all logs from January 2025
ls doc/02-development/daily-logs/2025-01/

# Find specific date
cat doc/02-development/daily-logs/2025-01/2025-01-13_*.md
```

### By Topic

```bash
# Search for "template" across all logs
grep -r "template" doc/02-development/daily-logs/

# Find MongoDB-related work
grep -r "mongodb" doc/02-development/daily-logs/ --include="*.md"
```

### By Author

```bash
# Find logs by specific author
grep -l "**Developer**: John" doc/02-development/daily-logs/**/*.md
```

### By Status

```bash
# Find all blocked tasks
grep -B2 "🔴" doc/02-development/daily-logs/**/*.md
```

---

## 📈 Log Quality Checklist

Before committing your daily log:

### Content Quality
- [ ] All objectives listed
- [ ] Completed tasks detailed with code references
- [ ] Decisions documented with reasoning
- [ ] Blockers clearly explained
- [ ] Tomorrow's plan is specific
- [ ] Time tracking is honest

### Technical Details
- [ ] File paths are correct
- [ ] Line numbers provided where relevant
- [ ] Commit hashes included
- [ ] Links to related docs work
- [ ] Code snippets have syntax highlighting

### Writing Quality
- [ ] No typos or grammar errors
- [ ] Sentences are clear and concise
- [ ] Technical terms are explained
- [ ] Status indicators used appropriately
- [ ] Markdown formatting is correct

---

## 🎨 Tips for Better Logs

### 1. Write as You Go
Don't wait until end of day - update throughout:
- ✅ Complete a task → Update log
- 🔴 Hit a blocker → Document it
- 💡 Learn something → Note it down

### 2. Be Specific
Instead of: "Fixed bug"
Write: "Fixed MongoDB connection timeout by changing authSource from 'app' to 'admin' in connection string (lib/db/mongodb.ts:10)"

### 3. Link Everything
- Code: `[template.config.ts:45](../../path/to/file.ts#L45)`
- Commits: `abc123`
- Docs: `[ADR-001](../architecture/ADR-001.md)`
- Issues: `#123`

### 4. Document Decisions
Every "I chose X over Y" needs:
- What were the options?
- Why did you choose X?
- What are the trade-offs?

### 5. Track Time Honestly
Real estimates come from real data:
- Don't round to hours
- Include interruptions
- Separate coding from meetings
- Track blockers separately

### 6. Plan Tomorrow Today
Before you leave:
- List 3-5 specific tasks
- Prioritize them
- Note dependencies
- Set realistic goals

---

## 🔄 Weekly Review Process

Every Friday, review the week's logs:

### Personal Review
1. What did I accomplish?
2. What took longer than expected?
3. What blockers recurred?
4. What did I learn?
5. What can I improve?

### Team Review
1. Share highlights in team meeting
2. Identify patterns across team
3. Address common blockers
4. Celebrate wins

### Archive
After 6 months, move to archive:
```bash
mv doc/02-development/daily-logs/2024-07 \
   doc/02-development/daily-logs/archive/
```

---

## 📞 Questions?

### "I forgot to write yesterday's log"
Write it today with "[Retroactive]" in title:
`2025-01-12_[retroactive]_api-implementation.md`

Fill in what you remember - better than nothing!

### "I'm working on multiple things"
Choose the main focus for the filename, list all tasks in objectives.

### "Nothing interesting happened"
Even "routine" days are worth documenting:
- What did you learn?
- What could be improved?
- How can you be more efficient?

### "Should I commit every day?"
Yes! Commit at end of day even if incomplete. It's a work log, not a final report.

---

## 📚 Examples

See:
- [TEMPLATE.md](./TEMPLATE.md) - Copy this to start
- [2025-01-13_template-system-planning.md](./2025-01/2025-01-13_template-system-planning.md) - Example log

---

**Last Updated**: January 13, 2025
**Maintained By**: Development Team
