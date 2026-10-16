"""Prepare owner-authorized text units locally. Never commits or uploads paid text.

Input is a PRIVATE JSON list of {bookId,title,sourcePath}; only public metadata
is written beside the ignored payloads. A changed edition gets a new SHA-256 pin.
"""
import argparse
import hashlib
import json
import os
import pathlib
import posixpath
import re
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile

AUTHORIZED = {
    'the-maha-principle': 'The Maha Principle', 'the-orbital-mind': 'The Orbital Mind',
    'the-imagined-life': 'The Imagined Life', 'the-volcanic-engine': 'The Volcanic Engine',
    'the-synthetic-self': 'The Synthetic Self', 'the-unfinished-species': 'The Unfinished Species',
    'the-cosmic-recursion': 'The Cosmic Recursion', 'the-borrowed-light': 'The Borrowed Light',
    'the-material-floor': 'The Material Floor',
}
LIMIT = 45000
FORMAT = ('Text-only EPUB spine reading units. Long units split at paragraph boundaries with part numbers. '
          'Images, styling, scripts and navigation widgets are not delivered.')

def sha(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()

def tag(element):
    return element.tag.rsplit('}', 1)[-1].lower()

def paragraphs(element):
    if tag(element) in {'script', 'style', 'nav', 'svg', 'head', 'noscript'}:
        return []
    if tag(element) in {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'pre'}:
        return [re.sub(r'\s+', ' ', ''.join(element.itertext())).strip()]
    return [text for child in element for text in paragraphs(child)]

def split_units(blocks):
    chunks, current = [], ''
    for block in blocks:
        # A single unusually long paragraph is split at word boundaries first.
        pieces, part = [], ''
        for word in block.split():
            if len(word.encode()) > LIMIT:
                raise ValueError('Unbounded single token; manual source review needed')
            candidate = (part + ' ' + word).strip()
            if len(candidate.encode()) > LIMIT:
                pieces.append(part)
                part = word
            else:
                part = candidate
        if part:
            pieces.append(part)
        for piece in pieces:
            candidate = (current + '\n\n' + piece).strip()
            if len(candidate.encode()) > LIMIT:
                chunks.append(current)
                current = piece
            else:
                current = candidate
    if current:
        chunks.append(current)
    return chunks

def prepare(source):
    book_id = source['bookId']
    if book_id not in AUTHORIZED or source['title'] != AUTHORIZED[book_id]:
        raise ValueError('Book outside the nine owner-authorized editions')
    path = pathlib.Path(source['sourcePath'])
    raw = path.read_bytes()
    sections = []
    with zipfile.ZipFile(path) as archive:
        if sum(item.file_size for item in archive.infolist()) > 60_000_000:
            raise ValueError('Oversized EPUB')
        container = ET.fromstring(archive.read('META-INF/container.xml'))
        opf = next(e.attrib['full-path'] for e in container.iter() if tag(e) == 'rootfile')
        package = ET.fromstring(archive.read(opf))
        manifest = {e.attrib['id']: e.attrib for e in package.iter() if tag(e) == 'item'}
        for spine_index, ref in enumerate(e for e in package.iter() if tag(e) == 'itemref'):
            item = manifest[ref.attrib['idref']]
            if item.get('media-type') != 'application/xhtml+xml' or 'nav' in item.get('properties', '').split():
                continue
            name = posixpath.normpath(posixpath.join(posixpath.dirname(opf), urllib.parse.unquote(item['href'])))
            if name.startswith('../') or name.startswith('/'):
                raise ValueError('Invalid EPUB spine path')
            document = ET.fromstring(archive.read(name))
            body = next((e for e in document.iter() if tag(e) == 'body'), None)
            if body is None:
                continue
            blocks = [p for p in paragraphs(body) if p]
            if not blocks:
                continue
            heading = next((re.sub(r'\s+', ' ', ''.join(e.itertext())).strip() for e in body.iter()
                            if tag(e) in {'h1', 'h2', 'h3'}), AUTHORIZED[book_id])[:300]
            parts = split_units(blocks)
            for index, text in enumerate(parts):
                sections.append({'id': f'unit-{spine_index + 1:03d}-part-{index + 1}', 'title': heading,
                                 'spineIndex': spine_index, 'part': index + 1, 'parts': len(parts),
                                 'content': text, 'contentSha256': sha(text.encode()), 'utf8Bytes': len(text.encode())})
    if not sections:
        raise ValueError('No readable EPUB sections')
    return {'version': 'maha-epub-reading-units/1', 'bookId': book_id, 'title': AUTHORIZED[book_id],
            'editionDigest': sha(raw), 'editionBasis': 'selected-local-epub/1', 'formatNote': FORMAT,
            'sourceModified': path.stat().st_mtime, 'sections': sections}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--private-manifest', required=True)
    args = parser.parse_args()
    sources = json.loads(pathlib.Path(args.private_manifest).read_text())
    if len(sources) != 9 or {s['bookId'] for s in sources} != set(AUTHORIZED):
        raise ValueError('Exactly nine authorized books required')
    prepared = [prepare(source) for source in sources]
    destination = pathlib.Path('content/api-v1-books')
    destination.mkdir(parents=True, exist_ok=True)
    metadata = []
    for book in prepared:
        path = destination / (book['bookId'] + '.json')
        path.write_text(json.dumps(book, ensure_ascii=False, indent=2) + '\n')
        os.chmod(path, 0o600)
        metadata.append({**book, 'sections': [{k: v for k, v in s.items() if k != 'content'} for s in book['sections']]})
    (destination / 'metadata.json').write_text(json.dumps({'books': metadata, 'excluded': ['the-mayon-paradox'],
        'sourceSelectionReviewRequiredBeforeDeployment': False}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'booksPrepared': len(prepared), 'readingUnits': sum(len(b['sections']) for b in prepared),
                      'paidTextPubliclyWritten': False, 'supabaseCalls': 0}))

if __name__ == '__main__':
    main()
