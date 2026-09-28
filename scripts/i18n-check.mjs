// Fails when the translation catalogs are not what `pnpm i18n:extract` would
// write: text was added, changed or removed in the code without extracting.
// It extracts into a scratch copy (LINGUI_CATALOGS, read by lingui.config.ts)
// and compares, so the working tree is never touched. `pnpm i18n:check` then
// runs src/locales/catalogs.test.ts for missing or broken translations.

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const catalogs = join(root, 'src/locales')
const scratch = join(root, 'node_modules/.cache/i18n-check')
const lingui = join(root, 'node_modules/.bin/lingui')

const dirs = (root) =>
  readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

rmSync(scratch, { recursive: true, force: true })
mkdirSync(scratch, { recursive: true })
for (const locale of dirs(catalogs)) cpSync(join(catalogs, locale), join(scratch, locale), { recursive: true })

const run = spawnSync(lingui, ['extract', '--clean'], {
  cwd: root,
  env: { ...process.env, LINGUI_CATALOGS: scratch },
  encoding: 'utf8',
})
if (run.status !== 0) {
  process.stderr.write(run.stdout + run.stderr)
  process.exit(1)
}

// A locale in the config without a catalog yet shows up as a new directory.
const locales = [...new Set([...dirs(catalogs), ...dirs(scratch)])].sort()
const stale = locales.filter((locale) => {
  const file = (dir) => join(dir, locale, 'messages.po')
  if (!existsSync(file(scratch)) || !existsSync(file(catalogs))) return true
  return readFileSync(file(catalogs), 'utf8') !== readFileSync(file(scratch), 'utf8')
})
rmSync(scratch, { recursive: true, force: true })

if (stale.length > 0) {
  console.error(
    `The catalogs of ${stale.join(', ')} are out of date with the code. Run \`pnpm i18n:extract\`, ` +
      'translate what it adds in src/locales/es and src/locales/ca, and commit the catalogs with the change.'
  )
  process.exit(1)
}
console.log(`Catalogs up to date with the code (${locales.join(', ')}).`)
