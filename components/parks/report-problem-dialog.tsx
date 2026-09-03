"use client";

import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { AlertTriangle, Bug, Mail } from "lucide-react";
import { PROBLEM_CATEGORIES } from "@/lib/report-config";
import { useUser } from "@/components/providers/user-provider";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";

type LocalizedString = {
  [locale: string]: string;
};

type ReportProblemDialogProps = {
  parkIdentifier: string;
};

export default function ReportProblemDialog({
  parkIdentifier,
}: ReportProblemDialogProps) {
  const t = useTranslations("reportProblem");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  // Connecté : l'e-mail n'est plus demandé — c'est celui du compte qui est
  // transmis (résolu côté serveur depuis la session, jamais depuis le client).
  const { isAuthenticated } = useUser();

  const formSchema = z
    .object({
      category: z.string().min(1, { message: t("validation.categoryRequired") }),
      subcategory: z
        .string()
        .min(1, { message: t("validation.subcategoryRequired") }),
      details: z.string().min(10, { message: t("validation.detailsRequired") }),
      email: z.string(),
      // Honeypot : invisible pour un humain, rempli par les robots (voir plus
      // bas). Jamais validé — le serveur se contente d'ignorer la requête.
      website: z.string(),
    })
    // L'e-mail n'est obligatoire que pour un visiteur non connecté : le champ
    // n'étant plus rendu quand on a un compte, il ne doit pas bloquer l'envoi.
    .superRefine((values, ctx) => {
      if (isAuthenticated) return;
      if (!z.string().email().safeParse(values.email).success) {
        ctx.addIssue({
          code: "custom",
          path: ["email"],
          message: t("validation.emailRequired"),
        });
      }
    });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: "",
      subcategory: "",
      details: "",
      email: "",
      website: "",
    },
  });

  const getLocalizedString = (localizedString: LocalizedString): string => {
    return localizedString[locale] || localizedString.en || "";
  };

  const selectedCategory = form.watch("category");
  const selectedSubcategory = form.watch("subcategory");

  const selectedCategoryData = PROBLEM_CATEGORIES.find(
    (cat) => cat.id === selectedCategory,
  );

  const selectedSubcategoryData = selectedCategoryData?.subcategories.find(
    (sub) => sub.id === selectedSubcategory,
  );

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await axios.post("/api/report", {
        parkIdentifier,
        category: values.category,
        subcategory: values.subcategory,
        details: values.details,
        // Connecté : rien n'est envoyé, le serveur lit l'e-mail de la session.
        ...(isAuthenticated ? {} : { email: values.email }),
        website: values.website,
        locale,
      });
      toast.success(t("success"));
      setOpen(false);
      form.reset();
    } catch (error) {
      // 429 : message explicite plutôt que « une erreur est survenue », qui
      // pousserait l'utilisateur à réessayer en boucle.
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        toast.error(t("rateLimited"));
        return;
      }
      toast.error(t("error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-fit rounded-full">
          <Bug />
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("categoryLabel")}</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("subcategory", "");
                      form.setValue("details", "");
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full max-w-full truncate">
                        <SelectValue placeholder={t("categoryPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PROBLEM_CATEGORIES.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {getLocalizedString(category.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedCategory && selectedCategoryData && (
              <FormField
                control={form.control}
                name="subcategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("subcategoryLabel")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full max-w-full truncate">
                          <SelectValue
                            placeholder={t("subcategoryPlaceholder")}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectedCategoryData.subcategories.map(
                          (subcategory) => (
                            <SelectItem
                              key={subcategory.id}
                              value={subcategory.id}
                            >
                              {getLocalizedString(subcategory.label)}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {selectedSubcategory && selectedSubcategoryData && (
              <>
                {selectedSubcategoryData.alert && (
                  <Alert className="text-amber-300">
                    <AlertTriangle />
                    <AlertDescription className="text-amber-300">
                      {getLocalizedString(selectedSubcategoryData.alert)}
                    </AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="details"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("detailsLabel")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("detailsPlaceholder")}
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isAuthenticated ? (
                  // Compte connecté : ni champ ni saisie — juste l'information
                  // que l'e-mail du compte accompagnera le signalement.
                  <p className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    <Mail className="mt-0.5 size-4 shrink-0" />
                    {t("emailAccountNotice")}
                  </p>
                ) : (
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("emailLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="john.doe@mail.com"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t("emailDescription")}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}

            {/* Honeypot : hors écran et hors tabulation, donc invisible pour un
                humain comme pour un lecteur d'écran. Les robots qui remplissent
                tous les champs d'un formulaire se trahissent en le renseignant. */}
            <div aria-hidden className="absolute left-[-9999px] opacity-0">
              <label htmlFor="report-website">Website</label>
              <input
                id="report-website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                {...form.register("website")}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {t("submit")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
