# JobGrinder

JobGrinder is a local, Mac-first job triage tool for people who track job leads in Airtable and want a faster way to decide which roles are worth applying to.

The current workflow is:

1. Open an Airtable grid view with Playwright.
2. Export the view to CSV.
3. Normalize the newest `X` jobs into a stable JSON shape.
4. Run a local Ollama model against each normalized job to decide whether to keep or drop it.
5. Generate a Markdown report listing the jobs worth applying to.

This project is intentionally built for a single user running locally on their own machine. There is no web app, no database, and no hosted backend.

## Summary

JobGrinder is useful if your current manual process looks like this:

- open a shared Airtable jobs board
- scan the newest rows
- open promising jobs one by one
- mentally filter them by pay, fit, qualifications, and company quality

Instead of doing that by hand each time, JobGrinder automates the repetitive part and gives you a smaller list to review.

At the moment, the pipeline is opinionated in a few important ways:

- Airtable export order is treated as newest-first
- only the top `JOBGRINDER_RECENT_JOB_LIMIT` rows are processed after normalization
- salary is still used as a deterministic signal
- company quality and qualification interpretation are delegated to Ollama
- the final output is a filter decision, not a ranking or recommendation score

If all 100 recent jobs look worth applying to, the tool can keep all 100. It is not designed to force a top 10.

## Tech Stack

- `Node.js 22+`
- `TypeScript`
- `Playwright` for browser automation and CSV download
- `csv-parse` for reading Airtable exports
- `zod` for runtime validation of config and data shapes
- `yaml` for loading the private profile file
- `Ollama` for local LLM-based filtering
- `Vitest` for tests
- `tsx` for local development runs without a separate build step

Why this stack:

- Playwright is the most practical way to automate Airtable’s export UI locally.
- TypeScript keeps the CSV normalization and runtime config strict.
- Ollama avoids API costs and keeps the filtering step local.
- Zod makes it easier to fail early when the environment or data shape changes.

## What The Tool Actually Does

There are four main stages.

### 1. Export

The `export` command opens the Airtable grid view in Chromium using a persistent Playwright browser profile. That lets you log in once and reuse the session on future runs.

JobGrinder looks for Airtable’s `...` menu, clicks `Download CSV`, and saves the export into `data/raw/`.

### 2. Normalize

The `normalize` command reads the latest CSV, keeps Airtable’s newest-first order, and writes only the first `JOBGRINDER_RECENT_JOB_LIMIT` jobs to JSON.

The normalized output preserves the exact Airtable columns:

- `Position Title`
- `Date`
- `Apply`
- `Work Model`
- `Location`
- `Company`
- `Salary`
- `Hire Time`
- `Graduate Time`
- `Company Industry`
- `Company Size`
- `Qualifications`

This is intentional. The normalized file is meant to be inspectable and easy to compare back to Airtable.

### 3. Filter With Ollama

The `score` command name is historical. It now performs filtering, not scoring.

For each normalized job, JobGrinder:

- applies a deterministic prefilter for explicit exclusions and compensation signals
- sends unresolved jobs to Ollama one at a time
- asks Ollama whether to keep or drop the job
- stores the result in `data/processed/*-filtered-jobs.json`

The model currently considers the candidate profile plus one job row at a time. It is especially used for:

- judging company quality when pay is weak or missing
- interpreting qualifications to determine whether a master’s student should still apply

### 4. Report

The `report` command renders a Markdown summary in `output/` that separates:

- jobs to apply to
- jobs filtered out

## Project Structure

```text
JobGrinder/
├── config/
│   ├── profile.example.yaml
│   └── profile.yaml                # local only, gitignored
├── data/
│   ├── raw/                        # exported Airtable CSVs
│   └── processed/                  # normalized and filtered JSON
├── output/                         # generated Markdown reports
├── playwright-downloads/           # temporary browser download staging
├── src/
│   ├── browser/                    # Airtable export automation
│   ├── cli/                        # command entrypoints and pipeline
│   ├── config/                     # env/profile loaders
│   ├── ingest/                     # CSV parsing and normalization
│   ├── reporting/                  # Markdown report generation
│   ├── scoring/                    # prefilter + Ollama filtering
│   ├── types/                      # zod schemas and shared types
│   └── utils/                      # logging, filesystem helpers, dates
├── tests/
├── .env.example
└── README.md
```

## Prerequisites

Before running JobGrinder, you need:

