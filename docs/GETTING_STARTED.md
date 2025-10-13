# Getting Started with VINC Documentation

**Welcome!** This guide will help you navigate and use the documentation system.

---

## 📂 Documentation Structure

```
doc/
├── README.md                      # ← Documentation guidelines (start here)
├── GETTING_STARTED.md            # ← This file
│
├── 01-guidelines/                # Project standards
│   └── README.md
│
├── 02-development/               # Day-to-day docs
│   ├── daily-logs/               # Daily development logs
│   ├── architecture/             # Architecture decisions (ADRs)
│   ├── features/                 # Feature documentation
│   ├── api/                      # API documentation
│   ├── database/                 # Database schemas
│   └── components/               # Component docs
│
├── 03-reference/                 # Quick references
│   ├── CHEATSHEET.md            # Commands & snippets
│   ├── GLOSSARY.md              # Terminology
│   └── TEMPLATES.md             # Doc templates
│
├── FRONTSHOP_VINC.MD            # Production CMS implementation
├── TEMPLATE_SYSTEM_IMPLEMENTATION.md
└── TEMPLATE_SYSTEM_QUICKSTART.md
```

---

## 🚀 Quick Start

### For New Team Members

#### Day 1: Read These First
1. **[README.md](./README.md)** - Documentation guidelines (15 min)
2. **[01-guidelines/](./01-guidelines/)** - Project standards (30 min)
3. **[03-reference/GLOSSARY.md](./03-reference/GLOSSARY.md)** - Learn the terminology (10 min)

#### Day 2: Setup Your Workflow
1. Copy daily log template:
```bash
cp doc/02-development/daily-logs/TEMPLATE.md \
   doc/02-development/daily-logs/$(date +%Y-%m)/$(date +%Y-%m-%d)_onboarding.md
```

2. Start documenting your learning journey
3. Ask questions in daily log

#### Week 1: Deep Dive
- Read all feature documentation in `02-development/features/`
- Review architecture decisions in `02-development/architecture/`
- Familiarize with API docs in `02-development/api/`

---

### For Existing Developers

#### Daily Routine

**Morning** (5 minutes):
```bash
# Create today's log
cp doc/02-development/daily-logs/TEMPLATE.md \
   doc/02-development/daily-logs/$(date +%Y-%m)/$(date +%Y-%m-%d)_my-topic.md

# List objectives
# Plan the day
```

**During Work** (ongoing):
- Update log as you complete tasks
- Document decisions immediately
- Note blockers when they happen

**End of Day** (10 minutes):
```bash
# Complete your log
# Plan tomorrow
# Commit to git
git add doc/02-development/daily-logs/
git commit -m "docs: daily log for $(date +%Y-%m-%d)"
git push
```

---

### For Team Leads

#### Weekly Tasks
- [ ] Review team's daily logs
- [ ] Identify blockers
- [ ] Check documentation coverage
- [ ] Update guidelines if needed

#### Monthly Tasks
- [ ] Architecture review
- [ ] Documentation audit
- [ ] Update standards
- [ ] Archive old logs

---

## 📋 Common Tasks

### Writing Daily Logs

```bash
# 1. Create from template
cp doc/02-development/daily-logs/TEMPLATE.md \
   doc/02-development/daily-logs/$(date +%Y-%m)/$(date +%Y-%m-%d)_topic.md

# 2. Edit the file
code doc/02-development/daily-logs/$(date +%Y-%m)/$(date +%Y-%m-%d)_topic.md

# 3. Fill in sections throughout the day

# 4. Commit at end of day
git add doc/02-development/daily-logs/
git commit -m "docs: daily log for $(date +%Y-%m-%d)"
```

**See**: [Daily Log Guidelines](./02-development/daily-logs/README.md)

---

### Creating Architecture Decision Records (ADRs)

```bash
# 1. Determine next ADR number
ls doc/02-development/architecture/ADR-*.md | wc -l

# 2. Create new ADR
touch doc/02-development/architecture/ADR-00X-your-decision.md

# 3. Use ADR template (from README.md)

# 4. Fill in all sections

# 5. Get team review before finalizing
```

