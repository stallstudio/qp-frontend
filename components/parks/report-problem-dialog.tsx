"use client";

import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Bug } from "lucide-react";

type LocalizedString = {
  [locale: string]: string;
};

type ProblemCategory = {
  id: string;
  label: LocalizedString;
  subcategories: {
    id: string;
    label: LocalizedString;
    detailsText?: LocalizedString;
  }[];
};

const problemCategories: ProblemCategory[] = [
  {
    id: "wait-time",
    label: {
      fr: "Temps d'attente",
      en: "Wait Time",
    },
    subcategories: [
      {
        id: "incorrect-wait-time",
        label: {
          fr: "Temps d'attente incorrect pour une ou plusieurs attractions",
          en: "Incorrect wait time for one or more attractions",
        },
      },
      {
        id: "incorrect-status",
        label: {
          fr: "Statut incorrect pour une ou plusieurs attractions",
          en: "Incorrect status for one or more attractions",
        },
      },
      {
        id: "missing-attractions",
        label: {
          fr: "Une ou plusieurs attractions manquantes",
          en: "One or more missing attractions",
        },
      },
      {
        id: "not-updating",
        label: {
          fr: "Les temps d'attente ne se mettent pas à jour",
          en: "Wait times are not updating",
        },
      },
      {
        id: "other",
        label: {
          fr: "Autre",
          en: "Other",
        },
      },
    ],
  },
  {
    id: "shows",
    label: {
      fr: "Spectacles",
      en: "Shows",
    },
    subcategories: [
      {
        id: "missing-shows",
        label: {
          fr: "Spectacles manquants dans la programmation du jour",
          en: "Missing shows in today's schedule",
        },
      },
      {
        id: "missing-showtimes",
        label: {
          fr: "Créneaux horaires manquants pour un spectacle",
          en: "Missing showtimes for a show",
        },
      },
      {
        id: "incorrect-duration",
        label: {
          fr: "Durée incorrecte d'un spectacle",
          en: "Incorrect duration of a show",
        },
      },
      {
        id: "other",
        label: {
          fr: "Autre",
          en: "Other",
        },
      },
    ],
  },
  {
    id: "schedules",
    label: {
      fr: "Horaires d'ouverture",
      en: "Opening Hours",
    },
    subcategories: [
      {
        id: "park-closed-but-open",
        label: {
          fr: "Le parc apparaît comme fermé alors qu'il est ouvert",
          en: "Park appears as closed when it is open",
        },
      },
      {
        id: "incorrect-hours",
        label: {
          fr: "Horaires du jour incorrects",
          en: "Incorrect hours for today",
        },
      },
      {
        id: "incorrect-timezone",
        label: {
          fr: "Heure locale incorrecte",
          en: "Incorrect local time",
        },
      },
      {
        id: "missing-special-hours",
        label: {
          fr: "Horaires spéciaux manquants (accès anticipé, extension, etc.)",
          en: "Missing special hours (early access, extended hours, etc.)",
        },
      },
      {
        id: "other",
        label: {
          fr: "Autre",
          en: "Other",
        },
      },
    ],
  },
  {
    id: "other",
    label: {
      fr: "Autres",
      en: "Other",
    },
    subcategories: [
      {
        id: "global-issue",
        label: {
          fr: "Problème global",
          en: "Global issue",
        },
      },
      {
        id: "display-issue",
        label: {
          fr: "Problème d'affichage",
          en: "Display issue",
        },
      },
      {
        id: "incorrect-data",
        label: {
          fr: "Données erronées",
          en: "Incorrect data",
        },
      },
      {
        id: "specific-request",
        label: {
          fr: "Demande spécifique",
          en: "Specific request",
        },
      },
      {
        id: "other",
        label: {
          fr: "Autre",
          en: "Other",
        },
      },
    ],
  },
];

type ReportProblemDialogProps = {
  parkIdentifier: string;
};

export default function ReportProblemDialog({
  parkIdentifier,
}: ReportProblemDialogProps) {
  const t = useTranslations("reportProblem");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const getLocalizedString = (localizedString: LocalizedString): string => {
    return localizedString[locale] || localizedString.en || "";
  };

  const selectedCategoryData = problemCategories.find(
    (cat) => cat.id === selectedCategory,
  );

  const selectedSubcategoryData = selectedCategoryData?.subcategories.find(
    (sub) => sub.id === selectedSubcategory,
  );

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setSelectedSubcategory("");
    setDetails("");
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await axios.post("/api/report", {
        parkIdentifier,
        category: selectedCategory,
        subcategory: selectedSubcategory,
        details,
      });
      toast.success(t("success"));
      setOpen(false);
      setSelectedCategory("");
      setSelectedSubcategory("");
      setDetails("");
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(false);
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
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="category">{t("categoryLabel")}</Label>
            <Select
              value={selectedCategory}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder={t("categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {problemCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {getLocalizedString(category.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCategory && selectedCategoryData && (
            <div className="grid gap-2">
              <Label htmlFor="subcategory">{t("subcategoryLabel")}</Label>
              <Select
                value={selectedSubcategory}
                onValueChange={setSelectedSubcategory}
              >
                <SelectTrigger id="subcategory" className="w-full">
                  <SelectValue placeholder={t("subcategoryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {selectedCategoryData.subcategories.map((subcategory) => (
                    <SelectItem key={subcategory.id} value={subcategory.id}>
                      {getLocalizedString(subcategory.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedSubcategory && selectedSubcategoryData && (
            <div className="grid gap-2">
              <Label htmlFor="details">{t("detailsLabel")}</Label>
              <Textarea
                id="details"
                placeholder={t("detailsPlaceholder")}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !selectedCategory ||
              !selectedSubcategory ||
              !details.trim() ||
              loading
            }
          >
            {t("submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
