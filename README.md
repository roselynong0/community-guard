# "Community Guard" 

To push or commit a repository. Go to VSCode Source Control (the branch icon on the left sidebar).

Select all files you want to push on GitHub, by pushing the + button or simply click Stage All Changes.

Add a title/comment for your commit for what changes were added. Before you confirm the commit.

Then click 3 dots on to choose the options to pull/push your changes.

Click the sync icon (⭮) or use the menu:

Right-click branch name → Push

Or run Ctrl + Shift + P → type Git: Push

Go to your GitHub repo in the browser.

Check if your commit has been added.

Another quick option via Terminal use this following commands:

git add .

git commit -m "your commit message"

git push origin main
=======
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.