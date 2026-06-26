// Single server-only entry point for the database. Importing "./env" first guarantees
// DATABASE_URL is loaded before the shared db client evaluates (it throws otherwise).
import "./env";

export * from "@prompt-battle/db";
