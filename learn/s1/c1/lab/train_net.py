"""Train the real network the video shows: 784 -> 16 -> 16 -> 10, ReLU, softmax.

Every number on screen in Track 01 comes from this file's output (data/net.json):
the digit's pixels, the weights (random at step 0, then trained), the per-neuron
products and sums, the activations and the final probabilities. Deterministic (seed 7).
"""
import gzip, json, os, hashlib
from urllib.request import urlopen
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "mnist")
OUT = os.path.join(HERE, "net.json")
BASE = "https://storage.googleapis.com/cvdf-datasets/mnist/"
MD5 = {
    "train-images-idx3-ubyte.gz": "f68b3c2dcbeaaa9fbdd348bbdeb94873",
    "train-labels-idx1-ubyte.gz": "d53e105ee54ea40749a09fcbcd1e9432",
    "t10k-images-idx3-ubyte.gz": "9fb629c4189551a2d022fa330f9573f3",
    "t10k-labels-idx1-ubyte.gz": "ec29112dd5afa0611ce80d1b7f02629c",
}

def fetch(name):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, name)
    if not os.path.exists(p):
        with urlopen(BASE + name, timeout=60) as r:
            open(p, "wb").write(r.read())
    raw = open(p, "rb").read()
    assert hashlib.md5(raw).hexdigest() == MD5[name], f"checksum mismatch: {name}"
    return gzip.decompress(raw)

def load(prefix):
    im = fetch(f"{prefix}-images-idx3-ubyte.gz"); lb = fetch(f"{prefix}-labels-idx1-ubyte.gz")
    x = np.frombuffer(im, np.uint8, offset=16).reshape(-1, 784).astype(np.float32) / 255.0
    y = np.frombuffer(lb, np.uint8, offset=8).astype(np.int64)
    return x, y

def relu(z): return np.maximum(z, 0)

def forward(P, x):
    z1 = x @ P["W1"].T + P["b1"]; a1 = relu(z1)
    z2 = a1 @ P["W2"].T + P["b2"]; a2 = relu(z2)
    z3 = a2 @ P["W3"].T + P["b3"]
    z3s = z3 - z3.max(axis=1, keepdims=True)
    p = np.exp(z3s); p /= p.sum(axis=1, keepdims=True)
    return z1, a1, z2, a2, z3, p

def r(a, d=4): return np.round(np.asarray(a, dtype=np.float64), d).tolist()

def main():
    xtr, ytr = load("train"); xte, yte = load("t10k")
    rng = np.random.default_rng(7)
    he = lambda o, i: (rng.standard_normal((o, i)) * np.sqrt(2.0 / i)).astype(np.float32)
    P = {"W1": he(16, 784), "b1": np.zeros(16, np.float32),
         "W2": he(16, 16), "b2": np.zeros(16, np.float32),
         "W3": he(10, 16), "b3": np.zeros(10, np.float32)}
    M = {k: np.zeros_like(v) for k, v in P.items()}; V = {k: np.zeros_like(v) for k, v in P.items()}
    lr, b1_, b2_, eps, bs, epochs = 2e-3, 0.9, 0.999, 1e-8, 64, 8
    snap_steps = {0, 25, 50, 100, 200, 400, 800, 1600, 3200}
    snaps, losses, accs, step = [], [], [], 0
    snaps.append({"step": 0, "W1": r(P["W1"], 3)})
    for ep in range(epochs):
        idx = rng.permutation(len(xtr))
        for s in range(0, len(idx), bs):
            b = idx[s:s + bs]; x, y = xtr[b], ytr[b]
            z1, a1, z2, a2, z3, p = forward(P, x)
            loss = -np.log(p[np.arange(len(y)), y] + 1e-12).mean()
            g3 = p.copy(); g3[np.arange(len(y)), y] -= 1; g3 /= len(y)
            G = {"W3": g3.T @ a2, "b3": g3.sum(0)}
            g2 = (g3 @ P["W3"]) * (z2 > 0); G["W2"] = g2.T @ a1; G["b2"] = g2.sum(0)
            g1 = (g2 @ P["W2"]) * (z1 > 0); G["W1"] = g1.T @ x; G["b1"] = g1.sum(0)
            step += 1
            for k in P:
                M[k] = b1_ * M[k] + (1 - b1_) * G[k]; V[k] = b2_ * V[k] + (1 - b2_) * G[k] ** 2
                mh = M[k] / (1 - b1_ ** step); vh = V[k] / (1 - b2_ ** step)
                P[k] -= lr * mh / (np.sqrt(vh) + eps)
            if step % 10 == 0: losses.append([step, round(float(loss), 4)])
            if step in snap_steps: snaps.append({"step": step, "W1": r(P["W1"], 3)})
        acc = float((forward(P, xte)[5].argmax(1) == yte).mean())
        accs.append([ep + 1, step, round(acc, 4)]); print(f"epoch {ep+1} step {step} test acc {acc:.4f}", flush=True)
    snaps.append({"step": step, "W1": r(P["W1"], 3)})

    # the hero digit: a clearly-written test-set 7 the network gets right with high confidence
    probs = forward(P, xte)[5]
    cand = [i for i in range(len(yte)) if yte[i] == 7 and probs[i].argmax() == 7 and 0.93 < probs[i, 7] < 0.995]
    ink = lambda i: (xte[i] > 0.5).sum()
    hero = sorted(cand[:400], key=lambda i: -ink(i))[len(cand[:400]) // 3]
    x = xte[hero:hero + 1]
    z1, a1, z2, a2, z3, p = forward(P, x)
    star = int(np.argmax(z1[0]))   # hidden neuron the pre-chorus zooms into (largest pre-activation)
    dead = int(np.argmin(z1[0]))   # one that stays dark (negative -> ReLU gives 0)
    prods = (x[0] * P["W1"][star]).astype(np.float64)
    out = {
        "meta": {"arch": [784, 16, 16, 10], "activation": "ReLU", "output": "softmax",
                 "optimizer": "Adam lr=2e-3 batch=64", "epochs": epochs, "steps": step, "seed": 7,
                 "dataset": "MNIST (60,000 train / 10,000 test)", "test_accuracy": accs[-1][2]},
        "digit": {"test_index": int(hero), "label": 7, "pixels": r(x[0], 3)},
        "final": {k: r(v) for k, v in P.items()},
        "snapshots": snaps, "loss": losses, "accuracy": accs,
        "trace": {"z1": r(z1[0]), "a1": r(a1[0]), "z2": r(z2[0]), "a2": r(a2[0]),
                  "z3": r(z3[0]), "p": r(p[0], 5), "prediction": int(p[0].argmax())},
        "star": {"neuron": star, "products": r(prods, 5), "sum": round(float(prods.sum()), 4),
                 "bias": round(float(P["b1"][star]), 4), "z": round(float(z1[0, star]), 4)},
        "dead": {"neuron": dead, "z": round(float(z1[0, dead]), 4)},
    }
    assert abs(out["star"]["sum"] + out["star"]["bias"] - out["star"]["z"]) < 1e-3
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w"), separators=(",", ":"))
    print(f"hero test[{hero}] p(7)={p[0,7]:.4f} star neuron {star} z={z1[0,star]:.3f}  dead neuron {dead} z={z1[0,dead]:.3f}")
    print(f"wrote {OUT} ({os.path.getsize(OUT)/1e6:.2f} MB)")

if __name__ == "__main__":
    main()
