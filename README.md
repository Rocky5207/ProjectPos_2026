# Noon Counter | ProjectPos_2026

An offline, single-till POS for a campus mini-market during the lunch rush. Open **index.html** in a normal desktop Chrome, Edge or Firefox window. No login, server or installation is needed. Keep the same browser profile and file location to retain transactions. If local file storage is restricted, serve the directory with `python -m http.server 8000` and open localhost:8000. Storage is local to that address.

## Three-minute walkthrough

Start in a new profile for the seeded example. Six products are supplied. Batch B01 has three rice balls expiring today, priced at ¥6. B02 has six at ¥8.

1. Add four rice balls. The total is ¥26. Park the basket as H001.
2. Ring up one rice ball for the next student. Accept ¥10 and give ¥4 change.
3. Recall H001. The screen explains why the total changed to ¥28. Accept ¥30 and give ¥2 change. Keep receipt S0002.
4. In Returns, find S0002. On B01 enter one opened rice ball. Refund ¥6. The remaining B01 allowance is one. The unit goes to quarantine.
5. In Stock, check B01 and the low-stock crackers. Receive two cracker packs under a new dated lot.
6. In Shift, check ¥34 taken, ¥6 refunded and ¥28 net. Export the movement ledger to CSV.

## Rules and checks

Baskets hold quantities. Parking leaves stock available to other customers. Fresh and chilled lots expiring today are discounted by 25%. Unit prices are rounded to the nearest fen. Expired lots cannot be sold. A receipt freezes the batch and paid unit price. A sealed, in-date return goes to the original lot. Opened or expired returned units are isolated. Net cash is sales less refunds and excludes any opening float. An IndexedDB transaction saves the receipt and all movements together. A revision check rejects stale writes in another tab.

## Source

- `src/register.js` — product catalogue, batches, baskets, sales, refunds and shift arithmetic
- `src/persistence.js` — IndexedDB transaction and revision guard
- `src/view.js`, `page.html`, `style.css` — register interface
- `src/*.jpg` — generated product illustrations used in the catalogue
- `test/register.test.js` — run with `node --test test/register.test.js` (Node 18+)
- `build.py` — regenerate the portable HTML with Python 3

One local business date and one shared till are assumed. Retail authentication, cloud backup and physical cash-drawer integration are outside this prototype.
