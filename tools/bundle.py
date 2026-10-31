# Bundles the game into one self-contained HTML file (for publishing it as a claude.ai Artifact):
# the page's body, the stylesheet and every script, inlined in the order index.html loads them.
#   python3 tools/bundle.py . /path/to/fire-run.html
import re, sys
root, out = sys.argv[1], sys.argv[2]
html = open(root + '/index.html').read()
head_links = re.findall(r'  <link rel="(?:preconnect|stylesheet)" href="https://fonts[^>]*>\n', html)
css = open(root + '/css/style.css').read()
body = re.search(r'<body>\n(.*?)  <script src', html, re.S).group(1)
scripts = re.findall(r'<script src="([^"]+)"></script>', html)
parts = ['<title>Fire Run</title>\n'] + [l.strip() + '\n' for l in head_links]
parts.append('<style>\n:root { color-scheme: dark; }\nbody { padding-inline: 0; }\n' + css + '</style>\n\n')
parts.append(body)
for src in scripts: parts.append('  <script>\n' + open(root + '/' + src.split('?')[0]).read() + '</script>\n')
open(out, 'w').write(''.join(parts))
