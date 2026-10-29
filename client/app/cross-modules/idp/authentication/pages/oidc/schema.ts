import { z } from "zod";

export const signinFormDefaultValue = {
  username: "",
  password: "",
};

export const signinFormSchema = z.object({
  // zod 4 deprecates `string().email()`. The pipe runs the format check only once the field is
  // non-empty, so an empty field still reports "Email is required" first, as it did on zod 3.
  username: z
    .string()
    .min(1, "Email is required")
    .pipe(z.email("Invalid email format")),
  password: z.string().min(1, "Password is required"),
});
