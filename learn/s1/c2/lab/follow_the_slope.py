"""How AI Works · S1C2 "Follow the Slope" — the learning rate, on your own machine.

Trains the same 784-16-16-10 network as Chapter 1 (same seed, same starting weights) with PLAIN
gradient descent on mini-batches of 64: w <- w - eta * g. No Adam, nothing hidden. It runs one epoch
(938 steps) for three step sizes and prints the loss every 100 steps and the test accuracy at the end.

    pip install numpy
    python follow_the_slope.py            # needs train_net.py from Chapter 1 next to it (for MNIST loading)

Try other values of ETA below. Too small crawls; too big bounces and can blow up (loss -> nan)."""
import numpy as np
from train_net import load, forward

ETAS = [0.001, 0.1, 2.0]         # too small, about right, too big
xtr, ytr = load("train"); xte, yte = load("t10k")

def init():
    rng = np.random.default_rng(7)
    he = lambda o, i: (rng.standard_normal((o, i)) * np.sqrt(2.0 / i)).astype(np.float32)
    P = {"W1": he(16, 784), "b1": np.zeros(16, np.float32), "W2": he(16, 16), "b2": np.zeros(16, np.float32),
         "W3": he(10, 16), "b3": np.zeros(10, np.float32)}
    return P, rng

for eta in ETAS:
    P, rng = init()
    idx = rng.permutation(len(xtr)); bs = 64; line = []
    with np.errstate(all="ignore"):
        for step, s in enumerate(range(0, len(idx), bs), 1):
            b = idx[s:s + bs]; x, y = xtr[b], ytr[b]
            z1, a1, z2, a2, z3, p = forward(P, x)
            loss = -np.log(p[np.arange(len(y)), y] + 1e-12).mean()          # the loss: -log p(right answer)
            g3 = p.copy(); g3[np.arange(len(y)), y] -= 1; g3 /= len(y)       # its slope w.r.t. the output scores
            G = {"W3": g3.T @ a2, "b3": g3.sum(0)}                            # ...and back through every layer
            g2 = (g3 @ P["W3"]) * (z2 > 0); G["W2"] = g2.T @ a1; G["b2"] = g2.sum(0)
            g1 = (g2 @ P["W2"]) * (z1 > 0); G["W1"] = g1.T @ x; G["b1"] = g1.sum(0)
            for k in P: P[k] -= eta * G[k]                                    # w <- w - eta * g
            if step % 100 == 0 or step == 1: line.append(f"{loss:.2f}")
        acc = float((forward(P, xte)[5].argmax(1) == yte).mean())
    print(f"eta = {eta:<5}  loss every 100 steps: {' '.join(line)}   test accuracy {acc * 100:.1f}%")
