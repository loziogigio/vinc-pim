# Reference Section

## Purpose

Quick reference materials, cheat sheets, templates, and glossary for fast lookup during development.

---

## 📚 Available References

### 🎯 Quick References
- **CHEATSHEET.md** - Common commands, shortcuts, code snippets
- **GLOSSARY.md** - Project terminology and definitions
- **TEMPLATES.md** - Document templates for copy-paste
- **LINKS.md** - Important links and resources
- **CDN_SETUP.md** - Configure CDN uploads and environment variables

---

## 📖 Contents

### CHEATSHEET.md
Fast lookup for:
- Development commands
- Git workflows
- Database queries
- API endpoints
- Component props
- Common patterns

**Use when**: You need to quickly remember syntax or commands

---

### GLOSSARY.md
Definitions of:
- Project-specific terms
- Technical concepts
- Acronyms (ADR, SSR, ISR, etc.)
- Domain terminology

**Use when**: You encounter an unfamiliar term

---

### TEMPLATES.md
Copy-paste templates for:
- Daily logs
- Architecture Decision Records
- Feature documentation
- API documentation
- Component documentation
- Troubleshooting guides

**Use when**: Creating new documentation

---

### LINKS.md
Quick access to:
- Production URLs
- Staging environments
- MongoDB Atlas dashboard
- CI/CD pipelines
- Design files
- External documentation

**Use when**: You need to find a URL quickly

---

## 🚀 Quick Access

### Most Used

```bash
# View cheatsheet
cat doc/03-reference/CHEATSHEET.md

# Copy daily log template
cp doc/02-development/daily-logs/TEMPLATE.md \
   doc/02-development/daily-logs/$(date +%Y-%m)/$(date +%Y-%m-%d)_topic.md

# Search glossary
grep -i "term" doc/03-reference/GLOSSARY.md
```

---

## ✨ How to Use

### For New Team Members
1. Read GLOSSARY.md first
2. Bookmark LINKS.md
3. Use TEMPLATES.md for all docs
4. Reference CHEATSHEET.md daily

### For Daily Work
- Keep CHEATSHEET.md open
- Search GLOSSARY.md for unfamiliar terms
- Copy from TEMPLATES.md when creating docs

### For Documentation
- Always use TEMPLATES.md
- Add to GLOSSARY.md when introducing new terms
- Update CHEATSHEET.md when you find useful patterns

---

## 🔄 Maintenance

### Weekly
- [ ] Update CHEATSHEET.md with new commands
- [ ] Add new terms to GLOSSARY.md
- [ ] Verify LINKS.md URLs work

### Monthly
- [ ] Review and organize CHEATSHEET.md
- [ ] Alphabetize GLOSSARY.md
- [ ] Remove dead links from LINKS.md
- [ ] Update TEMPLATES.md if formats change

---

## 📊 Reference Status

| Document | Status | Last Updated | Completeness |
|----------|--------|--------------|--------------|
| CHEATSHEET.md | 📝 To Create | - | 0% |
| GLOSSARY.md | 📝 To Create | - | 0% |
| TEMPLATES.md | 📝 To Create | - | 0% |
| LINKS.md | 📝 To Create | - | 0% |

---

## 💡 Tips

### Building a Good Cheatsheet
- Group by category
- Include examples
- Show both simple and complex cases
- Add comments explaining parameters

### Building a Good Glossary
- Define in simple terms first
- Add technical details after
- Include examples of usage
- Cross-reference related terms

### Maintaining Templates
- Version your templates
- Note what sections are required vs optional
- Provide examples in comments
- Keep them up to date with standards

---

**Last Updated**: January 13, 2025
**Maintained By**: Development Team
