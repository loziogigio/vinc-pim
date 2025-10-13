# Documentation Structure & Guidelines

## 📚 Overview

This document defines the standard structure, naming conventions, and best practices for all documentation in the VINC project. Following these guidelines ensures consistency, maintainability, and ease of navigation.

---

## 📂 Folder Structure

```
doc/
├── README.md                           # This file - Documentation guidelines
│
├── 01-guidelines/                      # Section 1: Project Guidelines
│   ├── README.md                       # Guidelines section overview
│   ├── CODING_STANDARDS.md            # Code style and conventions
│   ├── GIT_WORKFLOW.md                # Branching, commits, PR process
│   ├── NAMING_CONVENTIONS.md          # File, variable, component naming
│   ├── API_DESIGN.md                  # API endpoint standards
│   ├── DATABASE_SCHEMA.md             # MongoDB schema conventions
│   ├── TESTING_STRATEGY.md            # Testing approach and tools
│   ├── SECURITY_GUIDELINES.md         # Security best practices
│   ├── DEPLOYMENT_PROCESS.md          # CI/CD and deployment steps
│   └── CODE_REVIEW_CHECKLIST.md       # What to check in PRs
│
├── 02-development/                     # Section 2: Development Documentation
│   ├── README.md                       # Development section overview
│   │
│   ├── daily-logs/                     # Day-by-day development logs
│   │   ├── README.md                   # How to write daily logs
│   │   ├── 2025-01/                    # Year-Month organization
│   │   │   ├── 2025-01-13_template-system-planning.md
│   │   │   ├── 2025-01-14_mongodb-setup.md
│   │   │   └── 2025-01-15_component-extraction.md
│   │   └── 2025-02/
│   │       └── ...
│   │
│   ├── architecture/                   # Architecture decisions
│   │   ├── ADR-001-template-system.md  # Architecture Decision Records
│   │   ├── ADR-002-mongodb-choice.md
│   │   ├── ADR-003-nextjs-migration.md
│   │   └── system-diagrams/            # Visual diagrams
│   │       ├── template-flow.png
│   │       └── data-model.png
│   │
│   ├── features/                       # Feature-specific docs
│   │   ├── template-system/
│   │   │   ├── OVERVIEW.md
│   │   │   ├── IMPLEMENTATION.md
│   │   │   ├── API.md
│   │   │   └── TESTING.md
│   │   ├── page-builder/
│   │   │   ├── OVERVIEW.md
│   │   │   └── ...
│   │   └── seo-system/
│   │       └── ...
│   │
│   ├── api/                            # API documentation
│   │   ├── README.md                   # API overview
│   │   ├── endpoints/                  # Endpoint documentation
│   │   │   ├── templates.md
│   │   │   ├── pages.md
│   │   │   └── blocks.md
│   │   └── examples/                   # Request/response examples
│   │       ├── create-template.json
│   │       └── update-page.json
│   │
│   ├── database/                       # Database documentation
│   │   ├── schemas/                    # Schema definitions
│   │   │   ├── templates.md
│   │   │   ├── pages.md
│   │   │   └── users.md
│   │   ├── migrations/                 # Migration guides
│   │   │   └── 2025-01-13_initial-setup.md
│   │   └── queries/                    # Common query patterns
│   │       └── template-operations.md
│   │
│   ├── components/                     # Component documentation
│   │   ├── HeroSection.md
│   │   ├── ProductSection.md
│   │   └── ...
│   │
│   └── troubleshooting/                # Common issues and solutions
│       ├── mongodb-connection.md
│       ├── build-errors.md
│       └── deployment-issues.md
│
├── 03-reference/                       # Section 3: Quick Reference
│   ├── CHEATSHEET.md                   # Quick command reference
│   ├── GLOSSARY.md                     # Project terminology
│   ├── TEMPLATES.md                    # Document templates
│   └── LINKS.md                        # Important links and resources
│
└── assets/                             # Documentation assets
    ├── images/                         # Screenshots, diagrams
    ├── videos/                         # Tutorial videos
    └── files/                          # Sample files, configs
```

