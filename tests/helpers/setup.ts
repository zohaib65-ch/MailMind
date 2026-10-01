// Defaults for every test run. Integration tests point MONGODB_URI at an in-memory server.
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:1/unused";
process.env.MONGODB_DB ??= "mailmind_test";
process.env.ANTHROPIC_API_KEY ??= "test-key-not-used";
process.env.EMBEDDINGS_PROVIDER ??= "mock";
process.env.LOG_LEVEL ??= "warn";
process.env.MOCK_EMAIL_MODE ??= "true";
