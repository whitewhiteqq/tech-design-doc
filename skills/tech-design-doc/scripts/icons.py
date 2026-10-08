"""Index and search the official vendor icon packs in ../vendor-icons, read straight from the zips.

    python icons.py find lambda            # search every vendor
    python icons.py find "function app" --vendor azure
    python icons.py list aws-group         # list one namespace
    python icons.py show gcp/cloud-run     # print the zip and the member path

A key is "<namespace>/<slug>". Namespaces:
    aws          AWS service icons (64 px)        aws-res     AWS resource icons (48 px)
    aws-group    AWS group icons (account, region, VPC, subnet ...)
    aws-general  AWS general icons (user, users, client, server, internet ...)
    azure        Azure public service icons       entra       Microsoft Entra (colour)
    power        Power Platform                   gcp         Google Cloud core product icons (current)
    gcp-category Google Cloud category icons
Google's 2025 system: a core product has its own icon (gcp/cloud-run); every other product uses the
icon of its category under its own name. So gcp/pubsub resolves to gcp-category/data-analytics with
the label "Pub/Sub". See GCP_PRODUCTS below.

The zips are never extracted. The index caches to vendor-icons/.index.json and rebuilds when a zip changes.
"""
from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

PACKS = Path(__file__).resolve().parent.parent / "vendor-icons"
CACHE = PACKS / ".index.json"

# Short names people type. Each maps to a full key.
ALIASES = {
    "aws/apigw": "aws/api-gateway", "aws/sqs": "aws/simple-queue-service",
    "aws/sns": "aws/simple-notification-service", "aws/s3": "aws/simple-storage-service",
    "aws/ses": "aws/simple-email-service", "aws/ec2": "aws/ec2", "aws/ddb": "aws/dynamodb",
    "aws/ecs": "aws/elastic-container-service", "aws/eks": "aws/elastic-kubernetes-service",
    "aws/ecr": "aws/elastic-container-registry", "aws/efs": "aws/efs", "aws/rds": "aws/rds",
    "aws/sfn": "aws/step-functions", "aws/alb": "aws/elastic-load-balancing",
    "aws/elb": "aws/elastic-load-balancing", "aws/kms": "aws/key-management-service",
    "aws/iam": "aws/identity-and-access-management", "aws/secrets-manager": "aws/secrets-manager",
    "aws/vpc": "aws/virtual-private-cloud", "aws/glue": "aws/glue", "aws/athena": "aws/athena",
    "aws/cognito": "aws/cognito", "aws/waf": "aws/waf", "aws/batch": "aws/batch",
    "aws/aurora": "aws/aurora", "aws/redshift": "aws/redshift", "aws/kinesis": "aws/kinesis",
    "aws/msk": "aws/managed-streaming-for-apache-kafka", "aws/cloudfront": "aws/cloudfront",
    "aws/route53": "aws/route-53", "aws/ssm": "aws/systems-manager",
    "azure/functions": "azure/function-apps", "azure/aks": "azure/kubernetes-services",
    "azure/apim": "azure/api-management-services", "azure/cosmos-db": "azure/azure-cosmos-db",
    "azure/storage": "azure/storage-accounts", "azure/key-vault": "azure/key-vaults",
    "gcp/gcs": "gcp/cloud-storage", "gcp/spanner": "gcp/cloud-spanner",
}

# Google Cloud products without a core icon: (category key, product name). From Google's product icon
# guide (May 2026), which assigns each product to one category.
GCP_PRODUCTS = {
    "pubsub": ("data-analytics", "Pub/Sub"), "dataflow": ("data-analytics", "Dataflow"),
    "dataproc": ("data-analytics", "Dataproc"), "composer": ("data-analytics", "Cloud Composer"),
    "cloud-functions": ("serverless-computing", "Cloud Functions"),
    "app-engine": ("serverless-computing", "App Engine"),
    "api-gateway": ("integration-services", "API Gateway"), "workflows": ("integration-services", "Workflows"),
    "eventarc": ("integration-services", "Eventarc"), "cloud-tasks": ("integration-services", "Cloud Tasks"),
    "cloud-scheduler": ("integration-services", "Cloud Scheduler"),
    "firestore": ("databases", "Firestore"), "memorystore": ("databases", "Memorystore"),
    "bigtable": ("databases", "Bigtable"),
    "vpc": ("networking", "Virtual Private Cloud"), "load-balancing": ("networking", "Cloud Load Balancing"),
    "cloud-nat": ("networking", "Cloud NAT"), "cloud-dns": ("networking", "Cloud DNS"),
    "cloud-armor": ("networking", "Cloud Armor"), "cloud-cdn": ("networking", "Cloud CDN"),
    "iam": ("security-identity", "Identity and Access Management"),
    "secret-manager": ("security-identity", "Secret Manager"), "kms": ("security-identity", "Cloud KMS"),
    "cloud-logging": ("observability", "Cloud Logging"), "cloud-monitoring": ("observability", "Cloud Monitoring"),
    "artifact-registry": ("developer-tools", "Artifact Registry"), "cloud-build": ("devops", "Cloud Build"),
    "filestore": ("storage", "Filestore"),
}


