# Architecture diagrams — which type, what goes in it, when not to use it

A reference, not a tutorial. Scan the table, then read the card for the type you picked.

The examples use one small online shop: a checkout API, an orders service, a payment provider, and a
nightly sales report.

---

## The rule that picks the type

**The question picks the type. You do not pick it.**

Write the question first, in one sentence. The verb in that sentence names the type:

| The verb in your question | The type |
|---|---|
| "what **is** there" | a structure diagram — context, container, component |
| "where does it **run**" | a deployment diagram |
| "what **happens**, in what order" | a sequence diagram |
| "what does the code **decide**" | a flowchart |
| "where does this value **come from**" | a lineage or data-flow diagram |
| "what **states** can this be in" | a state machine |

If your question needs the word "and", you have two questions, and you need two diagrams. A checkout
API needs one diagram for the order of its calls, and a second one for where each part runs.

---

## Pick by question

| You want to answer | Use | Example question |
|---|---|---|
| Who uses this system, and what else does it talk to? | **System context** (C4 L1) | Who uses the shop, and which payment provider does it call? |
| What are the deployable parts and the stores? | **Container** (C4 L2) | Which services and databases make up checkout? |
| Which modules live inside one deployable? | **Component** (C4 L3) | Which modules inside the orders service handle pricing? |
| Where does each part run, and who bills us? | **Deployment** | Which cloud services does checkout run on, in which region? |
| In what order do the messages go, and what comes back? | **Sequence** | What happens, in order, when a customer pays? |
| What does the code check, and where does it branch? | **Flowchart** | Which checks can reject an order? |
| Which source feeds which output? | **Lineage / data flow** | Which tables feed the nightly sales report? |
| What states can one thing be in? | **State machine** | Can a password-reset token be used twice? |
| How do the tables relate? | **ERD** | How do orders, order lines and products join? |
| Which subnet, which route, which firewall rule? | **Network** | Can the web tier reach the orders database directly? |

---

## The eight types

### 1 · System context — C4 level 1

| | |
|---|---|
| **Box is** | A whole system, or a kind of person |
| **Arrow is** | "uses" or "sends data to", labelled in plain words |
| **Size** | 1 system in the middle, 3–7 things around it |

**Include:** your system as one box · every human role that touches it · every external system ·
one label per arrow.

**Leave out:** everything inside your system. No modules, no services, no database. That is the
whole discipline of this type.

**Use when** you brief someone who has never heard of the system — a new joiner, a sponsor, a
security reviewer on day one.

**Do not use when** the audience already knows what the system is for. It will bore them, and it
answers no question they have.

---

### 2 · Container — C4 level 2

| | |
|---|---|
| **Box is** | A separately deployable thing, or a store |
| **Arrow is** | A call, labelled with the protocol and the payload |
| **Size** | 4–10 boxes |

**Include:** each deployable (a Lambda, a Batch job, a web app) · each store (a bucket, a database,
a queue) · the technology in each box, in small type · arrows with protocol: "HTTPS, JSON".

**Leave out:** modules and classes. If `orders.pricing` appears here, you have slipped to level 3.

**Use when** you plan a deployment, estimate cost, or hand the system to an ops team.

**Do not use when** the question is about code organisation. A container diagram cannot show that.

---

### 3 · Component — C4 level 3

| | |
|---|---|
| **Box is** | A module inside **one** container |
| **Arrow is** | A call between modules |
| **Size** | 5–12 boxes |

**Include:** the modules of one deployable only · the one or two external things they reach.

**Leave out:** other containers' internals. One component diagram covers one container. Two
containers mean two diagrams.

**Use when** you explain how one deployable is built, or where a change should land.

**Do not use when** you have more than about 12 modules. Group them first, or the reader skims.

---

### 4 · Deployment / infrastructure

| | |
|---|---|
| **Box is** | A managed service, a machine, or a store — drawn with the vendor's own icon |
| **Arrow is** | A call across infrastructure |
| **Boundary is** | An account, a region, a VPC, a tenant — a line where billing or trust changes |

**Include:** every service that appears on the bill · the account and region boundaries · what
crosses each boundary.

**Leave out:** services you never think about — IAM, CloudFormation, CloudTrail. They are on every
diagram, which means they inform none. Also leave out any split *inside* one service: a gateway is one
icon, even when some routes need a login and others do not. When that split matters, draw it in a
second diagram — a flowchart or a communication diagram.

**Use when** the question is cost, ops, blast radius, or "what do we actually run".

**Do not use when** the point is a rule inside one service. The icon cannot
show it.

---

### 5 · Sequence

| | |
|---|---|
| **Box is** | A participant, across the top |
| **Line down** | That participant's lifeline. Time runs down |
| **Arrow is** | One message, left to right or right to left |

