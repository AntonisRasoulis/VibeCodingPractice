// Opens a page (index.html, or the bundled file), starts a race and checks it runs without errors.
//   node tools/smoke-test.mjs /absolute/path/to/index.html
// Prints {"errors":[],"running":true} when all is well.
const pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const b = await pw.chromium.launch(); const p = await b.newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto('file://' + process.argv[2]); await p.click('#start-button'); await p.waitForTimeout(4000);
console.log(JSON.stringify({ errors, running: await p.evaluate(() => Game.world.time > 0) }));
await b.close();
