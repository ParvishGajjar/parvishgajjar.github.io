"""How AI Works · Season 2, Chapter 1 · Pieces of a Sentence
Byte-pair encoding from scratch: the tokenizer of this season's model, in one file, no libraries.

1. Read Tiny Shakespeare (1,115,394 characters; downloaded once, next to this file).
2. Split it into words. A word keeps the space in front of it (" say"), as GPT-2 does, so pieces never cross words.
3. Start with the 65 distinct characters as the vocabulary.
4. Count every pair of neighbouring pieces inside every word. Merge the most common pair into one new piece.
   Count again. Repeat until the vocabulary has 512 pieces (65 characters + 447 merges).
5. Encode any sentence: split into words, then apply the learned merges in the order they were learned.

Run:  python bpe.py                        train, then show a few sentences in pieces
      python bpe.py "your own sentence"    ...and yours
"""
import os, re, sys, time
from collections import Counter
from urllib.request import urlopen

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "input.txt")
URL = "https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt"
VOCAB = 512

# ------------------------------------------------------------------ 1. the text
if not os.path.exists(SRC):
    print("downloading Tiny Shakespeare ...")
    with urlopen(URL, timeout=60) as r:
        open(SRC, "wb").write(r.read())
text = open(SRC, encoding="utf-8").read()
chars = sorted(set(text))
print(f"text: {len(text):,} characters, {len(chars)} distinct")

# ------------------------------------------------------------------ 2. words (a word carries its leading space)
PAT = re.compile(r" ?[A-Za-z]+| ?[0-9]+| ?[^\sA-Za-z0-9]+|\s+(?!\S)|\s+")
words = Counter(PAT.findall(text))                    # " the" -> how many times it occurs
print(f"words: {sum(words.values()):,} in the text, {len(words):,} different")

# ------------------------------------------------------------------ 3-4. learn the merges
vocab = list(chars)                                   # piece id -> the text it stands for
seqs = {w: [vocab.index(c) for c in w] for w in words}  # every word as a list of piece ids
merges = []                                           # (a, b, count), in the order learned
t0 = time.time()
while len(vocab) < VOCAB:
    pairs = Counter()
    for w, n in words.items():                        # count neighbouring pairs, weighted by how often the word occurs
        s = seqs[w]
        for i in range(len(s) - 1):
            pairs[(s[i], s[i + 1])] += n
    (a, b), count = pairs.most_common(1)[0]           # the most common pair ...
    new = len(vocab)
    vocab.append(vocab[a] + vocab[b])                 # ... becomes one new piece
    merges.append((a, b, count))
    for w in words:                                   # and every word is rewritten with it
        s = seqs[w]
        if len(s) < 2:
            continue
        out, i = [], 0
        while i < len(s):
            if i < len(s) - 1 and s[i] == a and s[i + 1] == b:
                out.append(new); i += 2
            else:
                out.append(s[i]); i += 1
        seqs[w] = out
    k = len(merges)
    if k <= 10 or k % 100 == 0 or k == VOCAB - len(chars):
        show = lambda p: p.replace(" ", "·").replace("\n", "↵")
        print(f"merge {k:3d}: {show(vocab[a]):>8} + {show(vocab[b]):<8} -> {show(vocab[new]):<10} ({count:,} times)")
print(f"{len(chars)} characters + {len(merges)} merges = {len(vocab)} pieces   ({time.time() - t0:.0f}s)")

# ------------------------------------------------------------------ 5. encode and decode
rank = {(a, b): k for k, (a, b, _) in enumerate(merges)}

def encode_word(w):
    s = [vocab.index(c) for c in w]                   # start from characters
    while len(s) > 1:                                 # apply the earliest-learned merge that fits, again and again
        best = min((rank.get((s[i], s[i + 1]), 10**9), i) for i in range(len(s) - 1))
        if best[0] == 10**9:
            break
        i = best[1]
        s = s[:i] + [len(chars) + best[0]] + s[i + 2:]
    return s

def encode(t):
    unknown = sorted(set(t) - set(chars))
    if unknown:
        raise ValueError(f"not in the 65 characters: {unknown}  (byte-level BPE, as in GPT-2, starts from 256 bytes to avoid this)")
    return [i for w in PAT.findall(t) for i in encode_word(w)]

def decode(ids):
    return "".join(vocab[i] for i in ids)

ids = encode(text)
assert decode(ids) == text                            # nothing is lost: pieces put back together give the text
print(f"the whole text: {len(ids):,} pieces ({len(text) / len(ids):.2f} characters per piece)")

examples = sys.argv[1:] or ["I never learned to say it", "To be, or not to be, that is the question", "The king is dead; long live the king!"]
for e in examples:
    try:
        p = encode(e)
    except ValueError as err:
        print(f"\n{e!r}: {err}"); continue
    print(f"\n{e!r}: {len(e)} characters -> {len(p)} pieces")
    print("  pieces:", " | ".join(vocab[i].replace(" ", "·") for i in p))
    print("  ids:   ", p)
