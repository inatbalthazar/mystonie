/** A catalog (TMDB, AniList, Google Books) failed or isn't set up. `status` is what our route answers. */
export class CatalogError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
