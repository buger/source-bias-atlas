"""HDBSCAN-with-KMeans-fallback clustering.

Clustering runs on the SCALED feature matrix (not the 2D embedding) - feature
space is more meaningful than UMAP coords, which are optimized for visual
separation, not cluster identity.

Noise points (HDBSCAN label = -1) are reassigned to their nearest cluster by
2D position so every source ends up labeled.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

import numpy as np


NOISE_THRESHOLD = 0.30  # if HDBSCAN labels > 30% as noise, fall back to KMeans
KMEANS_K_CANDIDATES = (4, 5, 6, 7, 8, 9)


@dataclass
class ClusterResult:
    labels: np.ndarray            # (n,) int cluster ids in [0, k)
    method: str                   # "hdbscan" | "kmeans"
    centroids_2d: np.ndarray      # (k, 2) cluster centroid in 2D layout space
    noise_reassigned: int         # how many sources were originally noise


def _reassign_noise(
    labels: np.ndarray, coords_2d: np.ndarray
) -> Tuple[np.ndarray, int]:
    """Map any label == -1 to the nearest non-noise cluster centroid in 2D."""
    out = labels.copy()
    noise_idx = np.where(out == -1)[0]
    if len(noise_idx) == 0:
        return out, 0

    valid_mask = out != -1
    if not valid_mask.any():
        # Pathological: everything noise. Single cluster fallback.
        return np.zeros_like(out), len(noise_idx)

    # Centroid per cluster.
    valid_labels = np.unique(out[valid_mask])
    centroids = {
        c: coords_2d[(out == c)].mean(axis=0) for c in valid_labels
    }
    for i in noise_idx:
        p = coords_2d[i]
        best_c = min(valid_labels, key=lambda c: np.linalg.norm(p - centroids[c]))
        out[i] = best_c
    return out, int(len(noise_idx))


def _renumber_dense(labels: np.ndarray) -> np.ndarray:
    """Map sparse labels (e.g. {2,5,7}) to dense {0,1,2}."""
    uniq = sorted(set(labels.tolist()))
    mapping = {old: new for new, old in enumerate(uniq)}
    return np.array([mapping[v] for v in labels])


def _kmeans_pick_k(
    X: np.ndarray, candidates=KMEANS_K_CANDIDATES, random_state: int = 42
):
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score

    best = None
    for k in candidates:
        if k >= len(X):
            continue
        km = KMeans(n_clusters=k, n_init=10, random_state=random_state)
        labels = km.fit_predict(X)
        if len(set(labels)) < 2:
            continue
        try:
            score = silhouette_score(X, labels)
        except Exception:
            continue
        if best is None or score > best[0]:
            best = (score, k, labels)
    if best is None:
        # Degenerate - just return one cluster.
        return np.zeros(len(X), dtype=int), -1, -1.0
    return best[2], best[1], best[0]


def cluster(
    feature_matrix: np.ndarray,
    coords_2d: np.ndarray,
    random_state: int = 42,
) -> ClusterResult:
    n = feature_matrix.shape[0]

    # HDBSCAN attempt.
    method = "hdbscan"
    try:
        import hdbscan

        min_cluster_size = max(3, n // 30)
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster_size,
            min_samples=2,
            metric="euclidean",
        )
        labels = clusterer.fit_predict(feature_matrix)
        noise_share = float((labels == -1).mean())
    except Exception as e:  # pragma: no cover
        print(f"[cluster] HDBSCAN failed ({e}); falling back to KMeans")
        labels = np.full(n, -1)
        noise_share = 1.0

    # Reasons to fall back to KMeans:
    #   1. HDBSCAN labels > 30% as noise.
    #   2. HDBSCAN found < 2 valid clusters.
    #   3. HDBSCAN found a single mega-cluster containing > 70% of the data
    #      (informationally indistinguishable from "no clusters found").
    valid_labels = labels[labels != -1]
    too_concentrated = False
    if len(valid_labels) > 0:
        max_share = max(
            (valid_labels == c).mean() for c in set(valid_labels.tolist())
        )
        too_concentrated = max_share > 0.70 and len(set(valid_labels.tolist())) <= 2

    if (
        noise_share > NOISE_THRESHOLD
        or len(set(valid_labels.tolist())) < 2
        or too_concentrated
    ):
        labels, k_picked, sil = _kmeans_pick_k(feature_matrix, random_state=random_state)
        method = "kmeans"
        print(f"[cluster] KMeans fallback k={k_picked} silhouette={sil:.3f}")
        noise_reassigned = 0
    else:
        labels, noise_reassigned = _reassign_noise(labels, coords_2d)

    labels = _renumber_dense(labels)

    # Centroid in 2D for the per-cluster centroid emitted to atlas.json.
    k = int(labels.max() + 1)
    centroids_2d = np.zeros((k, 2))
    for c in range(k):
        centroids_2d[c] = coords_2d[labels == c].mean(axis=0)

    return ClusterResult(
        labels=labels,
        method=method,
        centroids_2d=centroids_2d,
        noise_reassigned=noise_reassigned,
    )