def slug(text: str) -> str:
    text = re.sub(r"\(.*?\)", lambda m: m.group(0).strip("()"), text)
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _aws(name: str):
    if name.startswith("__MACOSX") or not name.endswith(".svg"):
        return None
    parts = name.split("/")
    base = parts[-1][:-4]
    if "_Dark" in base:
        return None  # the Light variant is the one drawn on a white page
    if parts[0].startswith("Resource-Icons") and base.endswith("_48_Light"):
        core = re.sub(r"^Res_", "", base[: -len("_48_Light")])
        return "aws-general", slug(core), core.replace("-", " ")
    base = base.replace("_Light", "")
    if parts[0].startswith("Architecture-Service-Icons") and "/64/" in name:
        core = re.sub(r"^Arch_", "", re.sub(r"_64$", "", base))
        title = core.replace("-", " ")
        return "aws", slug(re.sub(r"^(Amazon|AWS)-", "", core)), title
    if parts[0].startswith("Resource-Icons") and base.endswith("_48"):
        core = re.sub(r"^Res_", "", base[:-3])
        title = core.replace("_", " ").replace("-", " ")
        return "aws-res", slug(re.sub(r"^(Amazon|AWS)-", "", core)), title
    if parts[0].startswith("Architecture-Group-Icons") and base.endswith("_32"):
        return "aws-group", slug(base[:-3]), base[:-3].replace("-", " ")
    return None


def _azure(name: str):
    m = re.match(r".*/Icons/([^/]+)/\d+-icon-service-(.+)\.svg$", name)
    return ("azure", slug(m.group(2)), m.group(2).replace("-", " "), m.group(1)) if m else None


def _entra(name: str):
    if "color icons SVG" not in name or not name.endswith(".svg"):
        return None
    base = name.rsplit("/", 1)[-1][:-4]
    title = re.sub(r" color icon$", "", base)
    core = re.sub(r"^Microsoft Entra ", "", title)
    return "entra", slug(core), title


