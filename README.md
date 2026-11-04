# Study Space

A web-based academic task manager: deadlines sorted by nearest first, alarm-style reminders, a plant that grows as you finish tasks, and class ranks. Retro pixel look.

Static site (HTML, CSS, JavaScript). No build step.

## Files
- `index.html` page shell
- `style.css` all styling
- `app.js` all app logic

## Run locally
Open `index.html` in a browser.

## Deploy
1. Push these files to a GitHub repository (files at the repo root).
2. In Vercel: Add New, Project, import the repository.
3. Framework Preset: Other. Leave Build Command and Output Directory empty. Deploy.

## Demo accounts
- Student: student@studyspace.demo / demo1234
- Instructor: instructor@studyspace.demo / demo1234

## Prototype limits
Data is stored in each browser (localStorage), Google sign-in is simulated, and attached files are recorded by name only. A real version needs a backend for accounts, shared data, file storage, and reminders.
