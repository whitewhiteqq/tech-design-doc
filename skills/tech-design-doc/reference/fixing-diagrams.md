# Fixing diagram defects

`scripts/check_diagrams.py` renders each diagram in Chrome and measures what the reader sees.
`kit/build.py` and `scripts/cloud_diagram.py` run the same check by themselves.

**The loop, before every delivery:**

1. Run the check: `python <skill>/scripts/check_diagrams.py <doc.md | page.html> --png _check`.
2. Fix every FAIL in the SOURCE: the Mermaid block, `figures/NAME.json`, or the cloud spec.
   Never hand-edit a built page or a generated SVG.
3. Run the check again. Stop only at `0 FAIL`.
4. Open each PNG in `_check/` (Mermaid) or each figure (HTML: `node <skill>/kit/tools/shots.mjs
   page.html _check`) once. Fix a WARN when the PNG shows the problem.
5. Delete `_check/`. It is a work folder, not a deliverable.

## FAIL -> fix

| FAIL | Kit figure (`figures/NAME.json`) | Mermaid | Cloud spec |
|---|---|---|---|
| text overlaps text | Shorten the wire `label`; or widen the column (`cols: [1, 1.4, ...]`); or move one card a column | Shorten the label; break it with `<br/>` | Shorten `label`/`sub`; move a node a cell |
| a line runs through text | Set `exit`/`enter` (`'right@0.3'`) or `via` on the wire so it misses the card text; give the card its own column | Reorder participants so the message joins neighbours; shorten the message; flowchart: change `LR`/`TD` | Move a node; set `via` |
| text crosses the edge of a card / a step disc sits on the edge of a card | Move the `label` off the short hop: shorten it, or make the wire longer (an empty column between) | Shorten the edge label | Shorten the label |
| a line crosses a card | `exit`/`enter`/`via` around the card; or move the card | Change direction or the node order; split the diagram | Move a node; `via` |
| two step discs overlap / a disc covers text | Give one wire `exit`/`enter` at `@0.25`/`@0.75`; or drop `n` on a minor wire | n/a | Drop `step` on one edge |
| text crosses the border of a group | Shorten the zone `name`; widen the zone (more columns) | Shorten the subgraph title | Shorten the group `label` |
| cut off at the edge of the figure | Fewer columns, shorter lines | Split the diagram; `LR` -> `TD` | (the tool grows the canvas: re-run) |
| shows literal quote marks | Remove the quotes from the text | `sequenceDiagram`: never quote a message (`A->>B: Create record`) | Remove the quotes |
| does not parse | n/a | Quote a flowchart label with `( ) [ ] { } : ;` as `A["..."]`; no quotes in sequence messages | n/a |

## Mermaid sequence diagrams

A message that spans several participants always crosses their lifelines. Put this line first in
every `sequenceDiagram` block: it gives message text an 8 px halo that hides the lifeline behind it
(5 px is too thin: the line shows between letters).

```
%%{init: {"themeCSS": ".messageText{paint-order:stroke;stroke:#ffffff;stroke-width:8px;stroke-linejoin:round}"}}%%
```

Write a step inside one participant as `Note over U: Validate body`, not as a self-message
(`U->>U:`), whose text always sits on the lifeline. If the target renderer ignores `themeCSS`,
order the participants so most messages join neighbours.

## WARN -> look, then decide

- **text under 9 px:** the diagram is too wide for the page and gets shrunk. Split it, switch `LR`
  to `TD`, or cut nodes to 12 or fewer.
- **two lines on top of each other:** fine for an intended fan-in; otherwise give one wire its own
  `exit`/`enter`, or move a node.
- **N line crossings:** above 3, reorder nodes (main path left to right, side services below).
- **text touches text / under 2 px from its card edge:** widen the column or shorten the text.