- macOS or another environment that can run Playwright + Chromium comfortably
- Node.js `22` or newer
- npm
- Ollama installed locally
- a model pulled into Ollama, such as `qwen2.5:7b`
- access to the Airtable board you want to export

## Setup

### 1. Clone And Install

```bash
git clone <your-repo-url>
cd JobGrinder
npm install
npx playwright install chromium
```

### 2. Start Ollama

In one terminal:

```bash
ollama serve
```

Pull the recommended model once:

```bash
ollama pull qwen2.5:7b
```

### 3. Create Local Config Files

Copy the environment and profile templates:

```bash
cp .env.example .env
cp config/profile.example.yaml config/profile.yaml
```

Important:

- `.env` is local-only and gitignored
- `config/profile.yaml` is local-only and gitignored
- `config/profile.example.yaml` is the shareable template

## Configuration

### Environment Variables

These live in `.env`.

| Variable | Purpose | Default |
| --- | --- | --- |
| `JOBGRINDER_AIRTABLE_URL` | Airtable grid view URL to export | required |
| `JOBGRINDER_OLLAMA_BASE_URL` | Local Ollama server URL | `http://127.0.0.1:11434` |
| `JOBGRINDER_OLLAMA_MODEL` | Ollama model name | `qwen2.5:7b` |
| `JOBGRINDER_OLLAMA_TIMEOUT_MS` | Timeout for each Ollama request | `60000` |
| `JOBGRINDER_RECENT_JOB_LIMIT` | Number of newest jobs to keep after normalization | `50` |
| `JOBGRINDER_DOWNLOAD_DIR` | Temporary Playwright download folder | `./playwright-downloads` |
| `JOBGRINDER_PLAYWRIGHT_PROFILE` | Persistent browser profile directory | `./.playwright-profile` |
| `JOBGRINDER_HEADLESS` | Run browser headless when `true` | `false` |
| `JOBGRINDER_OUTPUT_DIR` | Report output folder | `./output` |
| `JOBGRINDER_LOG_LEVEL` | Log verbosity | `info` |

### Profile File

The private profile lives at `config/profile.yaml`.

This file describes who the candidate is and how the filter should think about fit. It includes:

- summary/background
- preferred titles
- include/exclude keywords
- preferred locations
- compensation thresholds
- employment preferences
- weighting hints

Even though the filtering is now more LLM-driven, the profile still matters because it provides the model with the candidate context.

## How To Run

### First-Time Flow

Use this the first time you run the project on a machine:

```bash
npm run dev -- export
```

That will:

- launch Chromium
- open Airtable
- let you log in if needed
- click Airtable’s export flow
- save the CSV into `data/raw/`

Then continue with:

```bash
npm run dev -- normalize
npm run dev -- score
npm run dev -- report
```

### Daily Flow

Once your Airtable login session is already saved in `.playwright-profile/`, the normal workflow is:

```bash
npm run dev -- run
```

That command runs the full pipeline:

1. export
2. normalize
3. filter with Ollama
4. generate report

### Individual Commands

#### Export only

```bash
npm run dev -- export
```

Downloads a fresh Airtable CSV into `data/raw/`.

#### Normalize only

```bash
npm run dev -- normalize
```

Reads the latest raw CSV, normalizes it, truncates to `JOBGRINDER_RECENT_JOB_LIMIT`, and writes:

- `data/processed/YYYY-MM-DD-normalized-jobs.json`

You can also pass a specific CSV path:

```bash
npm run dev -- normalize /absolute/path/to/file.csv
```

#### Filter only

```bash
npm run dev -- score
```

Despite the name, this now performs keep/drop filtering. It reads the latest normalized file and writes:

- `data/processed/YYYY-MM-DD-filtered-jobs.json`

You can also point it at a specific normalized file:

```bash
npm run dev -- score /absolute/path/to/normalized-jobs.json
```

#### Report only

```bash
npm run dev -- report
```

Reads the latest filtered JSON and writes a Markdown report to `output/`.

## Pipeline Details

### Data Flow

```text
Airtable grid view
  -> Playwright export
  -> data/raw/*.csv
  -> CSV parse
  -> normalize exact Airtable columns
  -> keep top N newest jobs
  -> data/processed/*-normalized-jobs.json
  -> deterministic prefilter + Ollama keep/drop
  -> data/processed/*-filtered-jobs.json
  -> Markdown report
  -> output/*-report.md
```

### What Gets Sent To Ollama

Ollama receives:

