import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

const openrouter = createOpenRouter({ apiKey });

export const model = (slug: string) => openrouter(slug);