---

## 📋 Section 1: Guidelines

### Purpose
Contains **project-wide standards and best practices** that all team members must follow.

### Characteristics
- ✅ Prescriptive (tells you HOW to do things)
- ✅ Rarely changes once established
- ✅ Must be reviewed and approved by team
- ✅ Reference material for code reviews

### Document Template

```markdown
# [Topic] Guidelines

## Overview
Brief description of what this guideline covers.

## Standards

### Rule 1: [Name]
**Purpose**: Why this rule exists
**Implementation**: How to follow it
**Examples**:
```
Good example
```
```
Bad example
```

### Rule 2: [Name]
...

## Checklist
- [ ] Item to verify
- [ ] Another item

## References
- Link to external resources
- Related internal docs
```

### Naming Convention
- Format: `TOPIC_TYPE.md`
- Examples:
  - `CODING_STANDARDS.md`
  - `API_DESIGN.md`
  - `SECURITY_GUIDELINES.md`
- Always UPPERCASE with underscores
- Descriptive and specific

---

## 🔧 Section 2: Development

### Purpose
Contains **day-to-day development documentation**, including daily logs, feature docs, and technical decisions.

---

### 2.1: Daily Logs (`daily-logs/`)

#### Purpose
Track **what was done, why, and what's next** on a daily basis.

#### Structure
```
daily-logs/
└── YYYY-MM/                           # Year-Month folder
    └── YYYY-MM-DD_topic-slug.md      # Daily log file
```

#### Naming Convention
- Format: `YYYY-MM-DD_descriptive-topic.md`
- Examples:
  - `2025-01-13_template-system-planning.md`
  - `2025-01-14_mongodb-integration.md`
  - `2025-01-15_hero-component-extraction.md`
- Always lowercase with hyphens
- Date prefix for chronological sorting
- Descriptive topic for context

#### Daily Log Template

