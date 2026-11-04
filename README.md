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
have the plugin in every project.

Claude then loads the skill on its own for a question about Awell's BigQuery
data. To run it by name, use `/bigquery-data:bigquery-agent-prompt`.

From a terminal, without a session, the same two steps are:

```bash
claude plugin marketplace add awell-health/careops-skills
claude plugin install bigquery-data@careops-skills
```

### Get updates

Claude Code leaves auto-update off for marketplaces other than Anthropic's. To
turn it on, run `/plugin`, open **Marketplaces**, select `careops-skills` and
choose **Enable auto-update**. To update by hand instead, choose **Update
marketplace** there, or run `/plugin marketplace update careops-skills`.

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
  `source` points at the plugin's own public repository, and a row to the table
  above. Run `claude plugin validate .` before you open the pull request.
- **The public-safe check**
  ([`public-safe.yml`](./.github/workflows/public-safe.yml)) runs on every pull
  request and every push to `main`. It fails when anything in the history, a
  commit message or the pull request names something internal or a customer.
  The rules and allowlists are at the top of
  [`scripts/check-public-safe.mjs`](./scripts/check-public-safe.mjs).
  - Customer names come from the `PUBLIC_SAFE_TERMS` repository secret: the
    names, one per line, as one line of base64. A plain list would let
    GitHub's log masking give names away. To update it:
    `base64 < names.txt | tr -d '\n' | gh secret set PUBLIC_SAFE_TERMS`.
  - The check never prints a name. It fails when the secret is missing, so a
    pull request from a fork fails it: push the branch to this repository
    instead.
  - To run it locally:
    `PUBLIC_SAFE_TERMS="$(base64 < names.txt | tr -d '\n')" node scripts/check-public-safe.mjs`.
- **The check covers this repository only.** A plugin's own repository needs
  its own review before it ships.
