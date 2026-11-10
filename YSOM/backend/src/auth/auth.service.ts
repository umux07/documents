import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { hashPassword, verifyPassword } from "./password-hasher";

export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const timingSafeDummyHash = hashPassword(randomBytes(32).toString("hex"));

function sessionTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto): Promise<{
    token: string;
    user: { id: string; email: string; createdAt: Date };
  }> {
    const passwordHash = await hashPassword(dto.password);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const createdUser = await transaction.user.create({
          data: { email: dto.email, passwordHash },
          select: { id: true, email: true, createdAt: true },
        });

        await transaction.session.create({
          data: {
            tokenHash: sessionTokenHash(token),
            userId: createdUser.id,
            expiresAt,
          },
        });
        return createdUser;
      });

      return { token, user };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Unable to create an account with these details.",
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<{
    token: string;
    user: { id: string; email: string; createdAt: Date };
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, passwordHash: true, createdAt: true },
    });
    const expectedHash = user?.passwordHash ?? (await timingSafeDummyHash);
    const passwordIsValid = await verifyPassword(dto.password, expectedHash);

    if (!user || !passwordIsValid) {
      throw new UnauthorizedException("Email or password is incorrect.");
    }

    const token = randomBytes(32).toString("base64url");
    await this.prisma.session.create({
      data: {
        tokenHash: sessionTokenHash(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
      },
    });

    return {
      token,
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
    };
  }

  async revokeSession(token: string | undefined): Promise<void> {
    if (typeof token !== "string" || token.length < 40) {
      return;
    }
    await this.prisma.session.deleteMany({
      where: { tokenHash: sessionTokenHash(token) },
    });
  }
}
