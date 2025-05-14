import config from './config';
import { MovieItem, SearchResponse, StreamApiResponse } from './types';

export default class ApiService {
  private omdbApiKey: string;
  private streamApiBaseUrl: string;

  constructor() {
    this.omdbApiKey = config.omdbApiKey;
    this.streamApiBaseUrl = config.streamApiBaseUrl;
  }

  // Search movies from OMDB
  async searchMovies(
    query: string, 
    type?: string, 
    year?: string, 
    page?: string
  ): Promise<MovieItem[]> {
    try {
      let url = `https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=${this.omdbApiKey}`;
      if (type) url += `&type=${encodeURIComponent(type)}`;
      if (year) url += `&y=${encodeURIComponent(year)}`;
      if (page) url += `&page=${encodeURIComponent(page)}`;
      
      const res = await fetch(url);
      const data: SearchResponse = await res.json();
      
      if (data.Response === 'True' && data.Search) {
        // Get detailed info for each movie
        const detailPromises = data.Search.map(item => 
          this.getMovieDetails(item.imdbID)
        );
        
        return await Promise.all(detailPromises);
      } else {
        throw new Error(data.Error || 'No results found');
      }
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  // Get detailed movie info
  async getMovieDetails(imdbID: string): Promise<MovieItem> {
    try {
      const res = await fetch(`https://www.omdbapi.com/?i=${imdbID}&apikey=${this.omdbApiKey}`);
      const data = await res.json();
      
      if (data.Response === 'True') {
        return data as MovieItem;
      } else {
        throw new Error(data.Error || 'Movie details not found');
      }
    } catch (error) {
      console.error(`Failed to get details for ${imdbID}:`, error);
      throw error;
    }
  }

  // Get media streaming info
  async getMediaInfo(imdbID: string): Promise<StreamApiResponse> {
    try {
      const res = await fetch(`${this.streamApiBaseUrl}/api/v1/mediaInfo?id=${imdbID}`);
      return await res.json() as StreamApiResponse;
    } catch (error) {
      console.error('Failed to get media info:', error);
      throw error;
    }
  }

  // Get stream URL
  async getStreamUrl(file: string, key: string): Promise<string> {
    try {
      const res = await fetch(`${this.streamApiBaseUrl}/api/v1/getStream`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file, key })
      });
      
      const json = await res.json() as StreamApiResponse;
      const url = json.data?.link || json.data?.streamUrl || json.data?.stream || json.data?.url;
      
      if (!url) throw new Error('No stream URL returned');
      return url;
    } catch (error) {
      console.error('Failed to get stream URL:', error);
      throw error;
    }
  }
}