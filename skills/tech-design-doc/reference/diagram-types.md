# Diagram types

Pick the diagram from the question. Write the question in one sentence first.
If the sentence needs "and", draw two diagrams.

## Pick by the question

| The question | Draw |
|---|---|
| Who **uses** it, and what else does it **talk to**? | Context |
| What are the **deployable parts** and stores? | Container |
| Which **modules** live inside one deployable? | Component |
| Which layer may **import** which? | Layered |
| Where does it **run**, in which account or region? | Deployment (cloud) |
| What can **reach** what: subnet, route, rule? | Network / boundary |
| In what **order** do messages go? | Sequence |
| What does the code **check**, and where does it **branch**? | Flowchart / decision |
| What **states** can one thing be in? | State |
| **Who** does which step, and where is the handover? | Swimlane |
| Which **source feeds** which output? What crosses a trust boundary? | Data flow / lineage |
| How do the **tables relate**? | ER / data model |
| Who **publishes**, who **subscribes**? | Event flow |
| What **ships when**, and in which environment? | Timeline / rollout |

Every Markdown diagram is Mermaid, except deployment and network diagrams.
Those come from `python <skill>/scripts/cloud_diagram.py spec.json`. It writes .svg,
.png, .drawio and .md with the official vendor icons. Use
`python <skill>/scripts/icons.py find <word>` to find an icon key.

An HTML figure is `figures/NAME.json` = `{"template": "<template>", "data": {...}}`.
Kit templates: `system`, `sequence`, `checks`, `lineage`, `mapping`,
`matrix`, `stack`, `silhouettes`.

## Cards

### Context (C4 level 1)
- **Answers:** who uses the system, and which external systems it talks to.
- **Box:** the whole system, a person role, or an external system. **Arrow:** "uses" or "sends X to".
- **Include:** your system as ONE box, every human role, every external system. 3 to 7 boxes around it.
- **Leave out:** everything inside your system. **Wrong when:** the reader already knows what the system does.
- **Markdown:** `flowchart LR`. **HTML:** `system` with `hero: true`, no step numbers.

### Container (C4 level 2)
- **Answers:** which parts deploy separately, and which stores they use.
- **Box:** a deployable unit or a store, technology in small type. **Arrow:** a call, with protocol.
- **Include:** every deployable, every store. 4 to 10 boxes.
- **Leave out:** modules and classes. **Wrong when:** the question is how the code is organised.
- **Markdown:** `flowchart LR` with one `subgraph` per boundary. **HTML:** `system`.

### Component (C4 level 3)
- **Answers:** which modules live inside ONE deployable.
- **Box:** a module. **Arrow:** a call between modules.
- **Include:** the modules of one deployable, plus the 1 or 2 external things they reach.
- **Leave out:** other deployables' internals. **Wrong when:** more than ~12 modules, or the code changes weekly.
- **Markdown:** `flowchart LR`. **HTML:** `system`, one zone for the deployable.

### Layered
- **Answers:** which layer may import which.
- **Band:** a layer; order is the content. **Arrow:** the one legal dependency direction.
- **Include:** every layer in order, the rule, the named exceptions.
- **Leave out:** individual calls. **Wrong when:** the layering is a wish, not the code.
- **Markdown:** `flowchart TB`. **HTML:** `stack`.

### Deployment (cloud)
- **Answers:** which managed services run, in which account, region, or VPC.
- **Box:** one service, in the vendor's official icon. **Arrow:** a call across infrastructure.
- **Include:** every billed service, account/region/VPC boundaries, what crosses each boundary.
- **Leave out:** IAM, CloudFormation, and other services that sit on every diagram. Put monitoring and DLQs on a side rail.
- **Wrong when:** the point is a rule inside one service. An icon cannot show it; use a flowchart.
- **Markdown:** `scripts/cloud_diagram.py`. **HTML:** INCLUDE the `.svg` from `scripts/cloud_diagram.py`.

### Network / boundary
- **Answers:** what can reach what: subnets, routes, firewall rules, egress.
- **Box:** a subnet, gateway, endpoint, or host. **Line:** a route, or a rule that allows or blocks it.
- **Include:** CIDRs, public vs private, every allow/deny rule, the egress path.
- **Leave out:** applications. **Wrong when:** the system is serverless with no VPC.
- **Markdown:** `scripts/cloud_diagram.py` (VPC and subnet groups). **HTML:** INCLUDE the `.svg` from `scripts/cloud_diagram.py`.

### Sequence
- **Answers:** in what order the messages go, and what comes back.
- **Box:** a participant across the top. **Arrow:** one message; a reply is dashed. Time runs down.
- **Include:** every sender and receiver, one row per message, the condition on each branch (`alt`).
- **Leave out:** structure. Stop at ~12 messages. **Wrong when:** the reader needs to know what the system is.
- **Markdown:** `sequenceDiagram`. **HTML:** `sequence`.

