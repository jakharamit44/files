// Define types for the application

// Movie/Series item from OMDB API
export interface MovieItem {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
  Plot?: string;
  imdbRating?: string;
  Runtime?: string;
  Genre?: string;
  Director?: string;
  Actors?: string;
  Awards?: string;
  BoxOffice?: string;
  Rated?: string;
}

// Search response from OMDB API
export interface SearchResponse {
  Search: MovieItem[];
  totalResults: string;
  Response: string;
  Error?: string;
}

// Stream API Response
export interface StreamApiResponse {
  data?: {
    link?: string;
    streamUrl?: string;
    stream?: string;
    url?: string;
    playlist?: PlaylistItem[];
    key?: string;
  }
}

export interface PlaylistItem {
  title: string;
  file: string;
  folder?: any[];
}

// Config Interface
export interface AppConfig {
  omdbApiKey: string;
  streamApiBaseUrl: string;
}