# references/ — the skill's evidence base

Every file here (except this one) carries `<!-- source: -->`, `<!-- fetched: -->` and
`<!-- capture: -->` headers, so any claim the skill makes can be traced back to a page,
a date, and the method used to capture it.

That provenance is the whole point. The skill's instructions forbid answering Loop API
questions from memory, so this directory is the only thing standing between a developer
and a confidently invented endpoint.

## Capture methods

| `capture` | Produced by | Trust |
| --- | --- | --- |
| `crawler` | `tools/ingest_docs.py` against the live portal | Mechanical copy of the published page. **Preferred.** |
| `manual-transcription` | Portal text supplied by a maintainer, transcribed by hand | Same content, not machine-verified. |

**The corpus currently committed here is `manual-transcription`** — the portal was
unreachable from the machine that built it, so the maintainer supplied the rendered
page text. Running the crawler replaces it with a `crawler` corpus.

`derived: true` marks the four files consolidated across several pages rather than
transcribed from one: `signing.md`, `conventions.md`, `doc-conflicts.md`,
`coverage.md`. Their `source:` headers point at the pages they were built from.

## Regenerate it

```bash
pip install -r tools/requirements.txt
./tools/setup.sh                               # picks the best available route
```

or drive the stages yourself:

```bash
python tools/ingest_docs.py                    # plain HTTP crawl
python tools/ingest_docs.py --render           # if the portal renders client-side
python tools/ingest_docs.py --openapi <url>    # best of all, if a spec exists
python tools/ingest_docs.py --input-dir <dir>  # from an existing wget mirror
```

Review the diff. A diff in this directory is a change in Loop's API surface, which is
exactly the kind of change worth reading carefully before committing.

## Editing rules

Content here must come from a published page you have actually read — see
[`CONTRIBUTING.md`](../../../CONTRIBUTING.md). If a page converts badly, fix the
converter in `tools/ingest_docs.py` so the fix survives the next refresh, rather than
patching the output.

Where the docs publish something checkable — test vectors, worked signatures —
recompute it and record that you did. The four HMAC vectors in `signing.md` were
verified this way.

`validate_skill.py` fails the build on any reference file missing its provenance
header.
