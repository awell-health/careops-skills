// Pins what the public-safe check may print: the place (file and line, or commit message,
// or pull request field) and the kind of hit, never the matched text. Its log is public,
// and GitHub's masking can't be trusted for short or partial strings.
//
// Run: node --test scripts/check-public-safe.test.mjs
//
// The planted values are built from pieces, so this file itself passes the check.

import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-public-safe.mjs')

const CUSTOMER = 'Zephyr Orchard'
const HOST = 'intranet.example' + '.internal'
const URL = 'https:' + '//' + HOST + '/wiki'
const AWELL_ID = 'awel' + 'l-dev-tools'
const DATASET = 'secret_ds'
const DATASET_REF = '`awell-production' + '.' + DATASET + '`'

// Every planted value, and the pieces of the customer name: none may appear in the output.
const NEVER_PRINTED = ['zephyr', 'orchard', 'intranet', HOST, AWELL_ID, DATASET]

function encodeTerms(names) {
  return Buffer.from(names.join('\n')).toString('base64')
}

function makeRepo(files, message) {
  const dir = mkdtempSync(join(tmpdir(), 'public-safe-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir })
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
  execFileSync('git', ['add', '-A'], { cwd: dir })
  execFileSync(
    'git',
    ['-c', 'user.name=test', '-c', 'user.email=test@users.noreply.github.com', 'commit', '-q', '-m', message],
    { cwd: dir },
  )
  return dir
}

function runCheck(dir, env) {
  const result = spawnSync('node', [SCRIPT], {
    cwd: dir,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, ...env },
  })
  return { status: result.status, output: result.stdout + result.stderr }
}

function assertNothingPrinted(output) {
  const lower = output.toLowerCase()
  for (const value of NEVER_PRINTED) {
    assert.ok(!lower.includes(value.toLowerCase()), `the output printed a planted value: ${value.length} chars`)
  }
}

test('a hit prints its place and its kind, never the matched text', () => {
  const dir = makeRepo(
    {
      'notes.md': [`Ask ${CUSTOMER} first.`, `See ${URL}.`, `Use ${AWELL_ID}.`, `Query ${DATASET_REF}.`].join('\n'),
      'zephyr-orchard/readme.md': 'Nothing here.\n',
    },
    `Notes from ${CUSTOMER}`,
  )
  try {
    const { status, output } = runCheck(dir, {
      PUBLIC_SAFE_TERMS: encodeTerms([CUSTOMER]),
      PR_TITLE: `Add ${CUSTOMER}`,
      PR_BRANCH: 'zephyr-orchard-notes',
    })
    assert.equal(status, 1)
    assert.match(output, /notes\.md in commit [0-9a-f]{7}:1: a customer name from PUBLIC_SAFE_TERMS/)
    assert.match(output, /notes\.md in commit [0-9a-f]{7}:2: a host that is not on the allowlist/)
    assert.match(output, /notes\.md in commit [0-9a-f]{7}:3: an awell id that is not a project customers query/)
    assert.match(output, /notes\.md in commit [0-9a-f]{7}:4: a dataset other than the example_clinic placeholder/)
    assert.match(output, /a file path in commit [0-9a-f]{7}: a customer name from PUBLIC_SAFE_TERMS/)
    assert.match(output, /the message of commit [0-9a-f]{7}:1: a customer name from PUBLIC_SAFE_TERMS/)
    assert.match(output, /the pull request title:1: a customer name from PUBLIC_SAFE_TERMS/)
    assert.match(output, /the branch name:1: a customer name from PUBLIC_SAFE_TERMS/)
    assertNothingPrinted(output)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a clean run prints nothing derived from the names', () => {
  const dir = makeRepo({ 'README.md': 'Nothing to see.\n' }, 'Start')
  try {
    const { status, output } = runCheck(dir, { PUBLIC_SAFE_TERMS: encodeTerms([CUSTOMER]) })
    assert.equal(status, 0)
    assert.match(output, /nothing to remove/)
    assertNothingPrinted(output)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a missing or multi-line list fails without printing a name', () => {
  const dir = makeRepo({ 'README.md': 'Nothing to see.\n' }, 'Start')
  try {
    const missing = runCheck(dir, {})
    assert.equal(missing.status, 1)
    assert.match(missing.output, /PUBLIC_SAFE_TERMS is empty/)

    const multiLine = runCheck(dir, { PUBLIC_SAFE_TERMS: `${CUSTOMER}\nsecond name` })
    assert.equal(multiLine.status, 1)
    assert.match(multiLine.output, /must be one line of base64/)
    assertNothingPrinted(multiLine.output)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
