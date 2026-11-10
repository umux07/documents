export interface AuthenticatedUser {
  id: string;
  email: string;
  createdAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: AuthenticatedUser;
    }
  }
}
