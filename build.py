"""Build the offline register. Requires Python 3, no extra packages."""
import base64
import json
from pathlib import Path

root = Path(__file__).resolve().parent
src = root / 'src'
photos = {p.stem: 'data:image/jpeg;base64,' + base64.b64encode(p.read_bytes()).decode()
          for p in sorted(src.glob('*.jpg'))}
view = (src / 'view.js').read_text().replace('/* PHOTOS */ {}', json.dumps(photos))
page = (src / 'page.html').read_text()
for marker, content in [('STYLES', (src / 'style.css').read_text()),
                        ('DOMAIN', (src / 'register.js').read_text()),
                        ('STORE', (src / 'persistence.js').read_text()), ('VIEW', view)]:
    page = page.replace('/* ' + marker + ' */', content)
(root / 'index.html').write_text(page, encoding='utf-8')
