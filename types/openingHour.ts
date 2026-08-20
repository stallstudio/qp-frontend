export interface OpeningHour {
  date: string;
  type: string;
  openTime?: string | null;
  closeTime?: string | null;
  /**
   * Nom à afficher à la place du libellé traduit du `type` (« Traumatica »
   * plutôt que « Horaires étendus »). Vient de la source, donc NON TRADUIT.
   * Absent sur la quasi-totalité des lignes.
   */
  label?: string | null;
  /** Événement saisonnier dont cette ligne est une session. */
  eventId?: number | null;
}
