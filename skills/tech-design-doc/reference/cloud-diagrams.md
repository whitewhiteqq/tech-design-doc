# Cloud deployment diagrams

One JSON spec in, four files out, every icon the official vendor mark:

```
python <skill>/scripts/cloud_diagram.py docs/img/deploy.spec.json
  -> deploy.svg     inline in HTML (build.py: <!--@@INCLUDE deploy.svg@@-->)
  -> deploy.png     2x render for Confluence and Markdown preview (needs Chrome or Edge)
  -> deploy.drawio  editable; Confluence draw.io macro; icons embedded, no stencil library needed
  -> deploy.md      paste-ready snippet: image, draw.io link, icon credit
  -> deploy.mmd     Mermaid twin of the topology, for review and diffs (no icons)
```

The tool prints `lint:` lines. Fix the spec until it prints none (`--strict` exits 2 while any
remain). Then open the PNG and look at it once: lint cannot see everything.

`deploy.md` links `img/deploy.png` when the output folder is named `img`, `images`, `assets` or
`diagrams`; set `--link-prefix` for any other layout. The Mermaid twin goes to `deploy.mmd`: keep it in
the repo for diffs, and leave it out of the Confluence page.

## Find icon keys

```
python <skill>/scripts/icons.py find lambda               # all vendors
python <skill>/scripts/icons.py find "service bus" --vendor azure
python <skill>/scripts/icons.py list aws-group
```

| Namespace | What | Examples |
|---|---|---|
| `aws/` | AWS service icons | `aws/lambda`, `aws/api-gateway`, `aws/dynamodb`, `aws/sqs`, `aws/s3`, `aws/ecs`, `aws/rds`, `aws/aurora`, `aws/cloudwatch`, `aws/eventbridge`, `aws/step-functions` |
| `aws-res/` | AWS resource icons (finer grain) | `aws-res/dynamodb-table`, `aws-res/simple-queue-service-queue` |
| `aws-general/` | AWS general icons | `aws-general/user`, `aws-general/users`, `aws-general/client`, `aws-general/internet`, `aws-general/server` |
| `azure/` | Azure service icons (V24) | `azure/function-apps`, `azure/app-services`, `azure/sql-database`, `azure/azure-service-bus`, `azure/key-vaults`, `azure/users` |
| `gcp/` | Google Cloud core product icons | `gcp/cloud-run`, `gcp/bigquery`, `gcp/gke`, `gcp/cloud-sql`, `gcp/cloud-storage`, `gcp/apigee` |
| `gcp/<product>` without a core icon | Category icon, product name kept | `gcp/pubsub`, `gcp/cloud-functions`, `gcp/firestore`, `gcp/secret-manager`, `gcp/cloud-monitoring` |
| `entra/`, `power/` | Microsoft Entra, Power Platform | `entra/id`, `power/power-automate` |

