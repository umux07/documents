import "dotenv/config";
import "reflect-metadata";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";

const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  });
  app.use(
    (request: Request, response: Response, next: NextFunction) => {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
        if (
          !request.headers.origin ||
          !allowedOrigins.includes(request.headers.origin)
        ) {
          response
            .status(403)
            .json({ message: "Request origin is not allowed." });
          return;
        }
      }
      next();
    },
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number.parseInt(process.env.PORT ?? "4000", 10);
  await app.listen(port, "127.0.0.1");
  console.log(`YSOM API is listening on http://127.0.0.1:${port}/api/v1`);
}

void bootstrap();
