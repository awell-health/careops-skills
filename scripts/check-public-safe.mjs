#!/usr/bin/env node
// Fails when this repository names something that must not be public.
//
// It reads every file in every commit of HEAD's history, each file path, each commit
// message, and, in a pull request, its title, description and branch name. A leak that
// one commit adds and the next removes is still public in the history.
//
// Everything here is published to customers, so the check works from allowlists: a host,
// a GitHub repository, an awell id or a BigQuery dataset passes only when it is listed
// below, and an internal one is never added. Customer names can't be allowlisted, and
// listing them here would publish them, so they come from the PUBLIC_SAFE_TERMS
// repository secret: the list, one name per line, encoded as a single line of base64.
// The encoding matters: GitHub masks each line of a secret wherever it appears in the
// log, so with a plain list a customer called "Ann" would turn "Announcement" into
// "***ouncement" and give the name away. Names match case-insensitively, without accents, and with or without the spaces,
// hyphens and underscores between their words.
//
// A problem is reported by where it is and which rule it breaks, never by the value: the
// log of a public repository is public too. The check fails when the list is missing,
// rather than skip it.
//
// Run it from the repository root, with full history:
//   PUBLIC_SAFE_TERMS="$(base64 < names.txt | tr -d '\n')" node scripts/check-public-safe.mjs

import { execFileSync } from 'node:child_process'

// Hosts a file, commit message or pull request may link to or name. anthropic.com,
// claude.com and GitHub's noreply domain appear in commit trailers and PR footers.
const ALLOWED_HOSTS = new Set([
  'awellhealth.com',
  'docs.awellhealth.com',
  'github.com',
  'code.claude.com',
  'claude.com',
  'anthropic.com',
  'users.noreply.github.com',
])

// Public repositories under github.com/awell-health that a file may name.
const ALLOWED_GITHUB_REPOS = new Set(['careops-skills', 'bigquery-agent-prompt'])

// awell ids a file may name: the GitHub organization, and the BigQuery projects
// customers query.
const ALLOWED_AWELL_IDS = new Set([
  'awell-health',
  'awell-sandbox',
  'awell-production',
  'awell-production-us',
  'awell-production-uk',
])

// Datasets a file may name. Real datasets belong to customers.
const ALLOWED_DATASETS = new Set(['example_clinic'])

