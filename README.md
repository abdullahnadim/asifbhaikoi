# Asif Bhai Koi?

A tiny, full-page office joke: **“Asif bhai ekhon kothay?”**

Choose **Canteen e ghumay** to reveal the answer. **Desk e kaj kore** gently dodges the cursor in small, smooth steps across the page. The layout has only the question, answers, and **Made by [Mir](https://abdullahnadim.vercel.app)** credit.

The question is fixed for public visitors. There is no customization panel, database, account system, or environment setup.

## Run locally

Requires Node.js 20.9 or later.

```sh
npm ci
npm run dev
```

Open [http://localhost:3002](http://localhost:3002).

## Check and build

```sh
npm test
npm run build
npm start
```

The production server also uses port 3002. `npm run typecheck` runs TypeScript validation separately.

## Deploy

Import this repository into Vercel and use the **Next.js** preset. The root directory is the repository root (`.`), the install command is `npm ci`, and the build command is `npm run build`. No environment variables are needed.

## Accessibility

Both answers support Tab, Enter, and Space. Keyboard users can select the escaping answer too. The button stays within the visible page and avoids the question, other answer, and credit. Reduced-motion preferences disable the movement animation, while the challenge remains functional.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, Lucide icons, and lightweight CSS transitions.
