import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";

export const SESSION_COOKIE_NAME = "ysom_session";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token !== "string" || token.length < 40) {
      throw new UnauthorizedException("Please sign in to continue.");
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      select: {
        expiresAt: true,
        user: { select: { id: true, email: true, createdAt: true } },
      },
    });

    if (!session || session.expiresAt <= new Date()) {
      throw new UnauthorizedException("Please sign in to continue.");
    }

    request.authenticatedUser = session.user;
    return true;
  }
}