### Flowchart / decision
- **Answers:** what the code checks, and where it branches.
- **Box:** a step. **Diamond:** a decision, every exit labelled. **Arrow:** "next".
- **Include:** every branch that changes the outcome, named end states (`200`, `404`).
- **Leave out:** owners (use a swimlane). **Wrong when:** nothing branches. Write a list.
- **Markdown:** `flowchart TD`. **HTML:** `checks`.

### State
- **Answers:** which states one thing can be in, and what moves it.
- **Box:** a state; mark final states. **Arrow:** a transition, labelled `event [guard]`.
- **Include:** every state, the start state, the final states, every guard.
- **Leave out:** implementation; a state is an observable fact. **Wrong when:** the thing has 2 states. Write a sentence.
- **Markdown:** `stateDiagram-v2`. **HTML:** not in kit: use a transition table (from, event, guard, to).

### Swimlane
- **Answers:** who does each step, and where the handover happens.
- **Lane:** a team, role, or system. **Box:** a step that lane does. **Crossing:** a handover.
- **Include:** one lane per actor, every handover, the waits if the process is slow.
- **Leave out:** technical calls. **Wrong when:** one team does everything. Use a flowchart.
- **Markdown:** `flowchart LR` with one `subgraph` per lane. **HTML:** not in kit: use a table (step, owner, hands to).

### Data flow / lineage
- **Answers:** where a value comes from, or what data crosses a trust boundary.
- **Box:** a source, process, store, or output. **Arrow:** data moved, never a call.
- **Include:** every feed today, feeds to cut drawn differently, field names for field-level questions, trust boundaries.
- **Leave out:** order, timing, and the machinery that moves the data. **Wrong when:** more than ~30 feeds. Filter to one output.
- **Markdown:** `flowchart LR`. **HTML:** `lineage`; field-to-field maps: `mapping`.

### ER / data model
- **Answers:** how the tables relate.
- **Box:** a table with its key columns. **Line:** a relationship with cardinality.
- **Include:** PKs, FKs, cardinality on every line, columns that carry meaning.
- **Leave out:** audit columns and every other column. **Wrong when:** the store is one document per key.
- **Markdown:** `erDiagram`. **HTML:** not in kit: use a table of keys and joins.

### Event flow
- **Answers:** who publishes, who subscribes, to which topic or queue.
- **Box:** a producer or consumer. **Bar:** a topic or queue. **Arrow:** publish or subscribe.
- **Include:** real topic and queue names, each consumer, the DLQ, ordering and delivery guarantees.
- **Leave out:** request/response calls. **Wrong when:** there is no broker.
- **Markdown:** `flowchart LR`; with cloud services, `scripts/cloud_diagram.py`. **HTML:** `system`, or INCLUDE the `.svg` from `scripts/cloud_diagram.py`.

### Timeline / rollout
- **Answers:** what ships when, to which environment, behind which gate.
- **Box:** a phase or environment. **Diamond:** a gate, with its owner. **Axis:** time.
- **Include:** every environment, every gate and its approver, the rollback point, dates if known.
- **Leave out:** build steps. **Wrong when:** one environment with push-to-deploy. Write a sentence.
- **Markdown:** `flowchart LR`, or a table (phase, date, gate, rollback). **HTML:** not in kit: use a table.

## Rare types

Draw these only when the user asks. **Class** (UML): an inheritance tree that is
hard to read in code; Mermaid `classDiagram`. **Package / dependency graph**:
generate it from the code, never by hand. **Composite structure**: ports and
adapters; a component diagram nearly always does the job. **Communication**: a
sequence diagram nearly always reads faster. **Use case**: scope "in" vs "out"
for a stakeholder. **Timing**: a deadline or race on a real time axis.
**Interaction overview**: an index of 5+ sequence diagrams. **Star schema**: the
fact grain, measures, and dimensions of a warehouse. **Pipeline DAG**: task
order and fan-out; Mermaid `flowchart`. **CI/CD pipeline**: stages, gates, and
the failure path. **Runbook flow**: an alert, numeric thresholds, who to page.
**Context map** (DDD): bounded contexts and their integration patterns.
**Capability map**, **value stream map**, **Wardley map**: business strategy,
not engineering. **Object diagram**: one instance with real values; a JSON
snippet usually does it better.

Kit templates with no architecture type: `mapping` (which group opens which
item, through which attribute), `stack` (tiers and add-ons per plan),
`silhouettes` (what each reader sees on one screen), `matrix` (counts per
field per screen).

## Drafting rules

1. **One question per diagram.** If the question needs "and", draw two.
2. **One altitude.** Never put a cloud service and a Python function in one row of boxes.
3. **At most 12 boxes.** Past that, split by altitude: context, then container, then component.
4. **One encoding per meaning.** If dashed means "reply", it cannot also mean "optional". Write the legend first.
5. **Number the main-path steps.** Label an arrow only when the node names cannot explain it.
   Never let a label cover a node.
6. **Name boxes as the console or the code names them:** `orders-db`, not "the database".
7. **Do not draw** a straight list, a thing with 2 states, or anything a table states more precisely.