**See**: [Architecture Section](./02-development/README.md#-architecture-architecture)

---

### Documenting New Features

```bash
# 1. Create feature directory
mkdir -p doc/02-development/features/feature-name

# 2. Create required docs
touch doc/02-development/features/feature-name/OVERVIEW.md
touch doc/02-development/features/feature-name/IMPLEMENTATION.md
touch doc/02-development/features/feature-name/API.md
touch doc/02-development/features/feature-name/TESTING.md

# 3. Use feature templates (from README.md)

# 4. Update as you build
```

**See**: [Feature Documentation](./02-development/README.md#-features-features)

---

### Adding to Troubleshooting

```bash
# When you solve a problem:

# 1. Create troubleshooting doc
touch doc/02-development/troubleshooting/problem-name.md

# 2. Document:
#    - Problem description
#    - Error messages
#    - What didn't work
#    - What did work
#    - Prevention tips

# 3. Link from daily log

# 4. Share with team
```

---

## 🔍 Finding Information

### By Topic

```bash
# Search all docs
grep -r "template system" doc/

# Search specific section
grep -r "MongoDB" doc/02-development/
```

### By Date

```bash
# Find logs from January 2025
ls doc/02-development/daily-logs/2025-01/

# Find specific date
cat doc/02-development/daily-logs/2025-01/2025-01-13_*.md
```

### By Type

```bash
# All ADRs
ls doc/02-development/architecture/ADR-*.md

# All feature docs
find doc/02-development/features/ -name "OVERVIEW.md"

# All daily logs this month
ls doc/02-development/daily-logs/$(date +%Y-%m)/
```

---

## ✅ Documentation Checklist

Before committing documentation:

### Content
- [ ] Title is clear and descriptive
- [ ] Purpose/overview is stated
- [ ] All required sections are complete
- [ ] Examples are included
- [ ] Code references are accurate
- [ ] Links work

### Formatting
- [ ] Markdown is valid
- [ ] Headers follow hierarchy (H1 → H2 → H3)
- [ ] Code blocks have syntax highlighting
- [ ] Lists are consistent
- [ ] Tables are formatted

### Metadata
- [ ] Last updated date is current
- [ ] Author is specified
- [ ] Status is accurate
- [ ] Related docs are linked

---

## 🎯 Project Documentation Map

### Production Implementation
- **[FRONTSHOP_VINC.MD](./FRONTSHOP_VINC.MD)** - Complete CMS implementation guide
  - SEO-first architecture
  - MongoDB schemas
  - Production deployment
  - Component documentation

### Template System
- **[TEMPLATE_SYSTEM_IMPLEMENTATION.MD](./TEMPLATE_SYSTEM_IMPLEMENTATION.MD)** - Technical details
- **[TEMPLATE_SYSTEM_QUICKSTART.MD](./TEMPLATE_SYSTEM_QUICKSTART.MD)** - Quick reference

### Standards & Guidelines
- **[README.md](./README.md)** - Documentation standards
- **[01-guidelines/](./01-guidelines/)** - Code and process guidelines

### Daily Development
- **[02-development/daily-logs/](./02-development/daily-logs/)** - Day-to-day logs
- **[02-development/architecture/](./02-development/architecture/)** - ADRs
- **[02-development/features/](./02-development/features/)** - Feature docs

---

## 💡 Tips for Great Documentation

### 1. Write as You Code
Don't wait until the end:
- Document decisions when you make them
- Note blockers immediately
- Update daily log throughout the day

### 2. Be Specific
Bad: "Fixed bug"
Good: "Fixed MongoDB connection timeout by changing authSource parameter (lib/db/mongodb.ts:10)"

### 3. Link Everything
- Code: `[file.ts:45](path/to/file.ts#L45)`
- Commits: Reference by hash
- Docs: Use relative links
- Issues: Link to tracking system

### 4. Use Examples
- Code snippets
- Screenshots
- Diagrams
- Before/after comparisons

### 5. Keep It Current
- Update as things change
- Mark deprecated docs
- Archive old content
- Review regularly

---

## 📞 Getting Help

### Documentation Questions
1. Check [README.md](./README.md) first
2. Look at examples in existing docs
3. Ask in #documentation Slack channel
4. Review with team lead

### Technical Questions
1. Check [03-reference/GLOSSARY.md](./03-reference/GLOSSARY.md)
2. Search [02-development/troubleshooting/](./02-development/troubleshooting/)
3. Look at feature docs
4. Ask in daily standup

---

## 🎓 Learning Path

### Week 1: Foundations
- [ ] Read documentation guidelines
- [ ] Start writing daily logs
- [ ] Review existing docs
- [ ] Learn project terminology

### Week 2: Contributing
- [ ] Document a small feature
- [ ] Create troubleshooting doc
- [ ] Review others' docs
- [ ] Ask questions in logs

### Week 3: Mastery
- [ ] Write comprehensive feature doc
- [ ] Create ADR for decision
- [ ] Help others with docs
- [ ] Suggest improvements

---

## 📊 Documentation Health

### Current Status (as of 2025-01-13)

| Section | Status | Priority |
|---------|--------|----------|
| Documentation Structure | ✅ Complete | - |
| Daily Log System | ✅ Complete | - |
| Template System Docs | ✅ Complete | - |
| Guidelines | 📝 To Create | High |
| Feature Docs | 📝 To Create | High |
| API Docs | 📝 To Create | Medium |
| Troubleshooting | 📝 To Create | Medium |

---

## 🎯 Next Steps

### Immediate (This Week)
1. Start writing daily logs
2. Document current work
3. Create first ADR
4. Add to glossary

### Short Term (This Month)
1. Complete guidelines section
2. Document all features
3. Create API documentation
4. Build troubleshooting library

### Long Term (This Quarter)
1. Comprehensive component docs
2. Video tutorials
3. Interactive examples
4. Knowledge base

---

## ✨ Success Metrics

We know documentation is working when:
- ✅ New team members onboard in < 3 days
- ✅ Questions are answered by docs, not people
- ✅ Daily logs are written consistently
- ✅ Decisions are documented and findable
- ✅ Code reviews reference guidelines
- ✅ Troubleshooting docs prevent repeated issues

---

**Questions?** Ask in #documentation or refer to [README.md](./README.md)

**Last Updated**: January 13, 2025
