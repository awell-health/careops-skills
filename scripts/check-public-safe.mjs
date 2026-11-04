#!/usr/bin/env node
// Fails when a file in this repository names something that must not be public.
//
// Everything here is published to customers, so the check works from allowlists: a host,
// an awell- id or a BigQuery dataset is accepted only when it is listed below, and an
// internal one is never added. Customer names can't be allowlisted, and listing them here
// would publish them, so they come from the PUBLIC_SAFE_TERMS repository secret, one name
// per line. The check never prints a name from that list, and fails when the list is
// missing rather than skip it.
//
// Run it from the repository root: node scripts/check-public-safe.mjs

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Hosts a file may link to or name.
const ALLOWED_HOSTS = new Set([
  'awellhealth.com',
  'docs.awellhealth.com',
  'github.com',
  'code.claude.com',
])

// awell- ids a file may name: the GitHub organization, and the BigQuery projects
// customers query.
const ALLOWED_AWELL_IDS = new Set([
  'awell-health',
  'awell-sandbox',
  'awell-production',
  'awell-production-us',
  'awell-production-uk',
])

// Datasets a project.dataset reference may name. Real datasets belong to customers.
const ALLOWED_DATASETS = new Set(['example_clinic'])

// The authority of a URL: what follows the scheme, up to the path. hostOf() drops any
// user and port.
const URL_HOST = /\b[a-z][a-z0-9+.-]*:\/\/([^/\s"'`<>()[\]]+)/gi
// The domain of an email address.
const EMAIL_DOMAIN = /[a-z0-9._%+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi
// A host written without a scheme: a subdomain of Awell's domain, or an internal suffix.
const BARE_HOST = /\b(?:[a-z0-9-]+\.)+(?:awellhealth\.com|internal|local|svc|run\.app)\b/gi
const AWELL_ID = /\bawell-[a-z0-9-]*[a-z0-9]/gi
const PROJECT_DATASET = /\b(awell-[a-z0-9-]*[a-z0-9])\.([a-z0-9_]+)/gi

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

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readTerms() {
  const raw = process.env.PUBLIC_SAFE_TERMS || ''
  const terms = []
  for (const line of raw.split('\n')) {
    const term = line.trim().toLowerCase()
    if (term !== '') {
      terms.push(term)
    }
  }
  return terms
}

function termPattern(term) {
  // Whole words only, so a short name doesn't match inside a longer word.
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}($|[^a-z0-9])`, 'i')
}

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  const files = []
  for (const file of out.split('\0')) {
    if (file !== '') {
      files.push(file)
    }
  }
  return files
}

function checkLine(where, line, termPatterns, problems) {
  for (const match of line.matchAll(URL_HOST)) {
    const host = hostOf(match[1])
    if (!ALLOWED_HOSTS.has(host)) {
      problems.push(`${where}: host ${host} is not on the allowlist`)
    }
  }
  for (const match of line.matchAll(EMAIL_DOMAIN)) {
    const host = match[1].toLowerCase()
    if (!ALLOWED_HOSTS.has(host)) {
      problems.push(`${where}: email domain ${host} is not on the allowlist`)
    }
  }
  for (const match of line.matchAll(BARE_HOST)) {
    const host = match[0].toLowerCase()
    if (!ALLOWED_HOSTS.has(host)) {
      problems.push(`${where}: host ${host} is not on the allowlist`)
    }
  }
  for (const match of line.matchAll(AWELL_ID)) {
    const id = match[0].toLowerCase()
    if (!ALLOWED_AWELL_IDS.has(id)) {
      problems.push(`${where}: ${id} is not a customer-facing project id`)
    }
  }
  for (const match of line.matchAll(PROJECT_DATASET)) {
    const dataset = match[2].toLowerCase()
    if (!ALLOWED_DATASETS.has(dataset)) {
      problems.push(`${where}: dataset ${dataset} is not a placeholder; use example_clinic`)
    }
  }
  for (const pattern of termPatterns) {
    if (pattern.test(line)) {
      // Never print the term: the list is secret, and this log is public.
      problems.push(`${where}: names a customer from PUBLIC_SAFE_TERMS`)
    }
  }
}

function main() {
  const terms = readTerms()
  if (terms.length === 0) {
    console.error(
      'PUBLIC_SAFE_TERMS is empty. Set the repository secret, one customer name per line. ' +
        'A pull request from a fork cannot read it: push the branch to this repository instead.',
    )
    process.exit(1)
  }
  const termPatterns = []
  for (const term of terms) {
    termPatterns.push(termPattern(term))
  }

  const problems = []
  const files = trackedFiles()
  for (const file of files) {
    // A file's path is public too.
    checkLine(`${file} (its path)`, file, termPatterns, problems)

    const content = readFileSync(file)
    if (content.includes(0)) {
      problems.push(`${file}: binary file; this check reads text only, so keep binaries out`)
      continue
    }
    const lines = content.toString('utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      checkLine(`${file}:${i + 1}`, lines[i], termPatterns, problems)
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(problem)
    }
    console.error(`\n${problems.length} problem(s) in ${files.length} files.`)
    process.exit(1)
  }
  console.log(
    `${files.length} files checked against the allowlists and ${terms.length} customer names: nothing to remove.`,
  )
}

main()
