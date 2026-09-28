"""How AI Works · S1C4 "Make the Loop Real": a complete training loop, from scratch, in one file.

Needs train_net.py from Chapter 1 next to it (only for downloading and loading MNIST).

    pip install numpy
    python train_loop.py

Everything from Chapters 1-3 in one loop, plus the habits real training runs use:
  - three piles of data that never mix: train (55,000), validation (5,000), test (10,000)
  - a fresh shuffle every epoch, mini-batches of 64
  - forward, loss, backward (written out, as in Chapter 3), and an Adam step
  - after every epoch: accuracy on train and validation; keep the weights that did best on validation
  - the test set is used exactly once, at the very end
"""
import numpy as np
from train_net import load, forward

xtr, ytr = load("train"); xte, yte = load("t10k")
rng = np.random.default_rng(7)
order = rng.permutation(len(xtr))
xval, yval = xtr[order[:5000]], ytr[order[:5000]]           # held out: never trained on, used to choose
xtr, ytr = xtr[order[5000:]], ytr[order[5000:]]

# ---- 1. start from random numbers (He initialization)
he = lambda o, i: (rng.standard_normal((o, i)) * np.sqrt(2.0 / i)).astype(np.float32)
P = {"W1": he(16, 784), "b1": np.zeros(16, np.float32), "W2": he(16, 16), "b2": np.zeros(16, np.float32),
     "W3": he(10, 16), "b3": np.zeros(10, np.float32)}
M = {k: np.zeros_like(v) for k, v in P.items()}; V = {k: np.zeros_like(v) for k, v in P.items()}
lr, beta1, beta2, eps, batch, epochs = 2e-3, 0.9, 0.999, 1e-8, 64, 10

acc = lambda P, x, y: float((forward(P, x)[5].argmax(1) == y).mean())
print(f"step     0  untrained: train {acc(P, xtr, ytr):.1%}  validation {acc(P, xval, yval):.1%}")

best, best_P, step = 0.0, None, 0
for epoch in range(1, epochs + 1):
    idx = rng.permutation(len(xtr))                           # ---- 2. a fresh shuffle every epoch
    for s in range(0, len(idx), batch):
        b = idx[s:s + batch]; x, y = xtr[b], ytr[b]
        z1, a1, z2, a2, z3, p = forward(P, x)                 # ---- 3. forward
        # (the loss is -log p[right answer], averaged over the batch; backward needs only its slope)
        d3 = p.copy(); d3[np.arange(len(y)), y] -= 1; d3 /= len(y)          # ---- 4. backward: blame p - y ...
        G = {"W3": d3.T @ a2, "b3": d3.sum(0)}
        d2 = (d3 @ P["W3"]) * (z2 > 0); G["W2"] = d2.T @ a1; G["b2"] = d2.sum(0)   # ... back through the gates
        d1 = (d2 @ P["W2"]) * (z1 > 0); G["W1"] = d1.T @ x; G["b1"] = d1.sum(0)
        step += 1
        for k in P:                                            # ---- 5. step: Adam, against every slope
            M[k] = beta1 * M[k] + (1 - beta1) * G[k]; V[k] = beta2 * V[k] + (1 - beta2) * G[k] ** 2
            P[k] -= lr * (M[k] / (1 - beta1 ** step)) / (np.sqrt(V[k] / (1 - beta2 ** step)) + eps)
    tr, va = acc(P, xtr, ytr), acc(P, xval, yval)             # ---- 6. check, keep the best
    keep = va > best
    if keep: best, best_P = va, {k: v.copy() for k, v in P.items()}
    print(f"step {step:5d}  epoch {epoch:2d}: train {tr:.1%}  validation {va:.1%}  gap {tr - va:+.1%}{'  <- best so far' if keep else ''}")

# ---- 7. the test set, once
pred = forward(best_P, xte)[5].argmax(1)
print(f"\ntest accuracy (10,000 digits never used for anything until now): {(pred == yte).mean():.1%}   wrong: {(pred != yte).sum()}")
C = np.zeros((10, 10), int)
for t, q in zip(yte, pred): C[t, q] += 1
pairs = sorted(((C[a, b], a, b) for a in range(10) for b in range(10) if a != b), reverse=True)[:3]
print("most common mistakes:", ", ".join(f"{a} read as {b} ({n}x)" for n, a, b in pairs))
