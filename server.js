// Compatibility shim: some deploy environments were configured to run
// `node server.js` (the old Next standalone entrypoint, removed 2026-07-17).
// If a stale start command still points here, boot the real server instead
// of crashing. Migrations + account bootstrap run via src/instrumentation.ts
// inside the server, so no chaining is needed here.
const { spawn } = require("node:child_process");

console.log("[server.js shim] starting `next start`…");
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start"],
  { stdio: "inherit", env: process.env }
);
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
