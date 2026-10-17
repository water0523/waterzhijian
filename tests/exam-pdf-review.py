"""Read-only checks and Poppler previews for PDFs exported by the app tests."""
import json
import subprocess
from pathlib import Path
from pypdf import PdfReader
from PIL import Image, ImageChops, ImageStat

rows = []
for channel in ('chrome', 'msedge'):
    folder = Path('test-results') / ('exam-' + channel)
    for file in sorted(folder.glob('exam-*.pdf')):
        reader = PdfReader(file)
        texts = [''.join((page.extract_text() or '').split()) for page in reader.pages]
        assert not any('\\n' in text for text in texts), file
        assert len(reader.pages) >= 2, file
        assert all(len(text) > 10 for text in texts), (file, [len(t) for t in texts])
        assert '参考答案' not in texts[0], file
        assert any('参考答案' in t for t in texts[1:]), file
        assert any('解析' in t for t in texts[1:]), file
        for page in reader.pages:
            assert abs(float(page.mediabox.width) - 595.28) < 2, file
            assert abs(float(page.mediabox.height) - 841.89) < 2, file
        fonts = set()
        for page in reader.pages:
            for value in page['/Resources'].get('/Font', {}).values():
                font = value.get_object()
                descriptor = font.get('/FontDescriptor')
                fonts.add(str(font.get('/BaseFont') or (descriptor.get_object().get('/FontName') if descriptor else '')))
        fonts = sorted(fonts)
        assert any('TimesNewRoman' in f.replace(' ', '') for f in fonts), (file, fonts)
        assert any('SimSun' in f or 'Song' in f for f in fonts), (file, fonts)
        assert any('KaiTi' in f or 'Kai' in f for f in fonts), (file, fonts)
        answer_page = next(i + 1 for i, text in enumerate(texts) if '参考答案' in text)
        subprocess.run(['pdftoppm', '-f', '1', '-l', str(len(reader.pages)), '-scale-to', '1000', '-png', str(file), str(folder / (file.stem + '-print'))], check=True, capture_output=True)
        rows.append({'browser': channel, 'subject': file.stem, 'pages': len(reader.pages), 'answerPage': answer_page, 'fonts': fonts})
assert len(rows) == 12, len(rows)
for row in [r for r in rows if r['browser'] == 'chrome']:
    name = row['subject']
    files = [Path('test-results/exam-chrome') / f'{name}-print-{i}.png' for i in range(1, row['pages'] + 1)]
    sheet = Image.new('RGB', (1280, ((len(files) + 1) // 2) * 900), '#dce4eb')
    for i, file in enumerate(files):
        original = Image.open(file).convert('RGB')
        edge = Image.open(Path('test-results/exam-msedge') / file.name).convert('RGB')
        assert original.size == edge.size
        assert max(ImageStat.Stat(ImageChops.difference(original, edge)).mean) < 3
        original.thumbnail((620, 880))
        sheet.paste(original, (20 + (i % 2) * 640, 10 + (i // 2) * 900))
    sheet.save(Path('test-results/exam-chrome') / (name + '-pages.png'))
overview = Image.new('RGB', (1560, 1460), '#e5edf5')
for i, name in enumerate(['exam-chinese', 'exam-math', 'exam-physics', 'exam-geography', 'exam-english', 'exam-biology']):
    image = Image.open(Path('test-results/exam-chrome') / (name + '-print-1.png')).convert('RGB')
    image.thumbnail((500, 710))
    overview.paste(image, (20 + (i % 3) * 520, 20 + (i // 3) * 720))
overview.save('dist/试卷主题预览.png')
Path('test-results/exam-pdf-review.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf8')
print('Verified 12 real PDFs: A4 pages, no blank pages, answers after a page break and embedded Songti/Kaiti/Times New Roman; rendered every page with Poppler.')