Short aliases work: `aws/apigw`, `aws/sqs`, `aws/sns`, `aws/alb`, `aws/sfn`, `azure/functions`, `gcp/gcs`.
A Google product with no core icon uses its category icon under its own name (Google's 2025 system).
If `find` shows no `gcp/<product>` entry, use `gcp-category/<category>` and set `label` to the product name.

## Spec format

```json
{
  "title": "Orders: AWS deployment",
  "nodes": [
    {"id": "user", "icon": "aws-general/users", "label": "Customers", "at": [0, 0]},
    {"id": "api",  "icon": "aws/api-gateway",   "sub": "HTTP entry", "at": [1, 0]},
    {"id": "fn",   "icon": "aws/lambda",        "sub": "Order handler", "at": [2, 0]},
    {"id": "erp",  "label": "ERP", "sub": "System of record", "at": [3, 0]}
  ],
  "groups": [
    {"id": "acct", "style": "aws-account", "label": "AWS account: prod", "contains": ["region"]},
    {"id": "region", "style": "region", "label": "ap-east-1", "contains": ["api", "fn"]}
  ],
  "edges": [
    {"from": "user", "to": "api", "step": 1},
    {"from": "api", "to": "fn", "step": 2},
    {"from": "fn", "to": "erp", "step": 3, "label": "REST"}
  ]
}
```

**Node.** `id`, `at: [column, row]` (one node per cell), optional `icon`, `label`, `sub`.
- `label` defaults to the product name of the icon. Set it when the default reads badly. The
  vendor terms need the product name near the mark, so keep it in the label: "AWS Lambda", not "Worker".
- Put the role in `sub`: "Worker (stream consumer)".
- No `icon` = an external system, drawn as a grey box with "External".

**Group.** `id`, `style`, `label`, `contains` (node ids and group ids). The tool sizes each box
from its members, so nesting is free. A node or group sits in at most one parent.

| Style | Draws | Style | Draws |
|---|---|---|---|
| `aws-cloud` | AWS Cloud (logo) | `azure-subscription` | Azure subscription (icon) |
| `aws-account` | AWS account (pink) | `azure-rg` | Resource group (dashed) |
| `region` | AWS Region (teal, dashed) | `azure-vnet` | Virtual network |
| `az` | Availability Zone (dashed) | `gcp-project` | Google Cloud project |
| `vpc` | VPC (purple) | `gcp-region` | Google Cloud region (dashed) |
| `public-subnet` / `private-subnet` | Subnets (green / teal fill) | `external` | A system you do not run |
| `asg` | Auto Scaling group | `data-center` | Corporate data center |
| `generic` | Plain grey box | | |

Override one property on the group: `"stroke": "#232F3E"`, `"fill": "#FFFFFF"`,
`"dash": "6 4"` (`""` = solid), or `"icon": "<icon key>"`.

**Edge.** `from`, `to`, optional `kind`, `step`, `label`, `via`.

| `kind` | Line | Use for |
|---|---|---|
| `main` (default) | Solid blue | The request path |
| `async` | Dashed blue | Events, streams, queues, schedules |
| `failure` | Dashed red | Retry, re-drive, dead-letter |
| `monitor` | Dotted grey | Logs, metrics, alarms, secret reads |

- `step`: a number in a disc. Number the main path 1, 2, 3...
- `label`: 1 to 3 words. Add one only when the node names do not explain the arrow.
- `via`: force a route shape: `h`, `v`, `hv`, `vh`, `L1`, `L2`, `u`, `c`. Use it only when lint
  names that edge.

## Layout rules that give a clean diagram

1. Put the main path on row 0, left to right, from the caller to the system of record.
2. Put secondary services on row 1 under the node they serve: monitoring, schedules, DLQs, secrets.
3. Put external systems in column 0 (callers) or in the last column (downstream systems).
4. Keep 4 to 12 nodes. Split a bigger estate into one diagram per account or per flow.
5. Leave out IAM roles, CloudFormation, CI/CD, and security groups. They are not deployment topology.
   A network diagram that must show allow/deny rules puts them in a table under the figure.
6. The tool sizes a gap from the group borders it holds, so a cell can sit empty. Never squeeze nodes.

## Lint messages and the fix

| Message | Fix |
|---|---|
| `node 'x' sits inside group 'g' but is not a member` | Move the node out of the group span, or add it to `contains`. |
| `groups 'a' and 'b' overlap` | Give sibling groups separate columns or rows. |
| `edge a -> b passes through N node(s)` | Move a node, or set `via` on the edge. |
| `edge a -> b runs on top of another edge` | Move a node one row or column, or set `via`. |
| `the label or step disc of edge ... covers ...` | Shorten or drop the label, or move a node one cell. |
| `the label of group 'g' is wider than its box` | Shorten the group label. |
| `edge a -> b crosses the title of group 'g'` | Move a node so the edge enters the group from a side. |

## Confluence

1. Attach `deploy.png` and `deploy.drawio` to the page.
2. Paste the lines of `deploy.md` where the diagram goes.
3. To edit, open the `.drawio` attachment in the draw.io macro. The icons are inside the file.

Confluence does not render Mermaid icon packs, so the Mermaid twin is for review only.
