import type { NextFunction, Request, Response } from 'express';

const crypto = require("crypto");
const path = require("path");
const express = require("express");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");

const parseTrustProxy = (value: unknown) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized || ["0", "false", "off", "no"].includes(normalized)) {
        return false;
    }
    if (["1", "true", "on", "yes"].includes(normalized)) {
        return 1;
    }

    const numericValue = Number(normalized);
    if (Number.isInteger(numericValue) && numericValue >= 0) {
        return numericValue;
    }

    return value;
};

const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const incomingRequestId = req.headers["x-request-id"];
    req.requestId = typeof incomingRequestId === "string" && incomingRequestId.trim()
        ? incomingRequestId.trim()
        : crypto.randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
};

const configureCoreMiddleware = (app: any): void => {
    const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
    app.set("trust proxy", trustProxy);

    app.use(compression({
        level: 7,
        threshold: 512,
        filter: (req: Request, res: Response) => {
            if (req.headers["x-no-compression"]) {
                return false;
            }
            return compression.filter(req, res);
        },
        chunkSize: 16 * 1024,
        windowBits: 15,
        memLevel: 8,
    }));

    app.use(express.json({
        limit: "3mb",
        strict: false,
        type: "application/json",
        verify: undefined,
    }));

    app.use(express.urlencoded({
        extended: true,
        limit: "3mb",
        parameterLimit: 300,
        verify: undefined,
    }));

    app.use(cookieParser());
    app.use(requestIdMiddleware);
};

const configureSecurityMiddleware = (app: any): void => {
    app.use(
        cors({
            origin: [
                process.env.LOCALHOST,
                process.env.MY_HOST
            ],
            credentials: true,
            exposedHeaders: [
                "X-New-Token",
                "X-New-Refresh-Token"
            ],
        })
    );

    app.use(helmet({
        contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "https:"],
                scriptSrc: ["'self'"],
                connectSrc: ["'self'"],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: [],
            },
        } : false,
        hsts: process.env.NODE_ENV === "production" ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        } : false,
        noSniff: true,
        xssFilter: true,
        referrerPolicy: { policy: "strict-origin-when-cross-origin" }
    }));
};

const mountStaticAssets = (app: any): void => {
    app.use("/uploads/images", express.static(path.join(__dirname, "..", "uploads", "images"), {
        dotfiles: "deny",
        immutable: true,
        index: false,
        maxAge: "1y"
    }));
};

module.exports = {
    configureCoreMiddleware,
    configureSecurityMiddleware,
    mountStaticAssets,
    parseTrustProxy
};
