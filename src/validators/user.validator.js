import { z } from "zod";

export const registerUserValidator = z.object({

    username:
        z.string().min(3, "Username must be at least 3 characters long")
            .max(20, "Username must not exceed 20 characters")
            .regex(/^[a-zA-Z0-9_]+$/, "Username must only contain letters, numbers, and underscores")
            .trim(),

    email:
        z.string().trim().toLowerCase().email("Invalid email format"),

    password:
        z.string({
            required_error:
                "Password is required"
        }).min(8, "Password must be at least 8 characters long")
            .max(20, "Password must not exceed 20 characters"),
    
    adminkey: 
    z.string().optional()
});

export const loginUserValidator = z.object({
    email:
        z.string().trim().toLowerCase().email("Invalid email format"),

    password:
        z.string({
            required_error:
                "Password is required"
        }).min(8, "Password must be at least 8 characters long")
            .max(20, "Password must not exceed 20 characters"),

    adminkey:
    z.string().optional()
});
