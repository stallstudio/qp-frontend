export interface ShowSchedule {
  startTime: string;
  endTime?: string | null;
}

export interface ShowTime {
  showName: string;
  duration: number;
  schedules: ShowSchedule[];
  /**
   * Événement saisonnier dont ce spectacle fait partie. `null` pour la
   * quasi-totalité de la programmation.
   *
   * ⚠️ Même règle que `WaitTime.eventId` : un spectacle tagué n'apparaît QUE
   * dans la carte de son événement, jamais dans la timeline principale.
   *
   * ⚠️ La raison est ici plus dure qu'un simple choix de rangement : mélanger
   * des représentations nocturnes dans la timeline du jour ÉTIRE L'AXE de ~10 h
   * à ~15 h d'amplitude et écrase toutes les représentations de journée. Deux
   * grilles, deux axes.
   */
  eventId: number | null;
}
