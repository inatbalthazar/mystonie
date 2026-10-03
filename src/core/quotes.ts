/**
 * Quote of the day (Home, under the date): one short, famous line from a movie a day, the same for everyone, each
 * linking to its movie's page. The lines stay in their original English; only the attribution is translated.
 */

export type MovieQuote = {
  text: string;
  movie: string;
  year: number;
  /** The movie's TMDB id, for `/title/movie/<id>`. */
  tmdbId: string;
};

/** Mixed by era and genre so neighbouring days differ. Keep lines short: a sentence or two at most. */
export const MOVIE_QUOTES: readonly MovieQuote[] = [
  { text: "Here's looking at you, kid.", movie: "Casablanca", year: 1942, tmdbId: "289" },
  { text: "To infinity and beyond!", movie: "Toy Story", year: 1995, tmdbId: "862" },
  { text: "Why so serious?", movie: "The Dark Knight", year: 2008, tmdbId: "155" },
  { text: "Life, uh, finds a way.", movie: "Jurassic Park", year: 1993, tmdbId: "329" },
  { text: "I'm gonna make him an offer he can't refuse.", movie: "The Godfather", year: 1972, tmdbId: "238" },
  { text: "Just keep swimming.", movie: "Finding Nemo", year: 2003, tmdbId: "12" },
  { text: "You're gonna need a bigger boat.", movie: "Jaws", year: 1975, tmdbId: "578" },
  { text: "On Wednesdays we wear pink.", movie: "Mean Girls", year: 2004, tmdbId: "10625" },
  { text: "Fear is the mind-killer.", movie: "Dune", year: 2021, tmdbId: "438631" },
  { text: "May the Force be with you.", movie: "Star Wars", year: 1977, tmdbId: "11" },
  { text: "Anyone can cook.", movie: "Ratatouille", year: 2007, tmdbId: "2062" },
  { text: "Get busy living, or get busy dying.", movie: "The Shawshank Redemption", year: 1994, tmdbId: "278" },
  { text: "I'll be back.", movie: "The Terminator", year: 1984, tmdbId: "218" },
  { text: "You know what kind of plan never fails? No plan at all.", movie: "Parasite", year: 2019, tmdbId: "496243" },
  { text: "Toto, I've a feeling we're not in Kansas anymore.", movie: "The Wizard of Oz", year: 1939, tmdbId: "630" },
  { text: "With great power comes great responsibility.", movie: "Spider-Man", year: 2002, tmdbId: "557" },
  { text: "Roads? Where we're going, we don't need roads.", movie: "Back to the Future", year: 1985, tmdbId: "105" },
  { text: "Adventure is out there!", movie: "Up", year: 2009, tmdbId: "14160" },
  { text: "I see dead people.", movie: "The Sixth Sense", year: 1999, tmdbId: "745" },
  { text: "Are you not entertained?", movie: "Gladiator", year: 2000, tmdbId: "98" },
  { text: "Frankly, my dear, I don't give a damn.", movie: "Gone with the Wind", year: 1939, tmdbId: "770" },
  { text: "You're a wizard, Harry.", movie: "Harry Potter and the Philosopher's Stone", year: 2001, tmdbId: "671" },
  { text: "Not quite my tempo.", movie: "Whiplash", year: 2014, tmdbId: "244786" },
  { text: "There is no spoon.", movie: "The Matrix", year: 1999, tmdbId: "603" },
  { text: "I'll have what she's having.", movie: "When Harry Met Sally...", year: 1989, tmdbId: "639" },
  { text: "Do. Or do not. There is no try.", movie: "The Empire Strikes Back", year: 1980, tmdbId: "1891" },
  { text: "Ogres are like onions.", movie: "Shrek", year: 2001, tmdbId: "808" },
  { text: "Houston, we have a problem.", movie: "Apollo 13", year: 1995, tmdbId: "568" },
  { text: "Please, be kind. Especially when we don't know what's going on.", movie: "Everything Everywhere All at Once", year: 2022, tmdbId: "545611" },
  { text: "Here's Johnny!", movie: "The Shining", year: 1980, tmdbId: "694" },
  { text: "Wakanda forever!", movie: "Black Panther", year: 2018, tmdbId: "284054" },
  { text: "Stupid is as stupid does.", movie: "Forrest Gump", year: 1994, tmdbId: "13" },
  { text: "I'm sorry, Dave. I'm afraid I can't do that.", movie: "2001: A Space Odyssey", year: 1968, tmdbId: "62" },
  { text: "No capes!", movie: "The Incredibles", year: 2004, tmdbId: "9806" },
  { text: "You talkin' to me?", movie: "Taxi Driver", year: 1976, tmdbId: "103" },
  { text: "One does not simply walk into Mordor.", movie: "The Lord of the Rings: The Fellowship of the Ring", year: 2001, tmdbId: "120" },
  { text: "It's not your fault.", movie: "Good Will Hunting", year: 1997, tmdbId: "489" },
  { text: "Hasta la vista, baby.", movie: "Terminator 2: Judgment Day", year: 1991, tmdbId: "280" },
  { text: "Nobody puts Baby in a corner.", movie: "Dirty Dancing", year: 1987, tmdbId: "88" },
  { text: "I am Iron Man.", movie: "Iron Man", year: 2008, tmdbId: "1726" },
  { text: "Life moves pretty fast.", movie: "Ferris Bueller's Day Off", year: 1986, tmdbId: "9377" },
  { text: "There is no secret ingredient.", movie: "Kung Fu Panda", year: 2008, tmdbId: "9502" },
  { text: "All those moments will be lost in time, like tears in rain.", movie: "Blade Runner", year: 1982, tmdbId: "78" },
  { text: "Some people are worth melting for.", movie: "Frozen", year: 2013, tmdbId: "109445" },
  { text: "You can't handle the truth!", movie: "A Few Good Men", year: 1992, tmdbId: "881" },
  { text: "Oh, what a day! What a lovely day!", movie: "Mad Max: Fury Road", year: 2015, tmdbId: "76341" },
  { text: "Rosebud.", movie: "Citizen Kane", year: 1941, tmdbId: "15" },
  { text: "Keep the change, ya filthy animal.", movie: "Home Alone", year: 1990, tmdbId: "771" },
  { text: "Show me the money!", movie: "Jerry Maguire", year: 1996, tmdbId: "9390" },
  { text: "We used to look up at the sky and wonder at our place in the stars.", movie: "Interstellar", year: 2014, tmdbId: "157336" },
  { text: "Snakes. Why'd it have to be snakes?", movie: "Raiders of the Lost Ark", year: 1981, tmdbId: "85" },
  { text: "As if!", movie: "Clueless", year: 1995, tmdbId: "9603" },
  { text: "The first rule of Fight Club is: you do not talk about Fight Club.", movie: "Fight Club", year: 1999, tmdbId: "550" },
  { text: "I love you 3000.", movie: "Avengers: Endgame", year: 2019, tmdbId: "299534" },
  { text: "Well, nobody's perfect.", movie: "Some Like It Hot", year: 1959, tmdbId: "239" },
  { text: "Carpe diem. Seize the day, boys. Make your lives extraordinary.", movie: "Dead Poets Society", year: 1989, tmdbId: "207" },
  { text: "I feel the need... the need for speed!", movie: "Top Gun", year: 1986, tmdbId: "744" },
  { text: "Remember who you are.", movie: "The Lion King", year: 1994, tmdbId: "8587" },
  { text: "Ooh, that's a bingo!", movie: "Inglourious Basterds", year: 2009, tmdbId: "16869" },
  { text: "If you build it, he will come.", movie: "Field of Dreams", year: 1989, tmdbId: "2323" },
  { text: "Why do we fall, Bruce? So we can learn to pick ourselves up.", movie: "Batman Begins", year: 2005, tmdbId: "272" },
  { text: "There's no crying in baseball!", movie: "A League of Their Own", year: 1992, tmdbId: "11287" },
  { text: "E.T. phone home.", movie: "E.T. the Extra-Terrestrial", year: 1982, tmdbId: "601" },
  { text: "This is Sparta!", movie: "300", year: 2006, tmdbId: "1271" },
  { text: "You mustn't be afraid to dream a little bigger, darling.", movie: "Inception", year: 2010, tmdbId: "27205" },
  { text: "What we've got here is failure to communicate.", movie: "Cool Hand Luke", year: 1967, tmdbId: "903" },
  { text: "Hello. My name is Inigo Montoya. You killed my father. Prepare to die.", movie: "The Princess Bride", year: 1987, tmdbId: "2493" },
  { text: "I'm the king of the world!", movie: "Titanic", year: 1997, tmdbId: "597" },
  { text: "The Dude abides.", movie: "The Big Lebowski", year: 1998, tmdbId: "115" },
  { text: "It's not the plane, it's the pilot.", movie: "Top Gun: Maverick", year: 2022, tmdbId: "361743" },
  { text: "A million dollars isn't cool. You know what's cool? A billion dollars.", movie: "The Social Network", year: 2010, tmdbId: "37799" },
  { text: "Say hello to my little friend!", movie: "Scarface", year: 1983, tmdbId: "111" },
  { text: "Smiling's my favorite.", movie: "Elf", year: 2003, tmdbId: "10719" },
  { text: "All right, Mr. DeMille, I'm ready for my close-up.", movie: "Sunset Boulevard", year: 1950, tmdbId: "599" },
  { text: "My precious.", movie: "The Lord of the Rings: The Two Towers", year: 2002, tmdbId: "121" },
  { text: "Get to the chopper!", movie: "Predator", year: 1987, tmdbId: "106" },
  { text: "What if there is no tomorrow? There wasn't one today.", movie: "Groundhog Day", year: 1993, tmdbId: "137" },
  { text: "I love the smell of napalm in the morning.", movie: "Apocalypse Now", year: 1979, tmdbId: "28" },
  { text: "Yo, Adrian!", movie: "Rocky", year: 1976, tmdbId: "1366" },
  { text: "Now I am become Death, the destroyer of worlds.", movie: "Oppenheimer", year: 2023, tmdbId: "872585" },
];

const DAY_MS = 86_400_000;

/** The longest quote: three lines on a 360 px phone, the most Home's header holds with the greeting hidden. */
export const QUOTE_MAX_CHARS = 75;

/**
 * Whether a quote likely fits one line on a 360 px phone, so the greeting under it can stay (ADR 0093). Home then
 * measures the real line count; this is the first guess, for the server's HTML.
 */
export function quoteFitsOneLine(text: string): boolean {
  return text.length <= 28;
}

/** The quote for a local day (`YYYY-MM-DD`): the list in order, one a day, starting over at the end. */
export function quoteOfTheDay(day: string, quotes: readonly MovieQuote[] = MOVIE_QUOTES): MovieQuote {
  const days = Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
  const n = quotes.length;
  return quotes[(((Number.isNaN(days) ? 0 : days) % n) + n) % n]!;
}
