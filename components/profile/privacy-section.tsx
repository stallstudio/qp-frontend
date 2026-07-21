"use client";

import { useState } from "react";
import axios from "axios";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Download,
  Loader2,
  Mail,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUser } from "@/components/providers/user-provider";

// Section « Confidentialité » du profil (conformité RGPD / CNIL) : rectification
// de l'e-mail (déconnexion ensuite), portabilité (export JSON), effacement du
// compte (confirmation par saisie de l'e-mail). Rendu SANS carte (surface = carte
// à onglets du profil).
export default function PrivacySection() {
  const t = useTranslations("privacy");
  const { profile } = useUser();
  const currentEmail = profile?.email ?? "";

  const [email, setEmail] = useState(currentEmail);
  const [savingEmail, setSavingEmail] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const emailChanged =
    email.trim().length > 0 &&
    email.trim().toLowerCase() !== currentEmail.toLowerCase();

  const changeEmail = async () => {
    setSavingEmail(true);
    try {
      await axios.post("/api/user/email", { email: email.trim() });
      toast.success(t("emailChangedSignOut"));
      // L'e-mail est l'identité de connexion : on déconnecte pour ré-authentifier.
      setTimeout(() => signOut({ callbackUrl: "/" }), 1200);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        toast.error(t("emailTaken"));
      } else if (axios.isAxiosError(err) && err.response?.status === 400) {
        toast.error(t("emailInvalid"));
      } else {
        toast.error(t("genericError"));
      }
      setSavingEmail(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const res = await axios.get("/api/user/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "queue-park-data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("genericError"));
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await axios.delete("/api/user/account", {
        data: { confirm: deleteConfirm.trim() },
      });
      toast.success(t("accountDeleted"));
      setTimeout(() => signOut({ callbackUrl: "/" }), 800);
    } catch {
      toast.error(t("genericError"));
      setDeleting(false);
    }
  };

  const confirmMatches =
    deleteConfirm.trim().toLowerCase() === currentEmail.toLowerCase();

  return (
    <div className="flex flex-col gap-2.5">
      {/* Modification de l'e-mail : mini-carte (libellé + champ + note). */}
      <div className="flex flex-col gap-2 rounded-xl border px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Mail className="size-4 text-muted-foreground" />
          {t("emailLabel")}
        </span>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="sm:flex-1"
          />
          <Button
            onClick={changeEmail}
            disabled={!emailChanged || savingEmail}
            className="sm:w-auto"
          >
            {savingEmail && <Loader2 className="size-4 animate-spin" />}
            {t("emailSave")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("emailNote")}</p>
      </div>

      {/* Export des données : même gabarit (libellé à gauche, action à droite). */}
      <div className="flex flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Download className="size-4 text-muted-foreground" />
          {t("exportLabel")}
        </span>
        <Button
          variant="outline"
          onClick={exportData}
          disabled={exporting}
          className="w-full sm:w-56"
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {t("exportButton")}
        </Button>
      </div>

      {/* Suppression du compte : même gabarit, bordure d'accent destructive. */}
      <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium text-destructive">
            <ShieldAlert className="size-4" />
            {t("deleteLabel")}
          </span>
          <p className="mt-1 text-xs text-muted-foreground">{t("deleteNote")}</p>
        </div>
        <Button
          variant="destructive"
          onClick={() => {
            setDeleteConfirm("");
            setDeleteOpen(true);
          }}
          className="w-full shrink-0 sm:w-auto"
        >
          <Trash2 className="size-4" />
          {t("deleteButton")}
        </Button>
      </div>

      {/* Popup de confirmation : saisir l'e-mail du compte pour valider. */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteConfirmDescription", { email: currentEmail })}
            </DialogDescription>
          </DialogHeader>
          <Input
            type="email"
            autoComplete="off"
            placeholder={currentEmail}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={deleteAccount}
              disabled={!confirmMatches || deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {t("deleteConfirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
