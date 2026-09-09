/**
 * Where an element came from, as an attribute name.
 *
 * Its own module because both sides need it and they cannot share a file: the
 * plugin that writes the attribute runs in Node and imports Babel, and pulling
 * that into the viewer's bundle breaks the page — Babel reaches for `process`,
 * which a browser does not have.
 */
export const LOC_ATTR = 'data-odf-loc';
