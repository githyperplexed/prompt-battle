import { customAlphabet } from "nanoid";

// Alphanumeric-only ids (no `-` / `_`). Keeps ~nanoid-level entropy at 21 chars while ensuring an id
// never starts with a hyphen — which would otherwise read as a flag in CLI argument parsing.
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const newId = customAlphabet(ALPHABET, 21);
