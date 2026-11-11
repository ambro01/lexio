// Client-only guard: pdf.js must never reach the server (Worker) bundle. pdf.js detects Node through `process` and
// may take Node-only paths on workerd, and it would bloat the Worker. Run after `npm run build`:
// node scripts/check-client-only.mjs
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SERVER_DIR = path.resolve("dist/server");
const MARKERS = ["pdfjs-dist", "GlobalWorkerOptions", "pdf.worker"];
// Astro's build manifest in the server bundle names every client chunk: `"<module id>":"_astro/<file>"` pairs and
// `"/_astro/<file>"` asset paths. Those are file names of browser assets, not code, so they are ignored.
const CLIENT_ASSET_REFERENCES = [/"[^"\n]*":"_astro\/[^"\n]*"/g, /"\/?_astro\/[^"\n]*"/g];

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name));
}

let files;
try {
  files = await listFiles(SERVER_DIR);
} catch (error) {
  console.error(
    `Cannot read ${SERVER_DIR} (run npm run build first): ${error instanceof Error ? error.message : error}`,
  );
  process.exit(2);
}

const offending = [];
for (const file of files) {
  let content = await readFile(file, "utf8");
  for (const reference of CLIENT_ASSET_REFERENCES) {
    content = content.replace(reference, "");
  }
  const found = MARKERS.filter((marker) => content.includes(marker));
  if (found.length > 0) {
    offending.push(`${path.relative(process.cwd(), file)}  -> ${found.join(", ")}`);
  }
}

if (offending.length > 0) {
  console.error("FAIL  pdf.js code found in the server bundle:");
  for (const line of offending) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`PASS  no pdf.js code in ${files.length} server file(s)`);
