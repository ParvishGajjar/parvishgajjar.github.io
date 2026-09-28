"""How AI Works · S1C3 "Every Link Matters": backpropagation by hand, checked against nudging.

Needs train_net.py from Chapter 1 next to it (for MNIST loading and the forward pass).

    pip install numpy
    python backprop_by_hand.py

1. Rebuilds the Chapter 1 network with its exact random start (seed 7) and shows it test digit #328, a 7.
2. Runs it forward, then walks the blame back, layer by layer. Every line of the backward pass is visible.
3. Checks five random slopes against nudging: turn one dial a hair each way and re-run the whole network.
4. Counts the multiplications: one forward + one backward pass vs nudging every dial.
5. Trains one epoch with plain gradient descent using ONLY the hand-written backward pass from step 2.
"""
import numpy as np
from train_net import load, forward

xtr, ytr = load("train"); xte, yte = load("t10k")
rng = np.random.default_rng(7)
he = lambda o, i: (rng.standard_normal((o, i)) * np.sqrt(2.0 / i)).astype(np.float32)
P = {"W1": he(16, 784), "b1": np.zeros(16, np.float32), "W2": he(16, 16), "b2": np.zeros(16, np.float32),
     "W3": he(10, 16), "b3": np.zeros(10, np.float32)}
P = {k: v.astype(np.float64) for k, v in P.items()}          # float64 so the nudge check is precise


def backward(P, x, y):
    """Blame for a batch x (n, 784) with labels y. Returns the loss and the slope of every dial."""
    n = len(y)
    z1, a1, z2, a2, z3, p = forward(P, x)
    loss = -np.log(p[np.arange(n), y]).mean()
    d3 = p.copy(); d3[np.arange(n), y] -= 1; d3 /= n            # blame at the output scores: p - y
    G = {"W3": d3.T @ a2, "b3": d3.sum(0)}                      # a dial's slope = blame x what came in
    g2 = d3 @ P["W3"]                                           # blame arriving at layer 2 (back along W3)
    d2 = g2 * (z2 > 0)                                          # the ReLU gate: silent neurons pass nothing back
    G["W2"] = d2.T @ a1; G["b2"] = d2.sum(0)
    g1 = d2 @ P["W2"]                                           # blame arriving at layer 1 (back along W2)
    d1 = g1 * (z1 > 0)
    G["W1"] = d1.T @ x; G["b1"] = d1.sum(0)
    return loss, G, (p, d3, d1)


def loss_only(P, x, y):
    p = forward(P, x)[5]
    return -np.log(p[np.arange(len(y)), y]).mean()


# ---- 1-2. one digit, forward and back
x7, y7 = xte[328:329].astype(np.float64), yte[328:329]
loss, G, (p, d3, d1) = backward(P, x7, y7)
print(f"test digit #328, label {y7[0]}: the untrained network says {p[0].argmax()}  "
      f"(p[{p[0].argmax()}] = {p[0].max():.3f}, p[7] = {p[0][7]:.3f})  loss {loss:.3f}")
print("blame at the ten outputs, p - y:", np.round(d3[0], 3))
print(f"layer-1 neurons that fired: {(forward(P, x7)[0][0] > 0).sum()} of 16   "
      f"dials with a nonzero slope: {sum(int((np.abs(g) > 0).sum()) for g in G.values())} of {sum(v.size for v in P.values())}")

# ---- 3. check against nudging
print("\ndial            backprop     nudging (2 extra forward passes)")
check = np.random.default_rng(3)
for _ in range(5):
    k = ["W1", "W2", "W3"][check.integers(3)]
    idx = tuple(int(check.integers(s)) for s in P[k].shape)
    if k == "W1":
        idx = (int(check.integers(16)), int(check.choice(np.flatnonzero(x7[0] > 0))))   # an ink pixel
    h = 1e-5; old = P[k][idx]
    P[k][idx] = old + h; up = loss_only(P, x7, y7)
    P[k][idx] = old - h; dn = loss_only(P, x7, y7)
    P[k][idx] = old
    print(f"{k}{list(idx)!s:12} {G[k][idx]: .6f}    {(up - dn) / (2 * h): .6f}")

# ---- 4. the price
fwd = 784 * 16 + 16 * 16 + 16 * 10
bwd = 16 * 10 + 16 * 16 + 10 * 16 + 16 * 16 + 16 * 784
n = sum(v.size for v in P.values())
print(f"\nmultiplications  forward {fwd:,}  backward {bwd:,}  together {fwd + bwd:,}")
print(f"nudging every dial: {n + 1:,} forward passes = {(n + 1) * fwd:,}  ({(n + 1) * fwd / (fwd + bwd):,.0f}x more)")

# ---- 5. train one epoch with nothing but this backward pass
eta, bs = 0.1, 64
order = np.random.default_rng(7).permutation(len(xtr))
for step, s in enumerate(range(0, len(order), bs), 1):
    b = order[s:s + bs]
    loss, G, _ = backward(P, xtr[b].astype(np.float64), ytr[b])
    for k in P: P[k] -= eta * G[k]                                 # w <- w - eta * g
    if step in (1, 100, 300, 600, 938): print(f"step {step:4d}  batch loss {loss:.3f}")
acc = (forward(P, xte)[5].argmax(1) == yte).mean()
p = forward(P, x7)[5][0]
print(f"after one epoch: test accuracy {acc * 100:.1f}%   digit #328 -> {p.argmax()} (p[7] = {p[7]:.3f})")
