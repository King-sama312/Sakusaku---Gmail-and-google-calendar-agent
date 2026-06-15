import {CookieOptions, Response, Request} from "express"
import { TRPCContext } from "../context"
import { env } from "@repo/services/env"

const isProduction = env.NODE_ENV === "prod"

const deafultCookieOptions : CookieOptions = {
    path:"/",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: env.SESSION_DURATION_MS,
    domain: env.COOKIE_DOMAIN || undefined,
}

export function createCookieFactory(res:Response){
    return function createCookie(name:string, value:string, opts:CookieOptions = deafultCookieOptions) {
        res.cookie(name ,value, opts)
    }
}

export function getCookieFactory(req: Request){
    return function getCookie(name: string){
        return req.cookies?.[name]
    }
}

export function clearCookieFactory (res:Response){
    return function clearCookie(name:string){
        res.clearCookie(name, {
            path: "/",
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            domain: env.COOKIE_DOMAIN || undefined,
            httpOnly: true,
        })
    }
}

export function setAuthenticationCookie(ctx:TRPCContext, accessToken:string){
    ctx.createCookie(env.AUTH_COOKIE_NAME, accessToken)
}

export function getAuthenticationCookie(ctx:TRPCContext){
    return ctx.getCookie(env.AUTH_COOKIE_NAME)
}
export function clearAuthenticationCookie(ctx:TRPCContext, ){
    ctx.clearCookie(env.AUTH_COOKIE_NAME)
}