- the private candidate profile from `config/profile.yaml`
- one normalized Airtable job at a time

Ollama does not currently receive the entire batch of jobs at once.

That means the model is making a keep/drop decision per job, not comparing all jobs against each other.

### Deterministic vs Model-Based Filtering

The current filtering logic is intentionally mixed:

- deterministic checks are used where strict behavior is useful
- Ollama is used where interpretation is more useful than hardcoded rules

In practice, that means:

- salary/compensation can still influence decisions before the model step
- company quality and qualifications are primarily judged by Ollama
- the final result is a filtered list, not a ranked shortlist

## Output Files

### Raw CSV

Saved to:

```text
data/raw/
```

Example:

```text
data/raw/2026-03-27T07-01-02-123Z-airtable-export.csv
```

### Normalized Jobs

Saved to:

```text
data/processed/YYYY-MM-DD-normalized-jobs.json
```

### Filtered Jobs

Saved to:

```text
data/processed/YYYY-MM-DD-filtered-jobs.json
```

Each filtered record includes the original normalized Airtable row plus:

- `keep`
- `rationale`
- `redFlags`
- `deterministicDecision`
- `deterministicReasons`
- `provider`

### Markdown Report

Saved to:

```text
output/YYYY-MM-DD-report.md
```

## Testing And Validation

Run the full validation suite with:

```bash
npm run test
npm run typecheck
npm run build
```

These cover:

- normalization behavior
- prefilter behavior
- Ollama response parsing
- report generation
- score/filter pipeline behavior

## Privacy And Git Safety

This repo is set up so local private artifacts are not committed.

Gitignored local-only files include:

- `.env`
- `config/profile.yaml`
- `.playwright-profile/`
- `playwright-downloads/`
- `data/raw/` contents
- `data/processed/` contents
- `output/` contents

This matters because the browser profile may contain session data, and the exported Airtable files may contain private job-search material.

## Adapting This Project For Another Airtable Board

If someone else wants to copy this project, the most likely customization points are:

### 1. Airtable URL

Set a different `JOBGRINDER_AIRTABLE_URL` in `.env`.

### 2. Candidate Profile

Replace `config/profile.yaml` with their own background, compensation thresholds, preferences, and weighting hints.

### 3. Airtable Column Mapping

If their Airtable export uses different column names, update:

- [normalizeJobs.ts](/Users/edwardsung/Desktop/repo/JobGrinder/src/ingest/normalizeJobs.ts)
- [job.ts](/Users/edwardsung/Desktop/repo/JobGrinder/src/types/job.ts)

This project currently assumes the Airtable export contains exactly:

- `Position Title`
- `Date`
- `Apply`
- `Work Model`
- `Location`
- `Company`
- `Salary`
- `Hire Time`
- `Graduate Time`
- `Company Industry`
- `Company Size`
- `Qualifications`

### 4. Ollama Model

If `qwen2.5:7b` is too slow or too weak, switch `JOBGRINDER_OLLAMA_MODEL` to another local model.

## Known Limitations

- Airtable UI selectors can drift and break the export step.
- The `score` command is named historically and actually performs filtering.
- Ollama quality depends heavily on the chosen model.
- The project assumes Airtable exports are already sorted newest-first.
- The current normalization shape is tightly coupled to one Airtable schema.
- There is no scheduling yet; runs are manual unless you add your own macOS automation.

## Troubleshooting

### Export opens Airtable but does not download

Try:

```bash
JOBGRINDER_LOG_LEVEL=debug npm run dev -- export
```

Also make sure:

- the Airtable view is visible
- the `...` menu still exposes `Download CSV`
- your saved browser session is still logged in

### Ollama requests fail

Make sure Ollama is running:

```bash
ollama serve
```

Check that the configured model exists:

```bash
ollama list
```

If needed, pull the model:

```bash
ollama pull qwen2.5:7b
```

### Nothing gets kept

Check:

- your `config/profile.yaml`
- your compensation thresholds
- the normalized JSON in `data/processed/`
- the filtered JSON rationales and red flags

It is often easier to debug by running the pipeline step by step instead of using `run`.

## Future Improvements

- rename `score` to `filter`
- add a launchd automation for daily runs
- make the report easier to skim on mobile
- support batch prompting strategies for Ollama
- support alternate Airtable schemas without code changes
- add stronger audit logging for why each job was kept or dropped

## License / Intended Use

This repo is currently structured as a personal local automation project. If you copy it, treat it as a starting point rather than a polished general-purpose product.
