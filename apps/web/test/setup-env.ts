process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://veltrix:veltrix@localhost:5432/veltrix_test?schema=public";
process.env.BCRYPT_COST = "4";
process.env.APP_URL = "http://localhost:3000";
process.env.AI_PROVIDER = "none";
process.env.MARKET_DATA_PROVIDER = "demo";
