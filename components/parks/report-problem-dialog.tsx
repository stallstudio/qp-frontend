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
import { AlertTriangle, Bug } from "lucide-react";
import { PROBLEM_CATEGORIES } from "@/lib/report-config";
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

  const formSchema = z.object({
    category: z.string().min(1, { message: t("validation.categoryRequired") }),
    subcategory: z
      .string()
      .min(1, { message: t("validation.subcategoryRequired") }),
    details: z.string().min(10, { message: t("validation.detailsRequired") }),
    email: z.string().email({ message: t("validation.emailRequired") }),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: "",
      subcategory: "",
      details: "",
      email: "",
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
        email: values.email,
        locale,
      });
      toast.success(t("success"));
      setOpen(false);
      form.reset();
    } catch {
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
                      <FormDescription>{t("emailDescription")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

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
