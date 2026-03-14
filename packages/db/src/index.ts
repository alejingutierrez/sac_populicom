import { createMemoryRepository } from "./memory";
import { createPostgresRepository, isDatabaseConfigured } from "./postgres";

export * from "./memory";
export * from "./exploration";
export * from "./enrichments";
export * from "./postgres";
export * from "./seed";
export * from "./types";

const memoryRepository = createMemoryRepository();
const postgresRepository = isDatabaseConfigured()
  ? createPostgresRepository()
  : undefined;

export const getRepository = () => postgresRepository ?? memoryRepository;
