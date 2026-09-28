// How AI Works: the series map. Adding a chapter = copy learn/s1/c1/ to its new folder, then add or
// flip one entry here (status "live" + url). The hub page and every chapter's "Up next" read from this.
window.SERIES = {
  title: 'How AI Works',
  seasons: [
    {
      n: 1, title: 'Neural Networks & the Math',
      blurb: 'What a neural network actually computes, and how it learns.',
      chapters: [
        { n: 1, id: 's1c1', title: 'What a Neuron Computes', song: 'Seven Hundred Eighty-Four', status: 'live', url: '/learn/s1/c1/',
          thumb: '/learn/s1/c1/media/f3-weights-sm.jpg', blurb: 'Pixels become numbers; a neuron multiplies, adds and keeps what’s above zero.' },
        { n: 2, id: 's1c2', title: 'Follow the Slope', song: 'Follow the Slope', status: 'live', url: '/learn/s1/c2/',
          thumb: '/learn/s1/c2/media/poster-sm.jpg', blurb: 'Loss, gradients and gradient descent: measure how wrong, find the slope, take a small step down.' },
        { n: 3, id: 's1c3', title: 'Every Link Matters', song: 'Every Link Matters', status: 'live', url: '/learn/s1/c3/',
          thumb: '/learn/s1/c3/media/poster-sm.jpg', blurb: 'The chain rule and backpropagation: how all 13,002 slopes are found at once.' },
        { n: 4, id: 's1c4', title: 'Make the Loop Real', status: 'next', blurb: 'A complete training loop, from random numbers to 95% on handwritten digits.' },
      ],
    },
    {
      n: 2, title: 'Transformers: Build a GPT',
      blurb: 'The 2017 invention behind ChatGPT, built up piece by piece.',
      chapters: [
        { n: 1, id: 's2c1', title: 'Pieces of a Sentence', status: 'planned', blurb: 'Tokens and embeddings: how text becomes numbers.' },
        { n: 2, id: 's2c2', title: 'Attention', status: 'planned', blurb: 'How every word looks at every other word; the idea that changed everything.' },
        { n: 3, id: 's2c3', title: 'One More Token', status: 'planned', blurb: 'Pretraining a tiny GPT on next-word prediction.' },
        { n: 4, id: 's2c4', title: 'Does It Really Know?', status: 'planned', blurb: 'Evaluation, generalisation and why models make things up.' },
      ],
    },
    {
      n: 3, title: 'Post-Training: Make It Yours',
      blurb: 'From a raw text predictor to an assistant, and fine-tuning one yourself.',
      chapters: [
        { n: 1, id: 's3c1', title: 'Learning to Answer', status: 'planned', blurb: 'Instruction tuning and RLHF: how a text predictor becomes an assistant.' },
        { n: 2, id: 's3c2', title: 'A Smaller Way to Change', status: 'planned', blurb: 'LoRA: fine-tuning a real model on a free GPU.' },
        { n: 3, id: 's3c3', title: 'Fewer Bits to Carry', status: 'planned', blurb: 'Quantisation: running models on your own laptop.' },
        { n: 4, id: 's3c4', title: 'Make It Yours', status: 'planned', blurb: 'Fine-tune, evaluate and share your own model.' },
      ],
    },
  ],
};
