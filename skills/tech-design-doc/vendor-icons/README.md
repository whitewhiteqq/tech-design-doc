# vendor-icons: official cloud icon packs

`scripts/icons.py` reads these zips in place with Python `zipfile`. Never extract, commit or redistribute them.

## Packs

| File | Pack, release | Icons (namespace) | Download |
|---|---|---|---|
| `aws-icons.zip` | AWS Architecture Icons, `07312026` | 302 `aws`, 419 `aws-res`, 13 `aws-group`, 47 `aws-general` | <https://aws.amazon.com/architecture/icons/> ("Icon package") |
| `azure-icons.zip` | Azure Public Service Icons, V24 (July 2026) | 713 `azure` | <https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V24.zip> |
| `entra-icons.zip` | Microsoft Entra architecture icons, Oct 2023 | 7 `entra` | <https://learn.microsoft.com/en-us/entra/architecture/architecture-icons> |
| `power-platform-icons.zip` | Microsoft Power Platform icons, Dec 2025 | 8 `power` | <https://learn.microsoft.com/en-us/power-platform/guidance/icons> |
| `gcp-core-icons.zip` | Google Cloud core product icons (2025 system) | 19 `gcp` | <https://services.google.com/fh/files/misc/core-products-icons.zip> |
| `gcp-category-icons.zip` | Google Cloud product category icons (2025 system) | 26 `gcp-category` | <https://services.google.com/fh/files/misc/category-icons.zip> |

Google pack page: <https://cloud.google.com/icons>. Azure pack page: <https://learn.microsoft.com/en-us/azure/architecture/icons/>.

```
d2d166c453526471749d520e0db022c459abef759d2946cf2dd1d1c992dc6526  aws-icons.zip
921594ccd1bf3d9c0a1bd7b6d924e050551a59342f2b353bb74bdcf761c35141  azure-icons.zip
4e07536706a2d092e6524e5417e2c861333fdbdb41c36f78d44dfa07ccc5eedc  entra-icons.zip
e5bc3abd3527dc2500e9bff7f15870783e2c764129c49b7cd4c1b4e105345002  gcp-category-icons.zip
6531a10f58bc599c24d9a455d81dd757c1a03c3c43da9cddf639b859c1c1eece  gcp-core-icons.zip
d5abafebbce553690caf7b42dd14b8335bf2c0dfc09f46bd9ac8041187da2c3a  power-platform-icons.zip
```

## Usage terms (exact quotes)

**AWS** (download page; the zip has no terms file). The page names no licence, so never name one in a doc.
- "We allow customers and partners to use these toolkits and assets to create architecture diagrams."
- "You can also put icons in materials like whitepapers, presentations, data sheets, and posters."

**Azure** (`Microsoft_Terms_of_Use.pdf`, `Azure_Icons_FAQ.pdf` in the zip).
- "Microsoft permits the use of these icons in architectural diagrams, training materials, or documentation."
- "Icons may not be cropped, flipped or rotated, and their shape may not be distorted or changed."
- "Yes, the full name of the service should always appear near the icon, but not so close that it looks like it's overlapping the icon."
- "No, Azure icons may only be used to represent the Microsoft product that it was designed for."

**Entra, Power Platform**: the same Microsoft terms (`Microsoft Terms of Use.docx`; `CELA_Licenses_Public_Use_Icons.pdf` and `Power_Platform_Icons_FAQ.pdf`). Entra adds "Don't use Microsoft product icons in marketing communications."

**Google Cloud**: the icons page states no licence or terms. Quote none. The page says only: "Here you can find the Google Cloud product icons you need for your diagrams, technical documentation, and more."
- Current system: 19 core product icons, plus category icons used under the product's own name. "Core products carry their own unique icons", and "The same category icon will be used for multiple products".
- The legacy console icons: "Please note, these icons should not be used as of 2026." So the skill does not ship that pack. A product without a core icon uses its category icon: `icons.py` maps `gcp/pubsub`, `gcp/cloud-functions` and others (`GCP_PRODUCTS`).

## Rules the tools apply to every mark

1. Embed the vendor file unmodified as a `data:` URI. No recolour, crop, flip, rotate or distort.
2. Print the product name near each mark, never over it.
3. Put the credit line in the figure (`PACK_CREDIT` in `scripts/cloud_diagram.py`).
4. Use a mark only for the product it names. Never for your own product.
5. Never use a mark in marketing material.

## Which tool

Use `scripts/cloud_diagram.py` for every deployment figure. Find keys with `python <skill>/scripts/icons.py find <word>`.
`kit/tools/make_icons.py` serves only the HTML kit's `services` figure. It refuses any SVG that holds a `<style>` block, which blocks most GCP icons (13 of 19 core, incl. Cloud Run, GKE, BigQuery).
The repository does not ship `kit/icons.js`, because it holds raw marks. Make it from `kit/` with
`python tools/make_icons.py --packs ../vendor-icons --map icons.relay.json --out icons.js`.

## Update a pack

1. Download the zip from the URL in the table.
2. Save it here under the same file name.
3. Run `python ../scripts/icons.py rebuild` from this folder.
4. Replace its hash in the block above (`sha256sum *.zip`).
5. Change the release string for that zip in `PACK_CREDIT` in `scripts/cloud_diagram.py`.