**Include:** every participant that sends or receives · one row per message, in order · the reply
when the reply matters · the condition on a branch, named.

**Leave out:** structure. A sequence diagram says nothing about what contains what. Also leave out
the happy path's 14th step — stop at about 12 messages.

**Use when** order is the content: a handshake, a token exchange, a retry, a race. A checkout
sequence shows the payment provider's reply arrive before the order is confirmed — that order is the
whole point.

**Do not use when** the reader needs to know what the system *is*. Sequence shows motion, never
shape.

---

### 6 · Flowchart / activity

| | |
|---|---|
| **Box is** | A step the code takes |
| **Diamond is** | A decision, with every exit labelled |
| **Arrow is** | "next" |

**Include:** every branch that changes the outcome · the terminal states, named (`404`, `200`,
`503`) · lanes, when two entry paths share a tail.

**Leave out:** who owns each step. A flowchart has no owners. A dashed box may say *where* a step
runs — a checkout flowchart can put the `401` in the API gateway, before the orders service — but
never *who* approves it.

**Use when** the logic is the content — an authorisation check, a validation chain, a retry policy.
A checkout flowchart draws the checks in the orders service, with the web and mobile entries joining
at the stock check.

**Do not use when** nothing branches. A straight line of six steps is a list, and a list reads
faster.

---

### 7 · Data flow and lineage

| | |
|---|---|
| **Box is** | A source, a process, or a store |
| **Arrow is** | Data moving, labelled with *what* data |
| **Boundary is** | A trust boundary — the reason this type underpins threat modelling |

**Include:** every source that feeds the output · every hop the data takes · the trust boundary it
crosses · the feeds you **cut**, drawn differently, when the diagram argues for a change.

**Leave out:** timing and order. Data flow is not sequence. Nothing here says "first".

**Use when** the question is provenance ("where did this field come from?"), or exposure ("what
leaves the boundary?"). A diagram of every table that feeds the nightly sales report, with the feeds
you plan to cut drawn dashed, draws no trust boundary. It is a lineage diagram, not a threat-model DFD.

**Do not use when** you want to show control flow. An arrow here means data moved, not that
something was called.

---

### 8 · State machine

| | |
|---|---|
| **Box is** | A state the thing can be in |
| **Arrow is** | A transition, labelled with the event that causes it |

**Include:** every state · the start state · the terminal states · the guard on a conditional
transition.

**Leave out:** the implementation. States are observable facts, not functions.

**Use when** one thing has a lifecycle with rules — a password-reset token that is *issued*, *used*
or *expired* is a textbook case.

**Do not use when** the thing has two states. A sentence does that better.

---

## Five more, briefly

| Type | Box is | Use it when | Skip it when |
|---|---|---|---|
| **ERD** | A table or entity | You design a schema, or explain a join | Your store is a key-value store with no joins |
| **Network** | A subnet or a firewall rule | You run inside a VPC | You are serverless with no VPC |
| **Class diagram** (C4 L4) | A class | A tricky inheritance tree needs explaining | Nearly always. The code reads better |
| **Dependency map** | A service | You hunt a cycle or a blast radius | You would draw it by hand — generate it |
| **Communication** (the C4 dynamic diagram) | A participant, placed by where it runs; arrows numbered for order | Who talks to whom matters more than exact order — a checkout request across gateway, service and payment provider | Over about 8 messages, or when a sequence diagram reads faster |

---

## Three mistakes, all from the wrong type

1. **Structure drawn as sequence.** The diagram has arrows numbered 1 to 9, and the reader still
   cannot say what the system contains. Order is not shape. Draw both, separately.
2. **Two altitudes in one picture.** An S3 bucket beside a Python function. The reader cannot tell
   which boxes are peers, so they trust none of them.
3. **A deployment diagram asked to carry a policy.** Icons name services. A rule about *which route*
   needs a token lives in a flowchart or a component diagram, never in an icon.

---

## What rarely earns a diagram

- A linear process with no branch. Write the list.
- A thing with two states. Write the sentence.
- Error handling that is the same everywhere. Say so once, in prose.
- Anything a table states more precisely. A figure carries shape; a table carries detail. Draw the
  checkout request as a figure, and put each step's timeout and error code in a table beside it.

---

## The two checks that catch most problems

1. **Can you state the question in one sentence, without "and"?** If not, split the diagram.
2. **Does any one visual property carry two meanings?** Dashed cannot mean both "reply" and
   "optional". Pick one, and use a second property for the other.

---

**Further reading:** `c4model.com` — Simon Brown. It defines levels 1 to 4 above and is short and
free. For data-flow diagrams and trust boundaries, any introduction to STRIDE threat modelling
covers the same shapes with a security purpose.
