Adventure Builder W80 — Outdoor Skills Smart Camera + Navigation Polish

COPY INTO THE CLEAN GITHUB REPOSITORY ONLY.

Website files changed:
1. outdoor-skills.html
2. css/outdoor-knowledge.css
3. js/outdoor-knowledge.js

The README is instructions only; do not commit it.

W80 changes:
- Centres the Outdoor Skills introduction, general-guide notice and main navigation.
- Removes Personal Outdoor Notes and Foraging Log from this page.
- Gives the five main guide tabs distinct, restrained colour accents.
- Adds Smart Camera / Identify: Take a photo or Choose a photo.
- Camera/gallery works on supported browsers/devices via the normal file/camera picker.
- Identification is deliberately confirmation-based and connects to the existing guide popups.
- Strong warning retained: a photo match is never proof that something is safe to eat, handle or collect.
- Existing W79.2 popup system, foraging safety lock, fishing/coastal content and exact scientific-name reference-photo lookup are retained.

Important architecture note:
This W80 website build implements the complete camera/gallery UI and safe guide-matching workflow without pretending the browser alone has a trained visual-recognition model. A future server/API vision recogniser can plug into this same Smart Camera workspace without redesigning the page.
