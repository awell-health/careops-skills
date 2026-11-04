# CareOps skills

Agent skills for [Awell](https://awellhealth.com) CareOps customers, packaged as
Claude Code plugins.

This repository is the catalog, a Claude Code plugin marketplace. Each plugin's
files live in the plugin's own public repository, so every skill has one copy.

| Plugin | What it does | Source |
| --- | --- | --- |
| `bigquery-data` | Teaches Claude Awell's BigQuery data model, so it can answer questions about care flow data by writing SQL. | [awell-health/bigquery-agent-prompt](https://github.com/awell-health/bigquery-agent-prompt) |

---

## Install a plugin in Claude Code

In a Claude Code session, add this marketplace once, then install the plugin:

```text
/plugin marketplace add awell-health/careops-skills
/plugin install bigquery-data@careops-skills
```

The install command opens the plugin's details. Choose **Install for you** to
have it in every project, or one of the repository scopes to keep it to one
project. Claude then uses the skill whenever a question is about Awell's
BigQuery data, and `/bigquery-data:bigquery-agent-prompt` runs it by name.

From a terminal, without a session, the same two steps are:

```bash
claude plugin marketplace add awell-health/careops-skills
claude plugin install bigquery-data@careops-skills
```

### Get updates

Claude Code doesn't update plugins from this marketplace until auto-update is
on. Run `/plugin`, open **Marketplaces**, select `careops-skills` and choose
**Enable auto-update**. To update right away, choose **Update marketplace**
there instead.

### claude.ai, the Claude desktop app and other agents

The plugins are for Claude Code. To use a skill elsewhere, follow its own
repository's README. For the BigQuery skill, see
[Install it in Claude](https://github.com/awell-health/bigquery-agent-prompt#install-it-in-claude)
and [Analyze care flow data with an AI agent](https://docs.awellhealth.com/docs/data/analyze-data-with-an-ai-agent).

---

## Your data

The plugins hold instructions, never data. What an agent reads while it uses
them goes to that agent's model provider, under your organization's agreement
with that provider. Read
[Analyze care flow data with an AI agent](https://docs.awellhealth.com/docs/data/analyze-data-with-an-ai-agent)
before an agent reads patient data.

---

## Maintaining this catalog

This section is for Awell.

- **Add a plugin:** add an entry to
  [`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json) whose
  `source` points at the plugin's own public repository, add a row to the
  table above, and run `claude plugin validate .` before you open the pull
  request.
- **The public-safe check** runs on every pull request and every push to
  `main`
  ([`public-safe.yml`](./.github/workflows/public-safe.yml)). It fails when a
  file or its path names:
  - a host that isn't on the allowlist in
    [`scripts/check-public-safe.mjs`](./scripts/check-public-safe.mjs);
  - an `awell-` id other than the GitHub organization and the BigQuery
    projects customers query;
  - a BigQuery dataset other than the `example_clinic` placeholder;
  - a customer name from the `PUBLIC_SAFE_TERMS` repository secret, one name
    per line. The check never prints the names, and fails when the secret is
    missing, so a pull request from a fork fails it: push the branch to this
    repository instead.
- **The check covers this repository only.** A plugin's own repository needs
  its own review before it ships.
