// @level domain
// Roadkeeper — a page script's embedded client code: each function a client module exports, by its own source.

// The functions `client` exports, each by its own source, one after another.
export const functionSources = (client) => Object.values(client).map((f) => f.toString()).join("\n");