```markdown
# Daily Development Log - [Date]

**Date**: January 13, 2025
**Developer**: [Name]
**Status**: 🟢 On Track / 🟡 Blocked / 🔴 Critical Issue

---

## 📋 Today's Objectives
What did you plan to accomplish today?

- [ ] Task 1: Create template configuration system
- [ ] Task 2: Extract hero components
- [ ] Task 3: Setup MongoDB schemas

---

## ✅ Completed

### 1. [Task Name]
**Time Spent**: 2 hours

**What was done**:
- Created `config/templates/plumbing/template.config.ts`
- Defined branding structure
- Added default block configuration

**Code References**:
- [template.config.ts:1-50](path/to/file)
- [blocks.config.ts:1-100](path/to/file)

**Decisions Made**:
- Chose to use TypeScript interfaces over JSON for better type safety
- Decided on centralized config approach vs database-first

**Learnings**:
- TypeScript generics helped make configs type-safe
- Need to consider config validation at runtime

---

### 2. [Another Task]
...

---

## 🚧 In Progress

### [Task Name]
**Current Status**: 60% complete

**What's done**:
- Extracted HeroBanner component
- Made props configurable

**What's remaining**:
- Add SSR compatibility
- Create variants for split/grid layouts

**Blockers**:
- None / Waiting on design review

**Next Steps**:
1. Complete SSR implementation
2. Test with different configs
3. Document component API

---

## 🔴 Blockers & Issues

### Issue 1: MongoDB Connection Timeout
**Severity**: High
**Impact**: Cannot test database operations
**Description**:
Connection string format causing authentication errors.

**Attempted Solutions**:
1. Verified credentials - ✅ Correct
2. Checked MongoDB service - ✅ Running
3. Tested connection string - ❌ Still failing

**Resolution**:
Changed authSource parameter from 'app' to 'admin' - FIXED

**Reference**: [mongodb-connection.md](../troubleshooting/mongodb-connection.md)

---

## 🤔 Questions & Decisions Needed

### Question 1: Template Versioning
**Context**: Need to handle template config changes over time
**Options**:
1. Version in filename (template.config.v1.ts)
2. Version field in config object
3. Git history only

**Recommendation**: Option 2 - Version field in config
**Reason**: Easier to query, migrate, and track in database

**Decision**: ⏳ Pending team discussion

---

## 📊 Metrics

- **Lines of Code**: +450 / -120
- **Files Changed**: 8
- **Tests Added**: 3
- **Tests Passing**: 12/12
- **Build Time**: 23s
- **Bundle Size**: 145KB

---

## 📝 Notes

### Technical Notes
- Discovered that Next.js Image component requires explicit width/height
- MongoDB connection pooling works differently in serverless
- Framer Motion animations conflict with SSR - need to use dynamic imports

### Process Notes
- Daily standup at 9:30 AM
- Code review with Sarah took 30 mins
- Pair programming session with Tom on TypeScript types

### Ideas for Future
- Consider adding template preview in admin panel
- Could implement template marketplace
- Should document component prop types auto-generate

---

## 🎯 Tomorrow's Plan

### High Priority
1. Complete hero component extraction
2. Setup MongoDB models
3. Create template registry

### Medium Priority
4. Write unit tests for template resolver
5. Document component APIs

### Low Priority
6. Explore animation libraries
7. Research image optimization options

### Estimated Time
- High Priority: 4-5 hours
- Medium Priority: 2-3 hours
- Low Priority: 1 hour

---

## 📎 References

### Documentation Updated
- [TEMPLATE_SYSTEM_IMPLEMENTATION.md](../features/template-system/IMPLEMENTATION.md)
- [ADR-001-template-system.md](../architecture/ADR-001-template-system.md)

### Code Commits
- `feat: add template configuration system` - abc123
- `refactor: extract hero components` - def456

### External Resources
- [Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)
- [Mongoose Schema Best Practices](https://mongoosejs.com/docs/guide.html)

---

## 💬 Communication

### Team Updates
- Notified team about template system approach in Slack
- Scheduled review meeting for tomorrow 2 PM

### Stakeholder Updates
- None today

---

## ⏰ Time Tracking

| Activity | Duration |
|----------|----------|
| Planning & Design | 1h |
| Coding | 4h 30m |
| Testing | 1h |
| Documentation | 45m |
| Meetings | 30m |
| Code Review | 30m |
| **Total** | **8h 15m** |

---

## 🔄 Daily Standup Notes

**Yesterday**: Completed template system planning
**Today**: Implementing config structure and extracting components
**Blockers**: None
**Help Needed**: Design review on color scheme choices
```

#### Best Practices for Daily Logs

1. **Write at end of day** - While everything is fresh
2. **Be specific** - Include code references, file paths, line numbers
3. **Document decisions** - Explain WHY you chose an approach
4. **Track time honestly** - Helps with estimates
5. **Link everything** - Code, docs, issues, PRs
6. **Use emojis for status** - Visual quick scanning
7. **Update throughout day** - Don't wait until end
8. **Include blockers immediately** - Get help faster

#### When to Create a Daily Log

✅ **DO create a daily log when**:
- Working on implementation tasks
- Making architectural decisions
- Encountering and solving problems
- Learning new technologies
- Pair programming sessions