// The authority of a URL: what follows the scheme, up to the path.
const URL_HOST = /\b[a-z][a-z0-9+.-]*:\/\/([^/\s"'`<>()[\]]+)/gi
const EMAIL_DOMAIN = /[a-z0-9._%+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi
// A host written without a scheme, on one of Awell's domains or an internal suffix.
const BARE_HOST =
  /\b(?:[a-z0-9-]+\.)+(?:awellhealth\.com|awell\.health|myawell\.health|awell\.care|svc|run\.app)\b/gi
const GITHUB_REPO = /\bawell-health\/([a-z0-9._-]+)/gi
// An id that starts with awell, then a hyphen, such as awell-production.
const AWELL_ID = /\bawell[a-z0-9]*-[a-z0-9-]*[a-z0-9]/gi
// project.dataset, `project`.`dataset` or project:dataset.
const PROJECT_DATASET = /\b(awell[a-z0-9]*-[a-z0-9-]*[a-z0-9])[`'"]?[.:][`'"]?([a-z0-9_]+)/gi
const DATASETS_PATH = /\bdatasets\/([a-z0-9_]+)/gi

const WORD_SEPARATORS = '[\\s_.-]*'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
}

function normalize(text) {
  // Drop accents, so a name written with or without them matches.
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readTermPatterns() {
  const encoded = (process.env.PUBLIC_SAFE_TERMS || '').trim()
  if (encoded.includes('\n')) {
    console.error('PUBLIC_SAFE_TERMS must be one line of base64, or GitHub masks each name in the log.')
    process.exit(1)
  }
  const raw = Buffer.from(encoded, 'base64').toString('utf8')
  const patterns = []
  for (const line of raw.split('\n')) {
    const words = []
    for (const word of normalize(line).split(/[\s_.-]+/)) {
      if (word !== '') {
        words.push(escapeRegExp(word))
      }
    }
    if (words.length > 0) {
      // Whole words only, so a short name doesn't match inside a longer word.
      patterns.push(new RegExp(`(^|[^a-z0-9])${words.join(WORD_SEPARATORS)}($|[^a-z0-9])`))
    }
  }
  return patterns
}

function hostOf(authority) {
  let host = authority.toLowerCase()
  const at = host.lastIndexOf('@')
  if (at !== -1) {
    host = host.slice(at + 1)
  }
  const colon = host.indexOf(':')
  if (colon !== -1) {
    host = host.slice(0, colon)
  }
  return host
}

function repoName(raw) {
  let name = raw.toLowerCase()
  while (name.endsWith('.')) {
    name = name.slice(0, -1)
  }
  if (name.endsWith('.git')) {
    name = name.slice(0, -4)
  }
  return name
}

function checkLine(where, line, termPatterns, report) {
  for (const match of line.matchAll(URL_HOST)) {
    if (!ALLOWED_HOSTS.has(hostOf(match[1]))) {
      report(where, 'a host that is not on the allowlist')
    }
  }
  for (const match of line.matchAll(EMAIL_DOMAIN)) {
    if (!ALLOWED_HOSTS.has(match[1].toLowerCase())) {
      report(where, 'an email domain that is not on the allowlist')
    }
  }
  for (const match of line.matchAll(BARE_HOST)) {
    if (!ALLOWED_HOSTS.has(match[0].toLowerCase())) {
      report(where, 'a host that is not on the allowlist')
    }
  }
  for (const match of line.matchAll(GITHUB_REPO)) {
    if (!ALLOWED_GITHUB_REPOS.has(repoName(match[1]))) {
      report(where, 'an awell-health repository that is not on the allowlist')
    }
  }
  for (const match of line.matchAll(AWELL_ID)) {
    if (!ALLOWED_AWELL_IDS.has(match[0].toLowerCase())) {
      report(where, 'an awell id that is not a project customers query')
    }
  }
  for (const match of line.matchAll(PROJECT_DATASET)) {
    if (!ALLOWED_DATASETS.has(match[2].toLowerCase())) {
      report(where, 'a dataset other than the example_clinic placeholder')
    }
  }
  for (const match of line.matchAll(DATASETS_PATH)) {
    if (!ALLOWED_DATASETS.has(match[1].toLowerCase())) {
      report(where, 'a dataset other than the example_clinic placeholder')
    }
  }
  const normalized = normalize(line)
  for (const pattern of termPatterns) {
    if (pattern.test(normalized)) {
      report(where, 'a customer name from PUBLIC_SAFE_TERMS')
    }
  }
}

function checkText(where, text, termPatterns, report) {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    checkLine(`${where}:${i + 1}`, lines[i], termPatterns, report)
  }
  // A name wrapped across a line break: test the whole text, with lines joined.
  const joined = normalize(text).replace(/\s+/g, ' ')
  for (const pattern of termPatterns) {
    if (pattern.test(joined)) {
      let onOneLine = false
      for (const line of lines) {
        if (pattern.test(normalize(line))) {
          onOneLine = true
        }
      }
      if (!onOneLine) {
        report(where, 'a customer name from PUBLIC_SAFE_TERMS, across a line break')
      }
    }
  }
}

function main() {
  const termPatterns = readTermPatterns()
  if (termPatterns.length === 0) {
    console.error(
      'PUBLIC_SAFE_TERMS is empty. Set the repository secret to the customer names, one per line, ' +
        "as one line of base64: base64 < names.txt | tr -d '\\n' | gh secret set PUBLIC_SAFE_TERMS. " +
        'A pull request from a fork cannot read it: push the branch to this repository instead.',
    )
    process.exit(1)
  }
  if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') {
    console.error('The clone is shallow, so older commits would go unchecked. Check out with fetch-depth: 0.')
    process.exit(1)
  }

  const problems = new Set()
  function report(where, what) {
    problems.add(`${where}: ${what}`)
  }

  // In a pull request, its own text is public too.
  const pullRequestText = [
    ['the pull request title', process.env.PR_TITLE],
    ['the pull request description', process.env.PR_BODY],
    ['the branch name', process.env.PR_BRANCH],
  ]
  for (const [where, text] of pullRequestText) {
    if (text) {
      checkText(where, text, termPatterns, report)
    }
  }

  const commits = []
  for (const sha of git(['rev-list', 'HEAD']).split('\n')) {
    if (sha !== '') {
      commits.push(sha)
    }
  }
  const seenBlobs = new Set()
  const seenPaths = new Set()
  for (const sha of commits) {
    const short = sha.slice(0, 7)
    checkText(`the message of commit ${short}`, git(['log', '-1', '--format=%B', sha]), termPatterns, report)

    for (const entry of git(['ls-tree', '-r', '-z', sha]).split('\0')) {
      // "<mode> <type> <object>\t<path>"
      const tab = entry.indexOf('\t')
      if (tab === -1) {
        continue
      }
      const parts = entry.slice(0, tab).split(' ')
      const type = parts[1]
      const object = parts[2]
      const path = entry.slice(tab + 1)
      if (type !== 'blob') {
        continue
      }
      if (!seenPaths.has(path)) {
        seenPaths.add(path)
        // Reported without the path itself, since the path may hold the name.
        checkLine(`a file path in commit ${short}`, path, termPatterns, report)
      }
      let label = `${path} in commit ${short}`
      for (const pattern of termPatterns) {
        if (pattern.test(normalize(path))) {
          label = `a file in commit ${short}`
        }
      }
      if (seenBlobs.has(object)) {
        continue
      }
      seenBlobs.add(object)
      const content = execFileSync('git', ['cat-file', 'blob', object], { maxBuffer: 256 * 1024 * 1024 })
      if (content.includes(0)) {
        report(`a file in commit ${short}`, 'a binary file, which this check cannot read; keep binaries out')
        continue
      }
      checkText(label, content.toString('utf8'), termPatterns, report)
    }
  }

  if (problems.size > 0) {
    for (const problem of problems) {
      console.error(problem)
    }
    console.error(`\n${problems.size} problem(s). Open each place to see the value: the check never prints it.`)
    process.exit(1)
  }
  let checked = `${commits.length} commits and ${seenBlobs.size} file versions`
  if (process.env.PR_TITLE) {
    checked += ', and the pull request'
  }
  console.log(`${checked}: nothing to remove.`)
}

main()
