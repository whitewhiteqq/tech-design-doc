---
name: tech-design-doc
license: Apache-2.0
metadata:
  author: whitewhiteqq
  version: "0.1.0"
description: This skill should be used when creating or rewriting technical design documents, architecture diagrams, cloud deployment diagrams (AWS, Azure, Google Cloud, with the official vendor icons), HTML visual design pages, or Confluence-ready Markdown documentation.
---

# Technical design document

Write a decision-led design doc fast. Markdown is the source of truth; HTML is an optional rendering.
`<skill>` below means this skill's folder.

## 1. Pick the output

If the request does not decide it, ask one multiple-choice question:
**Markdown** (Confluence, recommended) · **HTML** (standalone visual page) · **Both**.
Do not ask when the file type is given (rewrite a `.md` as Markdown).

## 2. Write the Markdown

1. Pick the skeleton in `reference/doc-skeletons.md` that matches the use case. Cut what the reader
   does not need. Lead with the decision, not the inventory.
2. For each diagram, pick the type in `reference/diagram-types.md`. One diagram answers one question.
3. Draw diagrams as Mermaid (`flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `erDiagram`),
   except the cloud deployment diagram, which uses section 3.
4. Put each image and `.drawio` file in an `img/` folder next to the doc.

## 3. Cloud deployment diagram: always the official icons

Never draw vendor icons by hand. Never use draw.io's built-in `mxgraph.aws4` stencils or plain
Mermaid boxes as the deployment diagram.

1. Find each icon key: `python <skill>/scripts/icons.py find <word> [--vendor aws|azure|gcp]`.
2. Write `img/deploy.spec.json`. The format and layout rules are in `reference/cloud-diagrams.md`;
   working specs for AWS, Azure, GCP and an AWS VPC are in `examples/deployment/`.
3. Run `python <skill>/scripts/cloud_diagram.py img/deploy.spec.json`. It writes `deploy.svg`,
   `deploy.png`, `deploy.drawio`, `deploy.md` (image, draw.io link, icon credit) and `deploy.mmd`
   (a Mermaid twin for diffs; keep it out of the doc).
4. Fix the spec until the run prints no `lint:` line. Then open the PNG once and look at it.
5. Paste the lines of `deploy.md` into the doc where the diagram goes. Its links already point
   into `img/`.

The icon packs are zips in `vendor-icons/`, read in place. The repository does not ship them: when
`icons.py` reports no pack, give the user the download table in `vendor-icons/README.md`. Their terms are in `vendor-icons/README.md`:
keep the product name near each mark, keep the credit line, and use a mark only for its own product.

## 4. HTML (only when asked)

Build in place. Never copy the kit into the project.

1. Copy `<skill>/kit/shells/starter.html` to `design.html` next to the doc. Replace every
   UPPERCASE placeholder from the Markdown.
2. For each non-deployment figure, run in the doc folder:
   `python <skill>/kit/build.py --new-figure NAME TEMPLATE`. Edit `figures/NAME.json`, and put
   `<svg id="fig-NAME"></svg>` in the shell. Templates: `system` (components and calls), `sequence`,
   `checks` (decision gate), `lineage` (data feeds). The header of `kit/figures/TEMPLATE.js` lists
   every field.
3. Put the deployment diagram in with `<!--@@INCLUDE img/deploy.svg@@-->` (section 3 made it).
4. Write `doc.json`: `{"pages": [{"shell": "design.html", "out": "design.built.html"}]}`.
5. Run `python <skill>/kit/build.py doc.json`. It fails with a message on any broken figure, id or
   link, then runs the diagram check of section 5 on the built page.

`examples/relay-design.html` shows a finished page. Do not read it into context; it is 245 KB.

## 5. Diagram check: mandatory before delivery

Never deliver a diagram with an overlap, a cramped label or a cut-off mark. The check renders each
diagram in Chrome and measures it, so it sees what the reader sees.

1. Run `python <skill>/scripts/check_diagrams.py <doc.md> --png _check` for Markdown (every Mermaid
   block and every linked `.svg`). For HTML, `build.py` runs it on the page by itself.
2. Fix every FAIL in its source (Mermaid block, `figures/NAME.json`, cloud spec), using the table in
   `reference/fixing-diagrams.md`. Never hand-edit a built page or a generated SVG.
3. Run the check again. Repeat until it prints `0 FAIL`.
4. Look at each diagram once: the PNGs in `_check/` (Markdown), or `node <skill>/kit/tools/shots.mjs
   page.html _check` (HTML). Fix any WARN the picture confirms. Then delete `_check/`.
5. In the reply, state the result: "N diagrams checked, 0 FAIL".

Mermaid syntax: quote a flowchart node label that holds punctuation (`A["Store (temp)"]`). Never
quote a `sequenceDiagram` message: Mermaid prints those quotes. Start every `sequenceDiagram`
with the halo line in `reference/fixing-diagrams.md`, and write a step inside one participant as
`Note over X: ...`. Run `kit/tools/pdf.py` only when the
user asks for a PDF.

## Titles and headings

- The doc title is the plain topic name: "Distributed transaction", "Order service deployment".
  Never a slogan or a claim ("One logical request, one business effect").
- Section headings name the topic too: "Decision", "Cloud deployment", "Failure handling".
- State the decision in the first sentence of the summary, not in a title or a heading.

## Rules for every diagram

- One question per diagram. Never mix time order (sequence) and placement (deployment).
- The main path runs left to right. Monitoring, schedules, DLQs and secrets sit on a second row.
- Number the main-path steps. Label an arrow only when the node names cannot explain it.
- Keep 4 to 12 boxes. Split a bigger picture by account, by flow, or by altitude.
- With Both outputs: write the Markdown first, and keep names, steps, states and failure paths
  identical in the HTML.