❌ **DON'T create a daily log when**:
- Only attending meetings (add to previous day's log)
- Working on trivial bug fixes (can batch in weekly summary)
- On vacation/sick leave (obviously)

---

### 2.2: Architecture (`architecture/`)

#### Purpose
Document **major technical decisions** using Architecture Decision Records (ADR).

#### ADR Template

```markdown
# ADR-XXX: [Decision Title]

**Status**: Proposed | Accepted | Deprecated | Superseded
**Date**: YYYY-MM-DD
**Deciders**: [Names]
**Related ADRs**: [Links to related ADRs]

---

## Context

What is the issue we're facing? What factors are influencing this decision?

## Decision

What did we decide to do?

## Rationale

Why did we choose this option?

### Options Considered

#### Option 1: [Name]
**Pros**:
- Pro 1
- Pro 2

**Cons**:
- Con 1
- Con 2

#### Option 2: [Name]
**Pros**:
- Pro 1

**Cons**:
- Con 1

### Selected Option
We chose **Option 1** because [reasoning].

## Consequences

### Positive
- What improvements will this bring?

### Negative
- What trade-offs are we making?

### Neutral
- What else changes?

## Implementation

### Required Changes
1. Change 1
2. Change 2

### Migration Path
How do we transition from current state to new state?

### Rollback Plan
How do we revert if this doesn't work?

## References
- [External article]
- [Internal doc]
```

#### Naming Convention
- Format: `ADR-XXX-short-title.md`
- Examples:
  - `ADR-001-template-system.md`
  - `ADR-002-mongodb-choice.md`
- Sequential numbering
- Lowercase with hyphens

---

### 2.3: Features (`features/`)

#### Purpose
Document **feature-specific implementation details**.

#### Structure
```
features/
└── feature-name/
    ├── OVERVIEW.md        # What is this feature?
    ├── IMPLEMENTATION.md  # How is it built?
    ├── API.md            # API documentation
    ├── TESTING.md        # How to test it
    └── CHANGELOG.md      # Version history
```

#### Feature Document Template

```markdown
# Feature: [Name]

## Overview
What does this feature do? Who is it for?

## User Stories
- As a [user type], I want [goal] so that [benefit]

## Technical Design

### Architecture
[Diagram or description]

### Components
- Component 1: Description
- Component 2: Description

### Data Flow
1. Step 1
2. Step 2

### Database Schema
[Schema definition]

### API Endpoints
- `GET /api/endpoint` - Description
- `POST /api/endpoint` - Description

## Implementation Details

### File Structure
```
feature/
├── components/
├── lib/
└── api/
```

### Key Files
- `file.ts:123` - Important logic here
- `other.ts:456` - Related functionality

### Dependencies
- External package 1
- External package 2

## Configuration

### Environment Variables
```bash
FEATURE_ENABLED=true
FEATURE_API_KEY=xxx
```

### Feature Flags
```typescript
const featureFlags = {
  enableNewFeature: true
};
```

## Testing

### Unit Tests
Location: `__tests__/feature.test.ts`
Coverage: 85%

### Integration Tests
Location: `__tests__/integration/feature.test.ts`

### E2E Tests
Location: `e2e/feature.spec.ts`

## Performance

### Benchmarks
- Load time: 200ms
- Bundle size: 45KB

### Optimization Opportunities
1. Opportunity 1
2. Opportunity 2

## Security Considerations
- Security aspect 1
- Security aspect 2

## Deployment

### Prerequisites
- Requirement 1
- Requirement 2

### Steps
1. Step 1
2. Step 2

### Rollback
How to revert this feature

## Monitoring

### Metrics to Track
- Metric 1
- Metric 2

### Alerts
- Alert condition 1
- Alert condition 2

## Known Issues
- Issue 1: Description and workaround
- Issue 2: Description and status

## Future Improvements
- Improvement 1
- Improvement 2

## References
- Design docs
- External resources
```

---

## 📖 Section 3: Reference

### Purpose
Quick lookup materials and templates.

### Contents

#### CHEATSHEET.md
```markdown
# Quick Reference

## Common Commands
```bash
# Development
npm run dev
npm run build

# Database
npm run db:migrate
npm run db:seed
```

## Environment Setup
...

## Code Snippets
...
```

#### GLOSSARY.md
```markdown
# Glossary

## A
**ADR**: Architecture Decision Record - Document explaining...

## B
**Block**: A reusable content component...

## T
**Template**: A complete storefront configuration...
```

---

## ✍️ Writing Standards

### Markdown Best Practices

#### Headers
```markdown
# H1 - Document Title (Only one per file)
## H2 - Major Section
### H3 - Subsection
#### H4 - Minor Point
```

#### Code Blocks
Always specify language:
```markdown
```typescript
const example = 'with syntax highlighting';
```
```

#### Links
Use relative links for internal docs:
```markdown
[Template System](./features/template-system/OVERVIEW.md)
[Daily Log](./daily-logs/2025-01/2025-01-13_planning.md)
```

#### File References
Include line numbers when possible:
```markdown
See [template.config.ts:45-67](../../config/templates/plumbing/template.config.ts#L45-L67)
```

#### Tables
Use for structured data:
```markdown
| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |
```

#### Lists
- Use `-` for unordered lists
- Use `1.` for ordered lists
- Indent with 2 spaces for nested lists

#### Emphasis
- **Bold** for important terms
- *Italic* for emphasis
- `code` for inline code
- > Quote for important notes

### Status Indicators

Use emojis for visual status:
- 🟢 **Green**: On track, healthy
- 🟡 **Yellow**: Needs attention, blocked
- 🔴 **Red**: Critical, urgent
- ✅ **Check**: Complete
- ⏳ **Hourglass**: In progress
- ❌ **X**: Failed, rejected
- 🚀 **Rocket**: Deployed, launched
- 🔧 **Wrench**: Under development
- 📝 **Memo**: Documentation needed

### Document Metadata

Every document should start with:
```markdown
# Document Title

**Last Updated**: YYYY-MM-DD
**Author**: Name
**Status**: Draft | Review | Approved | Deprecated
**Related Docs**: [Link1], [Link2]

---

## Overview
```

---

## 🔄 Maintenance

### Regular Reviews

#### Weekly
- Review daily logs
- Update feature documentation
- Check for outdated information

#### Monthly
- Archive old daily logs
- Update architecture diagrams
- Review and update guidelines

#### Quarterly
- Major documentation audit
- Reorganize if needed
- Update templates and standards

### Deprecation Process

When a document becomes outdated:

1. **Mark as deprecated** at the top:
```markdown
> ⚠️ **DEPRECATED**: This document is no longer maintained.
> See [new-doc.md](./new-doc.md) for current information.
```

2. **Move to archive**:
```bash
mv doc/old-doc.md doc/archive/YYYY-MM-DD_old-doc.md
```

3. **Update all links** to point to new document

---

## 📏 Quality Checklist

Before committing documentation:

### Content
- [ ] Title is clear and descriptive
- [ ] Purpose/overview is stated
- [ ] All sections are complete
- [ ] Examples are included where needed
- [ ] Code blocks have syntax highlighting
- [ ] Links are working
- [ ] File paths are correct

### Formatting
- [ ] Markdown is valid
- [ ] Headers follow hierarchy (H1 → H2 → H3)
- [ ] Code blocks are indented properly
- [ ] Tables are formatted
- [ ] Lists are consistent

### Metadata
- [ ] Last updated date is current
- [ ] Author is specified
- [ ] Status is accurate
- [ ] Related docs are linked

### Accessibility
- [ ] Alt text for images
- [ ] Descriptive link text (not "click here")
- [ ] Table headers are defined
- [ ] Abbreviations are explained

---

## 🛠️ Tools & Setup

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "yzhang.markdown-all-in-one",
    "DavidAnson.vscode-markdownlint",
    "bierner.markdown-preview-github-styles",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

### Linting Configuration

`.markdownlint.json`:
```json
{
  "default": true,
  "MD013": false,
  "MD033": false,
  "MD041": false
}
```

---

## 📞 Questions?

If you're unsure about documentation:
1. Check this guide first
2. Look at existing examples
3. Ask in #documentation Slack channel
4. Review with team lead

---

## 📚 Examples

See these documents for reference:
- [Daily Log Example](./02-development/daily-logs/2025-01/2025-01-13_template-system-planning.md)
- [ADR Example](./02-development/architecture/ADR-001-template-system.md)
- [Feature Doc Example](./02-development/features/template-system/IMPLEMENTATION.md)

---

**Last Updated**: January 13, 2025
**Maintained By**: Development Team
**Version**: 1.0.0
