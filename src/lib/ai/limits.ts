// Size limits of a flashcard proposal. They mirror the database checks
// (see 20261110221827_flashcard_key_folding.sql) and are shared by generation, the accept request and the UI.
export const MAX_WORD_CHARS = 100;
export const MAX_TEXT_CHARS = 500;
export const MAX_MEANINGS = 10;
export const MAX_MEANINGS_CHARS = 2000;
export const MAX_TAG_CHARS = 50;
export const MAX_SET_ITEMS = 150;
