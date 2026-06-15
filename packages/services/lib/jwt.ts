import jwt from "jsonwebtoken";
import { env } from "../env";

export interface JwtPayload {
  userId: string;
  sessionId: string;
}

const SECRET = env.JWT_SECRET;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export { SEVEN_DAYS_MS };
