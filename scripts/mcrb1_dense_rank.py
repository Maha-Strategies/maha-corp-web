"""
Dense retrieval ranker for the MCRB-1 additive baseline.

Reads one JSON object on stdin: {"cases": [{"id", "question", "passages": [str]}]}
Writes one JSON object on stdout: {"model", "revision", "dim", "cases": {id: [rank order]}}

This process does exactly one job: embed the query and the candidate passages
and return a passage ordering by cosine similarity. Chunking, the token budget,
the packer and the scorer all stay in the frozen TypeScript harness, so the
dense method differs from the other extractive baselines in ordering only.

No network access is required when the model is already in the local cache and
HF_HUB_OFFLINE=1 is set. It makes no API call and needs no credential.
"""
import hashlib
import json
import os
import sys

MODEL = "BAAI/bge-small-en-v1.5"
REVISION = "5c38ec7c405ec4b44b94cc5a9bb96e735b38267a"
MAX_TOKENS = 512
BATCH = 64
# BGE asks for this exact prefix on the query side only; passages are embedded bare.
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


def main() -> int:
    import numpy as np
    import torch
    from transformers import AutoModel, AutoTokenizer

    # Determinism: fixed seed, single-threaded inference, inference mode. The
    # model is deterministic anyway at eval, but pinning these removes the
    # thread-count variable from a published result.
    torch.manual_seed(0)
    torch.use_deterministic_algorithms(True, warn_only=True)
    torch.set_num_threads(int(os.environ.get("MCRB_DENSE_THREADS", "1")))

    payload = json.load(sys.stdin)
    tokenizer = AutoTokenizer.from_pretrained(MODEL, revision=REVISION)
    model = AutoModel.from_pretrained(MODEL, revision=REVISION).eval()

    def embed(texts, is_query=False):
        if is_query:
            texts = [QUERY_PREFIX + text for text in texts]
        vectors = []
        for start in range(0, len(texts), BATCH):
            batch = tokenizer(
                texts[start:start + BATCH],
                padding=True, truncation=True, max_length=MAX_TOKENS, return_tensors="pt",
            )
            with torch.inference_mode():
                # CLS pooling is the pooling BGE was trained with; mean pooling
                # would quietly evaluate a different model.
                hidden = model(**batch).last_hidden_state[:, 0]
            vectors.append(torch.nn.functional.normalize(hidden, p=2, dim=1).cpu().numpy())
        return np.concatenate(vectors, axis=0) if vectors else np.zeros((0, model.config.hidden_size))

    orders = {}
    scores_digest = hashlib.sha256()
    for case in payload["cases"]:
        passages = case["passages"]
        if not passages:
            orders[case["id"]] = []
            continue
        query_vector = embed([case["question"]], is_query=True)[0]
        passage_vectors = embed(passages)
        similarities = passage_vectors @ query_vector
        # Descending similarity, ties broken by original passage index so the
        # ordering is total and reproducible rather than dependent on sort
        # stability across runtimes.
        order = sorted(range(len(passages)), key=lambda index: (-float(similarities[index]), index))
        orders[case["id"]] = order
        scores_digest.update(case["id"].encode())
        scores_digest.update(np.round(similarities, 6).tobytes())

    json.dump({
        "model": MODEL,
        "revision": REVISION,
        "dim": int(model.config.hidden_size),
        "pooling": "cls",
        "normalized": True,
        "maxTokens": MAX_TOKENS,
        "queryPrefix": QUERY_PREFIX,
        "torch": torch.__version__,
        "numpy": np.__version__,
        "similarityDigest": f"sha256:{scores_digest.hexdigest()}",
        "cases": orders,
    }, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
