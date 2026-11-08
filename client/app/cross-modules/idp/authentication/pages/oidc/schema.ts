import { z } from "zod";

export const signinFormDefaultValue = {
  username: "",
  password: "",
};

type Translate = (key: string) => string;

// Built per call so the messages follow the current language.
export const createSigninFormSchema = (t: Translate) =>
  z.object({
    // zod 4 deprecates `string().email()`. The pipe runs the format check only once the field is
    // non-empty, so an empty field still reports "Email is required" first, as it did on zod 3.
    username: z
      .string()
      .min(1, t("SIGNIN_SCHEMA.EMAIL_REQUIRED"))
      .pipe(z.email(t("SIGNIN_SCHEMA.EMAIL_INVALID"))),
    password: z.string().min(1, t("SIGNIN_SCHEMA.PASSWORD_REQUIRED")),
  });

export type SigninFormValues = z.infer<ReturnType<typeof createSigninFormSchema>>;
