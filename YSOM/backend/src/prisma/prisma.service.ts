import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

function createDatabaseAdapter(): PrismaMariaDb {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set before starting the YSOM API.");
  }

  const databaseUrl = new URL(connectionString);
  if (databaseUrl.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use the mysql: protocol.");
  }
  const database = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ""));
  if (!database) {
    throw new Error("DATABASE_URL must specify a database name.");
  }

  return new PrismaMariaDb({
    host: databaseUrl.hostname,
    port: Number(databaseUrl.port || 3306),
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database,
    connectionLimit: 5,
  });
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({ adapter: createDatabaseAdapter() });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
