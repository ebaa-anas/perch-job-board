import { z } from "zod";

/**
 * Zod contracts for the auth forms. These are shared between the client forms
 * (React Hook Form resolver) and the Server Actions, so keep them free of any
 * server-only imports.
 */

export const AUTH_ROLES = ["seeker", "recruiter"] as const;
export type AuthRole = (typeof AUTH_ROLES)[number];

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
  fullName: z.string().trim().min(2, "Tell us your name"),
  role: z.enum(AUTH_ROLES, {
    error: "Choose whether you're looking for work or hiring",
  }),
});
export type SignUpValues = z.infer<typeof signUpSchema>;

export const resetRequestSchema = z.object({
  email: z.email("Enter a valid email address"),
});
export type ResetRequestValues = z.infer<typeof resetRequestSchema>;

export const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string().min(1, "Re-enter your new password"),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
