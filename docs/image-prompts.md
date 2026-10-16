# Изображения для «Тихого адреса»

## Дополнительный каталог локаций

Пять резервных изображений созданы встроенным ImageGen отдельными запросами. Общая формулировка: “One standalone photorealistic handcrafted architectural miniature diorama matching a refined ghost relocation bureau. Entire building fully visible, three-quarter view, compact base, actual transparent alpha background. Natural cream stone, muted sage greenery, soft studio light, highly detailed materials. Square high-resolution image. No people, text, labels or watermark.”

- `greenhouse.png` — Оранжерея туманов: an antique glass greenhouse conservatory with misty glass panes, lush ferns and a small stone foundation.
- `clocktower.png` — Часовая башня: a slender old stone clock tower with a large clock face, slate roof and a visible attic dormer.
- `manor.png` — Лесная усадьба: a secluded timber manor house with a visible attic, mossy roof, small porch and two pine trees.
- `observatory.png` — Забытая обсерватория: a historic stone observatory with a weathered copper dome and a visible telescope through the open dome.
- `watermill.png` — Водяная мельница: an old timber and stone watermill with a large wooden water wheel, attic dormer and a tiny stream on its compact base.

Фактический размер всех пяти файлов — 1254×1254 RGBA. Они хранятся в `public/images/`, но не входят в исходные места переселения. Форма предлагает только ещё не использованные изображения.

Инструмент: встроенный ImageGen в Codex. Все изображения синтетические; это иллюстрации персонажей и архитектурные миниатюры, не фотографии реальных объектов. Каждый файл генерируется отдельно. Исходные PNG с альфа-каналом сохраняются в `public/images/`.

Общий запрос для персонажей: “One isolated friendly fictional ghost character portrait, full floating body, expressive face, charming polished storybook 3D illustration. High-quality square website asset. Whole subject centered, soft studio light, muted cream sage natural palette. Actual transparent alpha background. No text, no watermark.”

Общий запрос для мест: “One isolated realistic architectural miniature diorama. High-quality square website asset. Whole subject centered, soft studio light, muted cream sage natural palette. Actual transparent alpha background. No text, no watermark.”

Конкретные персонажи и места:

- `ghost-01.png`: Agatha, a pale mint ghost lady with expressive worried eyes and a tiny vintage bonnet
- `ghost-02.png`: Felix, a friendly pearl-white scholarly ghost with round glasses and a little bow tie
- `ghost-03.png`: Martha, a misty blue ghost lady with wavy flowing hair and a calm face
- `ghost-04.png`: Leopold, a warm ivory ghost gentleman with a curled moustache and theatrical eyebrows
- `ghost-05.png`: Edgar, a pale blue shy ghost with large anxious eyes and a floppy nightcap
- `ghost-06.png`: Bella, a lilac-tinted friendly ghost lady with a small ribbon and surprised eyes
- `ghost-07.png`: a curious pale sage ghost with freckles and a tiny leaf-shaped hat
- `ghost-08.png`: a cheerful ivory ghost with bushy eyebrows and a knitted scarf
- `ghost-09.png`: a dreamy pale aqua ghost with sleepy eyes and a little crescent-shaped hair curl
- `ghost-10.png`: a friendly pearly peach ghost with short curly wisps and a tiny bowler hat
- `castle.png`: an old romantic stone castle with a clearly visible attic, slate roofs and turrets
- `lighthouse.png`: a weathered coastal lighthouse with a lantern room and a small keeper house on a rock
- `library.png`: a historic library building shown as an architectural cutaway revealing warm bookshelves and reading tables
- `theatre.png`: an abandoned historic theatre shown as an architectural cutaway revealing stage and faded red curtains
- `cellar.png`: an old printing-house cellar shown as an architectural cutaway with brick vaults and a vintage printing press

У первой Агаты уточнялись vintage bonnet, wispy spectral body и target 1024×1024. Фактическое разрешение зависит от результата генератора; проверяется через `npm run check:assets`.

Первый пакет прервался после отклонения одного результата системой генерации. Недостающие изображения запрошены отдельно с короткими описаниями. В приложении используется только завершённый набор.
