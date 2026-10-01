# Data

BANKING77, unchanged, from
[PolyAI-LDN/task-specific-datasets](https://github.com/PolyAI-LDN/task-specific-datasets/tree/master/banking_data).
Licensed [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).

> Iñigo Casanueva, Tadas Temčinas, Daniela Gerz, Matthew Henderson and Ivan
> Vulić. 2020. *Efficient Intent Detection with Dual Sentence Encoders*.
> Proceedings of the 2nd Workshop on NLP for ConvAI.
> [arXiv:2003.04807](https://arxiv.org/abs/2003.04807)

| File | Rows | SHA-256 |
|---|---|---|
| `train.csv` | 10,003 | `b06e26ac675513959a63135f11b94ea7786ed02da65db93a5650d8838cbc664b` |
| `test.csv` | 3,080 | `d12d6e3bc4c3103966ae786dc435913c0c563dfa328f5a3646d0e62cfeeb474d` |
| `categories.json` | 77 intents | `53261da888122daf2d120d925458631d9619e15d82e56052e7a42e535ce32b63` |

`sortcode/data.py` checks the row counts, the 40-per-intent test split and the
intent list every time it loads, so a changed file fails loudly instead of
quietly shifting the results.
