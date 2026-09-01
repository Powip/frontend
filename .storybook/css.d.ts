// Next.js's own files get this for free from Next's bundled ambient types,
// but .storybook/preview.tsx isn't necessarily covered by that. Without
// this, TS reports "Cannot find module or type declarations for
// side-effect import" on `import "../src/styles/globals.css"` even though
// the file genuinely exists at that path - it's a type-checking gap, not
// a wrong path.
declare module "*.css";