def _power(name: str):
    if not name.endswith("_scalable.svg"):
        return None
    base = name.rsplit("/", 1)[-1][: -len("_scalable.svg")]
    title = re.sub(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", " ", base)   # PowerAutomate -> Power Automate
    return "power", slug(title), "Microsoft " + title


def _gcp_core(name: str):
    m = re.match(r"Unique Icons/([^/]+)/SVG/[^/]+\.svg$", name)
    return ("gcp", slug(m.group(1)), m.group(1)) if m else None


def _gcp_category(name: str):
    m = re.match(r"Category Icons/([^/]+)/SVG/[^/]+\.svg$", name)
    return ("gcp-category", slug(m.group(1)), m.group(1)) if m else None


# Order matters: a gcp key from the current core pack wins over the same key from the product pack.
PARSERS = [
    ("aws-icons.zip", _aws), ("azure-icons.zip", _azure), ("entra-icons.zip", _entra),
    ("power-platform-icons.zip", _power), ("gcp-core-icons.zip", _gcp_core),
    ("gcp-category-icons.zip", _gcp_category),
]


def _stamp() -> dict:
    """The zips' mtimes plus a hash of this file, so a parser change rebuilds the index too."""
    stamp = {p: (PACKS / p).stat().st_mtime_ns for p, _ in PARSERS if (PACKS / p).exists()}
    stamp["code"] = hashlib.sha1(Path(__file__).read_bytes()).hexdigest()[:12]
    return stamp


def build_index() -> dict:
    index: dict[str, dict] = {}
    for pack, parse in PARSERS:
        zp = PACKS / pack
        if not zp.exists():
            continue
        for member in zipfile.ZipFile(zp).namelist():
            hit = parse(member)
            if not hit:
                continue
            ns, key_slug, title = hit[0], hit[1], hit[2]
            key = f"{ns}/{key_slug}"
            if key in index:
                if index[key]["pack"] != pack:
                    continue  # an earlier, preferred pack already holds this key
                if len(hit) > 3:
                    key = f"{ns}/{key_slug}-{slug(hit[3])}"  # same Azure name in two categories
                if key in index:
                    continue
            index[key] = {"pack": pack, "member": member, "title": title}
    return index


def load_index() -> dict:
    if not any((PACKS / p).exists() for p, _ in PARSERS):
        raise SystemExit(f"no icon pack in {PACKS}. The packs are not in the repository: download "
                         f"them as {PACKS / 'README.md'} says, then run this again.")
    stamp = _stamp()
    if CACHE.exists():
        cached = json.loads(CACHE.read_text(encoding="utf-8"))
        if cached.get("stamp") == stamp:
            return cached["icons"]
    icons = build_index()
    CACHE.write_text(json.dumps({"stamp": stamp, "icons": icons}, indent=0), encoding="utf-8")
    return icons


def resolve(key: str, index: dict | None = None) -> dict:
    """The index entry of a key, with "title" = the product name to print near the mark."""
    index = index or load_index()
    key = ALIASES.get(key, key)
    if key in index:
        return {"key": key, **index[key]}
    ns, _, name = key.partition("/")
    if ns == "gcp" and name in GCP_PRODUCTS:
        cat, title = GCP_PRODUCTS[name]
        return {"key": f"gcp-category/{cat}", **index[f"gcp-category/{cat}"], "title": title}
    raise KeyError(f"no icon '{key}'. Try: python icons.py find {key.split('/')[-1]}"
                   + _suggest(key, index))


def _suggest(key: str, index: dict) -> str:
    hits = [h for h, _ in search(key.split("/")[-1].replace("-", " "), index,
                                 key.split("/")[0] if "/" in key else None)[:5]]
    hits = hits or difflib.get_close_matches(key, list(index) + list(ALIASES), n=5, cutoff=0.6)
    return ("\n  close matches: " + ", ".join(hits)) if hits else ""


def read_svg(entry: dict) -> bytes:
    return zipfile.ZipFile(PACKS / entry["pack"]).read(entry["member"])


def search(query: str, index: dict, vendor: str | None = None) -> list[tuple[str, dict]]:
    words = [w for w in slug(query).split("-") if w]
    q = "-".join(words)
    first = []                      # a short name the user typed (sqs, s3, apigw) wins over a substring hit
    for alias, target in ALIASES.items():
        ns, name = alias.split("/")
        if name == q and (not vendor or ns == vendor) and target in index:
            first.append((target, {**index[target], "title": index[target]["title"] + f"  (alias {alias})"}))
    if vendor in (None, "gcp"):
        for k, (cat, title) in GCP_PRODUCTS.items():
            if q in k or q in slug(title):
                first.append((f"gcp/{k}", {"title": f"{title} (Google category icon: {cat})"}))
    seen = {k for k, _ in first}
    scored = []
    for key, entry in index.items():
        ns = key.split("/")[0]
        if vendor and not (ns == vendor or ns.startswith(vendor + "-")):
            continue
        if key in seen:
            continue
        hay = key.split("/", 1)[1]
        if not all(w in hay for w in words):
            continue
        exact = hay == "-".join(words)
        scored.append((0 if exact else 1, len(hay), key, entry))
    scored.sort()
    return first + [(k, e) for _, _, k, e in scored]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("find", help="search icon keys")
    f.add_argument("query")
    f.add_argument("--vendor", help="aws, azure, gcp, entra, power")
    f.add_argument("-n", type=int, default=15)
    ls = sub.add_parser("list", help="list every key in a namespace")
    ls.add_argument("namespace")
    sh = sub.add_parser("show", help="print the pack and member of a key")
    sh.add_argument("key")
    sub.add_parser("rebuild", help="rebuild the cached index")
    a = ap.parse_args(argv)

    if a.cmd == "rebuild":
        CACHE.unlink(missing_ok=True)
        print(f"{len(load_index())} icons indexed")
        return 0
    index = load_index()
    if a.cmd == "find":
        hits = search(a.query, index, a.vendor)
        for key, e in hits[: a.n]:
            print(f"{key:55} {e['title']}")
        if len(hits) > a.n:
            print(f"... {len(hits) - a.n} more (use -n)")
        return 0 if hits else 1
    if a.cmd == "list":
        for key in sorted(k for k in index if k.split("/")[0] == a.namespace):
            print(key)
        return 0
    try:
        e = resolve(a.key, index)
    except KeyError as err:
        print(err.args[0], file=sys.stderr)
        return 1
    print(f"{e['key']}\n  pack:   {e['pack']}\n  member: {e['member']}\n  title:  {e['title']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
