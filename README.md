# Survey Corps Archive

Attack on Titan fan website for the Web Technologies endterm project.
Group: SE-2540. Team: Assem Tugelbay, Zhansaya Boranbaikyzy, Alina Ibadulla.

The project continues our midterm website with the same topic and five pages.

## Pages

- `index.html` — home, walls and characters.
- `about.html` — story, military branches and commanders.
- `titans.html` — Titan table, search, filters, editing and image gallery.
- `episodes.html` — season cards and episode guides.
- `join.html` — registration form and downloadable fan recruit card.

## Endterm features

- Required name, email, password, confirmation and message fields.
- Email check with RegEx, live error messages and a password strength meter.
- Case-insensitive live search combined with status category buttons.
- A table rendered from JavaScript data: add, view, edit and delete records.
- A confirmation prompt before deleting a record.
- A Bootstrap gallery with a lightbox, Previous/Next buttons and keyboard arrows.
- jQuery `fadeIn()` and `fadeOut()` for the image viewer.
- Simpler shared CSS and responsive layouts for desktop, tablet and mobile.

## Technologies

HTML5, CSS3, Bootstrap 5, JavaScript and jQuery 3.7.1.
Libraries, images and fonts are included locally, so the site also works offline.
Main files: `css/style.css` and `js/script.js`.

## Team responsibilities

The division of pages follows the midterm project:

- Assem Tugelbay — home page, shared header/footer and CSS.
- Zhansaya Boranbaikyzy — lore page, Titan table, search and gallery.
- Alina Ibadulla — episode page, registration form and responsive checks.

## Run and publish

Open `index.html` in a browser. No installation or build is needed.
Table changes last until reload. The registration form has no backend;
passwords, email addresses and messages are not sent or saved.

- Existing repository: https://github.com/asemtygelbaeva-byte/survey-corps-archive
- Website: https://asemtygelbaeva-byte.github.io/survey-corps-archive/

The site is published with GitHub Pages from the existing repository.
Future updates should be committed to the same repository.

## Credits

Images and references are listed in [ASSET_SOURCES.md](ASSET_SOURCES.md).
Attack on Titan belongs to its original rights holders. This is an unofficial student project.
Bootstrap and jQuery use the MIT license; fonts include their OFL license files.
