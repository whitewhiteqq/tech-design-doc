# Doc skeletons

**A design doc is an argument, not an inventory.** Order sections as the reader's questions arise. Each diagram answers a question the prior section raised; else it is too early.

**Diagram forms.** Context, container, component, flowchart, data flow, lineage, DAG, runbook: Mermaid `flowchart` (`subgraph` = boundary). Sequence: `sequenceDiagram`. ERD, star schema: `erDiagram`. Status: `stateDiagram-v2`. Deployment: `scripts/cloud_diagram.py`. Timeline/rollout: `flowchart LR` or a table. Matrix: Markdown table.

## Phase order

Skeletons are subsets of this order, never reshuffles.

Phase | Question | Diagrams
-|-|-
Why | problem, decision | prose
Who | users, neighbour systems | context
What | the parts, inside one part | container, component
How | flow, logic, data | sequence, flowchart, ERD
Where | infra, environments | deployment, timeline/rollout
What if | failure, rollout, rejects | runbook, prose

## Five ordering rules

1. **Widest first:** context, container, component.
2. **Structure before behaviour:** the reader already knows every lifeline.
3. **Decision before design:** choice and rejects come before any drawing.
4. **Deployment late:** "where" matters after "what".
5. **Max one diagram per section:** two means two topics; split it.

## Skeletons

Pick the nearest, then cut. **Bold** = the section the doc exists for.

### 1. New system design (6-12 pp, reviewers)

Section | Asks | Fig
-|-|-
1 Design in one page | whole argument, standalone
2 Problem, why now | what breaks if we wait
3 Who is involved | users, neighbour systems | context
4 Constraints | budget, latency, compliance, team
**5 Decision** | what we build, in 3 sentences
6 Alternatives rejected | the fact that killed each
7 The parts | deployables, stores | container
8 Inside the main part | modules, calls | component
9 Main flow | one request | sequence
10 Data model | entities, relations | ERD
11 Where it runs | services, cost | deployment
12 When it breaks | failures, who is paged | runbook
13 Rollout | phases, flags, no-return point
14 Open questions | owner, date

Works: a reviewer can stop after 5. Fails: 7-11 come before 5. Needs: flowchart, sequenceDiagram, erDiagram, cloud_diagram.py.

### 2. Feature / change (2-4 pp, the team)

Section | Asks | Fig
-|-|-
1 What changes | one paragraph
2 Today | the part you touch | component
**3 After** | same diagram, changes marked | component
4 New flow | only the path that differs | flowchart
5 Data changes | fields, backfill, old readers | lineage
6 Risk, rollback | how to undo, how fast
7 Tests | what proves it works

Works: 2 and 3 are one diagram, delta marked. Fails: "today" redrawn. Needs: flowchart.

### 3. Security / access control (10-20 pp, security + owner)

Section | Asks | Fig
-|-|-
1 Design in one page | for an owner who reads only this
2 Decision | where enforcement lives, not the UI
3 Who reads what | roles x fields | matrix
4 Which records | row scope | matrix
5 Business decisions | questions you cannot answer
6 Alternatives rejected | why each leaks
7 Exposed today | every field, every surface | lineage
**8 Enforcement in code** | the one place that decides | flowchart
9 Trust boundaries | what crosses, which way | data flow
10 Tests | a leak test, not a unit test
11 Request path | auth, token, redemption | sequence
12 Where it runs | gateway, compute, stores | deployment
13 Audit | a metadata-only line per request
14 Rollout | who first, how to revoke

Works: decide 1-6, build 7-10, ship 11-14. Fails: field matrix as prose. Needs: tables, flowchart, sequenceDiagram, cloud_diagram.py.

### 4. Migration / replatform (5-10 pp, risk owner)

Section | Asks | Fig
-|-|-
1 Why move | cost of staying, numbers
2 Today | system as it is | container
3 Target | same altitude and layout | container
4 Gap | per capability: keep, port, drop
**5 Cutover** | exact order of operations | sequence
6 Data migration | backfill, dual-write | DAG
7 Rollback | per step; last reversible step | flowchart
8 Environments | where you rehearse | timeline/rollout
9 Phases, dates | who, what, when

Works: today and target share a layout. Fails: rollback is one sentence. Needs: flowchart, sequenceDiagram, cloud_diagram.py.

### 5. Third-party integration (3-6 pp, vendor engineer)

Section | Asks | Fig
-|-|-
1 What we need from them | longest lead time, so first
2 Context | them as one external box | context
3 Contract | endpoints, payloads, limits
**4 Handshake** | auth and the first real call | sequence
5 Failure modes | 500, timeout, rate limit | flowchart
6 What crosses | which of our fields leave | data flow
7 Credentials | where, who rotates
8 Cost per call | and the runaway ceiling

Works: 1 is an ask, started day one. Fails: 6 is missing. Needs: flowchart, sequenceDiagram.

### 6. Data platform / pipeline (4-8 pp, consumers)

Section | Asks | Fig
-|-|-
1 Consumers | who uses the output, why
2 Sources | owner, freshness, volume, trust
3 Field origins | source to output, per field | lineage
**4 Model** | grain, facts, dimensions | star schema
5 Jobs | order, parallelism, schedule | DAG
6 Quality gates | what fails, what warns | flowchart
7 Where it runs | compute, cost per run | deployment
8 Backfill | how to fix a bad day

Works: output first, as consumers think. Fails: opens on the DAG. Needs: flowchart LR, erDiagram, cloud_diagram.py.

### 7. ADR (1 page, never longer)

Section | Asks | Fig
-|-|-
1 Title, status, date | proposed/accepted/superseded
2 Context | forces at the time
**3 Decision** | "We will ..." in one sentence
4 Consequences | good and bad
5 Alternatives | one line each, killing fact

Works: immutable; supersede, never edit. Fails: it grows a diagram (use 1). Needs: no diagram.

### 8. Handover / runbook (3-5 pp, on-call at 3 a.m.)

Section | Asks | Fig
-|-|-
1 What it does | 2 sentences, no jargon
2 What it looks like | one orienting picture | deployment
3 Normal | numbers that mean "fine"
**4 Alerts** | per alert: cause, check, fix | runbook
5 Deploy, roll back | copy-paste commands | flowchart
6 Access | what you need, who grants it
7 Escalation | by role, with a fallback

Works: a non-author can act on each section. Fails: it explains architecture. Needs: cloud_diagram.py, flowchart.

## What a reviewer reads (in order, <5 min)

1. Title: the plain topic name ("Distributed transaction", "RBAC design"). The decision goes in the summary, not the title.
2. Summary: written last, standalone.
3. First diagram: the widest one.
4. Decisions, alternatives: before the design.
5. Risks, open questions: none listed = you did not look.
6. The rest: for implementers, not approvers.

## Figure, table, or prose

- **Figure:** a shape (containment, calls, order).
- **Table:** rows checked one by one (roles, fields, endpoints, costs).
- **Prose:** a judgement (why, rejects, worries).
- **Nothing:** true of every system, or tool-generated.

## Failure modes

1. Opens on deployment: open on context instead.
2. Decision on page 7: earlier pages read as settled.
3. Reject without the killing fact: write "Redis adds a VPC; the Lambda has none".
4. Behaviour before structure: lifelines are unknown nouns.
5. Summary written first: it describes the intended doc.
