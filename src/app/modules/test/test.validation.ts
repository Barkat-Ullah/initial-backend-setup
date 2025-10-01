import { z } from "zod";

const createTestZodSchema = z.object({
  body: z.object({
  
    name: z.string({ required_error: "Name is required" }),
  }),
});

const updateTestZodSchema = z.object({
  body: z.object({
    name: z.string().optional(),
  }),
});

export const TestValidation = {
  createTestZodSchema,
  updateTestZodSchema,
};
