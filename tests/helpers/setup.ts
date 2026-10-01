// Defaults for every test run. Integration tests point MONGODB_URI at an in-memory server,
// so no test ever touches the real database. Live tests set a real GEMINI_API_KEY themselves.
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:1/unused";
process.env.MONGODB_DB ??= "mailmind_test";
process.env.GEMINI_API_KEY ??= "test-key-not-used";
process.env.LOG_LEVEL ??= "warn";
process.env.GOOGLE_CLIENT_ID ??= "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET ??= "test-client-secret";
