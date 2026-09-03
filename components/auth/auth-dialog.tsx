"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useTranslations } from "next-intl";
import { MailCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { GoogleIcon } from "./google-icon";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Popup d'authentification sans mot de passe : Google OU magic link par email.
// Connexion et inscription sont un SEUL et même flux (le lien crée le compte s'il
// n'existe pas) : on n'affiche donc qu'une entrée unique, au libellé neutre.
export default function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const t = useTranslations("auth");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const formSchema = z.object({
    email: z.string().email({ message: t("emailInvalid") }),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  // Réinitialise l'état interne à chaque ouverture.
  useEffect(() => {
    if (open) {
      setSentTo(null);
      setGoogleLoading(false);
      form.reset();
    }
  }, [open, form]);

  const callbackUrl =
    typeof window !== "undefined" ? window.location.href : "/";

  const handleGoogle = () => {
    setGoogleLoading(true);
    signIn("google", { callbackUrl });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const result = await signIn("resend", {
      email: values.email,
      redirect: false,
      callbackUrl,
    });
    if (result?.error) {
      form.setError("email", { message: t("sendError") });
      return;
    }
    setSentTo(values.email);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        {sentTo ? (
          // État « email envoyé ».
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="size-6 text-primary" />
            </div>
            <DialogHeader className="items-center sm:text-center">
              <DialogTitle>{t("emailSentTitle")}</DialogTitle>
              <DialogDescription>
                {t("emailSentDescription", { email: sentTo })}
              </DialogDescription>
            </DialogHeader>
            <Button
              variant="ghost"
              className="mt-2"
              onClick={() => setSentTo(null)}
            >
              {t("useAnotherEmail")}
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("subtitle")}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogle}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <GoogleIcon className="size-4" />
                )}
                {t("continueWithGoogle")}
              </Button>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {t("or")}
                <span className="h-px flex-1 bg-border" />
              </div>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="flex flex-col gap-3"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="email"
                            autoComplete="email"
                            placeholder={t("emailPlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting && (
                      <Loader2 className="animate-spin" />
                    )}
                    {t("sendMagicLink")}
                  </Button>
                </form>
              </Form>

              <p className="text-center text-xs text-muted-foreground">
                {t("noPassword")}
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
