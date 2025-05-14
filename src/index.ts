// Define types for the application
interface MovieItem {
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

interface SearchResponse {
  Search: MovieItem[];
  totalResults: string;
  Response: string;
  Error?: string;
}

interface StreamApiResponse {
  data?: {
    link?: string;
    streamUrl?: string;
    stream?: string;
    url?: string;
    playlist?: PlaylistItem[];
    key?: string;
  }
}

interface PlaylistItem {
  title: string;
  file: string;
  folder?: any[];
}

// API configuration - Please replace these with environment variables in production
const config = {
  omdbApiKey: 'def5d1fe', // Replace this with process.env.OMDB_API_KEY in production
  streamApiBaseUrl: 'https://eightstreamapi-wwfa.onrender.com'
};

class ApiService {
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

class MovieApp {
  // DOM elements
  private resultsEl: HTMLElement;
  private favResultsEl: HTMLElement;
  private modal: HTMLElement;
  private closeBtn: HTMLElement;
  private optionsEl: HTMLElement;
  private videoEl: HTMLVideoElement;
  private errorMsg: HTMLElement;
  private searchInput: HTMLInputElement;
  private searchBtn: HTMLElement;
  private advancedToggle: HTMLElement;
  private advancedOptions: HTMLElement;
  private typeFilter: HTMLSelectElement;
  private yearFilter: HTMLInputElement;
  private pageFilter: HTMLInputElement;
  private applyFilters: HTMLElement;
  private infoModal: HTMLElement;
  private infoContent: HTMLElement;
  private closeInfoBtn: HTMLElement;
  private infoBody: HTMLElement;
  private downloadBtn: HTMLElement; // New download button

  // Current stream data
  private currentStreamUrl: string = '';
  private currentMovieTitle: string = '';

  // HLS player
  private hls: any = null; // Type would be Hls, but we're loading from CDN

  // API Service
  private apiService: ApiService;
  
  constructor() {
    this.apiService = new ApiService();
    
    // Initialize DOM elements
    this.resultsEl = document.getElementById('results') as HTMLElement;
    this.favResultsEl = document.getElementById('favResults') as HTMLElement;
    this.modal = document.getElementById('playerModal') as HTMLElement;
    this.closeBtn = document.getElementById('closeBtn') as HTMLElement;
    this.optionsEl = document.getElementById('options') as HTMLElement;
    this.videoEl = document.getElementById('video') as HTMLVideoElement;
    this.errorMsg = document.getElementById('errorMsg') as HTMLElement;
    this.searchInput = document.getElementById('searchInput') as HTMLInputElement;
    this.searchBtn = document.getElementById('searchBtn') as HTMLElement;
    this.advancedToggle = document.getElementById('advancedToggle') as HTMLElement;
    this.advancedOptions = document.getElementById('advancedOptions') as HTMLElement;
    this.typeFilter = document.getElementById('typeFilter') as HTMLSelectElement;
    this.yearFilter = document.getElementById('yearFilter') as HTMLInputElement;
    this.pageFilter = document.getElementById('pageFilter') as HTMLInputElement;
    this.applyFilters = document.getElementById('applyFilters') as HTMLElement;
    this.infoModal = document.getElementById('infoModal') as HTMLElement;
    this.infoContent = document.getElementById('infoContent') as HTMLElement;
    this.closeInfoBtn = document.getElementById('closeInfoBtn') as HTMLElement;
    this.infoBody = document.getElementById('infoBody') as HTMLElement;
    this.downloadBtn = document.getElementById('downloadBtn') as HTMLElement;
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load initial content
    this.loadInitialContent();
  }
  
  private setupEventListeners(): void {
    // Search
    this.searchBtn.addEventListener('click', () => this.triggerSearch());
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.triggerSearch();
    });
    
    // Advanced options
    let advancedOpen = false;
    this.advancedToggle.onclick = () => {
      advancedOpen = !advancedOpen;
      this.advancedOptions.style.display = advancedOpen ? 'block' : 'none';
      this.advancedToggle.textContent = advancedOpen ? 'Hide' : 'Advanced';
    };
    this.applyFilters.onclick = () => this.triggerSearch();
    
    // Modal close
    this.closeBtn.addEventListener('click', () => {
      this.modal.style.display = 'none';
      this.videoEl.pause();
    });
    window.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.modal.style.display = 'none';
        this.videoEl.pause();
      }
    });
    
    // Download button
    this.downloadBtn.addEventListener('click', () => this.downloadCurrentVideo());
    
    // Info modal close
    this.closeInfoBtn.onclick = () => {
      this.infoModal.style.display = 'none';
    };
    window.addEventListener('click', (e) => {
      if (e.target === this.infoModal) this.infoModal.style.display = 'none';
    });
    
    // Scroll navigation
    document.querySelectorAll('.scroll-btn').forEach((btn) => {
      btn.addEventListener('click', function(this: HTMLElement) {
        const targetId = this.getAttribute('data-target') as string;
        const container = document.getElementById(targetId) as HTMLElement;
        const scrollAmount = this.classList.contains('scroll-left') ? -300 : 300;
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      });
    });
  }
  
  // Create poster element with fallback for missing images
  private createPosterElement(item: MovieItem): string {
    if (item.Poster && item.Poster !== 'N/A') {
      return `<img src="${item.Poster}" alt="${item.Title}">`;
    } else {
      return `<div class="default-poster">
               <div>
                 <i class="fas fa-film"></i>
                 <div class="poster-text">${item.Title}</div>
               </div>
             </div>`;
    }
  }
  
  // Create movie card element
  private createMovieCard(item: MovieItem): HTMLElement {
    const card = document.createElement('div'); 
    card.className = 'card';
    
    // Create genre display (limit to first genre)
    const genres = item.Genre ? item.Genre.split(',')[0] : '';
    
    card.innerHTML = `
      ${this.createPosterElement(item)}
      ${item.imdbRating && item.imdbRating !== 'N/A' ? 
        `<div class="rating-badge"><i class="fas fa-star"></i> ${item.imdbRating}</div>` : ''}
      <div class="card-body">
        <h3 class="card-title">${item.Title}</h3>
        <div class="card-details">
          <span class="card-year"><i class="far fa-calendar-alt"></i> ${item.Year}</span>
          ${item.Runtime && item.Runtime !== 'N/A' ? 
            `<span class="card-year"><i class="far fa-clock"></i> ${item.Runtime}</span>` : ''}
        </div>
        ${genres ? `<div class="card-genre">${genres}</div>` : ''}
        <div class="card-actions">
          <button class="info-btn" data-id="${item.imdbID}">More Info</button>
          <button class="fav-btn${this.isFavorited(item.imdbID) ? ' favorited' : ''}" data-id="${item.imdbID}">${this.isFavorited(item.imdbID) ? '★' : '☆'}</button>
        </div>
      </div>`;
      
    card.addEventListener('click', (e) => {
      // only open stream if not clicking on info/fav
      if ((e.target as HTMLElement).classList.contains('fav-btn') || 
          (e.target as HTMLElement).classList.contains('info-btn')) return;
      
      this.currentMovieTitle = item.Title; // Store the title for download
      this.onCardClick(item.imdbID);
    });
    
    const favBtn = card.querySelector('.fav-btn') as HTMLElement;
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFavorite(item);
      favBtn.className = this.isFavorited(item.imdbID) ? 'fav-btn favorited' : 'fav-btn';
      favBtn.innerHTML = this.isFavorited(item.imdbID) ? '★' : '☆';
      this.renderFavorites();
    });
    
    const infoBtn = card.querySelector('.info-btn') as HTMLElement;
    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showInfo(item.imdbID);
    });
    
    return card;
  }
  
  // Search functions
  private triggerSearch(): void {
    const q = this.searchInput.value.trim();
    if (!q) return;
    this.searchMovies(q);
  }
  
  private async searchMovies(q: string): Promise<void> {
    this.resultsEl.innerHTML = '';
    const type = this.typeFilter.value;
    const year = this.yearFilter.value;
    const page = this.pageFilter.value;
    
    try {
      const movies = await this.apiService.searchMovies(q, type, year, page);
      this.renderResults(movies);
    } catch (error: any) {
      this.resultsEl.innerHTML = `<p class="error">${error.message || 'Search failed'}</p>`;
    }
  }
  
  private renderResults(list: MovieItem[]): void {
    this.resultsEl.innerHTML = '';
    list.forEach(item => {
      this.resultsEl.appendChild(this.createMovieCard(item));
    });
  }
  
  // Favorites functions
  private getFavorites(): MovieItem[] {
    return JSON.parse(localStorage.getItem('favorites-movies') || '[]');
  }
  
  private setFavorites(list: MovieItem[]): void {
    localStorage.setItem('favorites-movies', JSON.stringify(list));
  }
  
  private isFavorited(id: string): boolean {
    return this.getFavorites().some(fav => fav.imdbID === id);
  }
  
  private toggleFavorite(item: MovieItem): void {
    let favs = this.getFavorites();
    if (this.isFavorited(item.imdbID)) {
      favs = favs.filter(fav => fav.imdbID !== item.imdbID);
    } else {
      favs.unshift(item);
    }
    this.setFavorites(favs);
  }
  
  private renderFavorites(): void {
    const favs = this.getFavorites();
    this.favResultsEl.innerHTML = '';
    
    if (!favs.length) {
      this.favResultsEl.innerHTML = `<div class="no-favs">No favorites yet. Click "Favorite" on a card to save!</div>`;
      return;
    }
    
    // Get detailed info for favorites if needed
    const detailPromises = favs.map(item => {
      // If we already have detailed info, just use it
      if (item.imdbRating) return Promise.resolve(item);
      
      // Otherwise fetch details
      return this.apiService.getMovieDetails(item.imdbID);
    });
    
    Promise.all(detailPromises)
      .then(detailedFavs => {
        detailedFavs.forEach(item => {
          this.favResultsEl.appendChild(this.createMovieCard(item));
        });
      })
      .catch(err => {
        this.favResultsEl.innerHTML = `<div class="no-favs">Error loading favorite details</div>`;
      });
  }
  
  // Info modal
  private async showInfo(imdbID: string): Promise<void> {
    this.infoBody.innerHTML = 'Loading...';
    this.infoModal.style.display = 'flex';
    
    try {
      const data = await this.apiService.getMovieDetails(imdbID);
      
      this.infoBody.innerHTML = `
        <h3>${data.Title} (${data.Year})</h3>
        <div class="meta">
          ${data.Type ? data.Type.charAt(0).toUpperCase() + data.Type.slice(1) : ''} | 
          ${data.Rated || ''} | 
          ${data.Genre || ''} | 
          ${data.Runtime || ''}
          ${data.imdbRating !== 'N/A' ? ` | <i class="fas fa-star" style="color:var(--accent)"></i> ${data.imdbRating}` : ''}
        </div>
        <div class="plot">${data.Plot || ''}</div>
        <div><b>Director:</b> ${data.Director || 'N/A'}</div>
        <div><b>Actors:</b> ${data.Actors || 'N/A'}</div>
        ${data.Awards !== 'N/A' ? `<div><b>Awards:</b> ${data.Awards}</div>` : ''}
        ${data.BoxOffice !== 'N/A' && data.BoxOffice ? `<div><b>Box Office:</b> ${data.BoxOffice}</div>` : ''}
      `;
    } catch (error) {
      this.infoBody.innerHTML = "Failed to load information.";
    }
  }
  
  // Streaming functions
  private async onCardClick(id: string): Promise<void> {
    this.errorMsg.textContent = '';
    this.optionsEl.innerHTML = '';
    this.downloadBtn.style.display = 'none'; // Hide download button until stream is ready
    if (this.hls) { this.hls.destroy(); this.hls = null; }
    this.videoEl.pause(); this.videoEl.removeAttribute('src'); this.videoEl.load();
    this.modal.style.display = 'flex';

    try {
      const json = await this.apiService.getMediaInfo(id);
      const data = json.data || {};

      // Determine if series: any playlist entry with a 'folder' array
      const isSeries = Array.isArray(data.playlist) &&
        data.playlist.some(p => Array.isArray(p.folder));

      if (isSeries && data.playlist && data.key) {
        this.renderSeriesOptions(data.playlist, data.key);
      } else {
        // Movie: playlist or direct link
        const movieItems = Array.isArray(data.playlist)
          ? data.playlist.map(item => ({ title: item.title, file: item.file }))
          : [{ title: 'Default', file: data.link || '' }];
          
        if (data.key && movieItems[0].file) {
          this.playLanguage(movieItems[0].file, data.key);
          this.renderMovieLanguages(movieItems, data.key);
        }
      }
    } catch (e: any) {
      this.errorMsg.textContent = e.message || 'Error loading media';
    }
  }
  
  private renderMovieLanguages(list: PlaylistItem[], key: string): void {
    this.optionsEl.innerHTML = '';
    list.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'lang-btn';
      btn.textContent = item.title;
      btn.addEventListener('click', () => this.playLanguage(item.file, key));
      this.optionsEl.appendChild(btn);
    });
  }
  
  private renderSeriesOptions(pl: PlaylistItem[], key: string): void {
    this.optionsEl.innerHTML = '';
    const seasonSel = document.createElement('select'); 
    seasonSel.innerHTML = '<option>Season</option>';
    
    const episodeSel = document.createElement('select'); 
    episodeSel.innerHTML = '<option>Episode</option>';
    
    const langSel = document.createElement('select'); 
    langSel.innerHTML = '<option>Language</option>';

    pl.forEach((s, i) => seasonSel.add(new Option(s.title, i.toString())));
    
    seasonSel.addEventListener('change', () => {
      episodeSel.innerHTML = '<option>Episode</option>';
      langSel.innerHTML = '<option>Language</option>';
      const season = pl[parseInt(seasonSel.value)] || {};
      (season.folder || []).forEach((ep: any, idx: number) => 
        episodeSel.add(new Option(ep.title, idx.toString()))
      );
    });
    
    episodeSel.addEventListener('change', () => {
      langSel.innerHTML = '<option>Language</option>';
      const season = pl[parseInt(seasonSel.value)] || {};
      const ep = (season.folder || [])[parseInt(episodeSel.value)] || {};
      (ep.folder || []).forEach((lang: any) => 
        langSel.add(new Option(lang.title, JSON.stringify({ file: lang.file, key })))
      );
    });
    
    langSel.addEventListener('change', () => {
      const obj = JSON.parse(langSel.value);
      this.playLanguage(obj.file, obj.key);
    });
    
    this.optionsEl.append(seasonSel, episodeSel, langSel);
  }
  
  private async playLanguage(file: string, key: string): Promise<void> {
    this.errorMsg.textContent = '';
    try {
      const url = await this.apiService.getStreamUrl(file, key);
      this.currentStreamUrl = url; // Store current URL for download
      this.loadStream(url);
      this.downloadBtn.style.display = 'block'; // Show download button when stream is ready
    } catch (e: any) {
      this.errorMsg.textContent = e.message || 'Error loading stream';
    }
  }
  
  private loadStream(url: string): void {
    if (this.hls) { this.hls.destroy(); this.hls = null; }
    this.videoEl.pause(); this.videoEl.removeAttribute('src'); this.videoEl.load();
    
    // @ts-ignore: Hls is loaded from CDN
    if (Hls.isSupported()) {
      // @ts-ignore: Hls is loaded from CDN
      this.hls = new Hls();
      this.hls.loadSource(url);
      this.hls.attachMedia(this.videoEl);
      this.hls.on(Hls.Events.MANIFEST_PARSED, () => this.videoEl.play());
    } else if (this.videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      this.videoEl.src = url;
      this.videoEl.addEventListener('loadedmetadata', () => this.videoEl.play());
    } else {
      this.errorMsg.textContent = 'HLS not supported in this browser';
    }
  }
  
  // Download function
  private downloadCurrentVideo(): void {
    if (!this.currentStreamUrl) {
      this.errorMsg.textContent = 'No stream available to download';
      return;
    }
    
    // Create a download link
    const a = document.createElement('a');
    a.href = this.currentStreamUrl;
    a.download = `${this.currentMovieTitle || 'movie'}.mp4`; // Use the movie title for the download
    
    // Some browsers require the link to be in the DOM
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
  }
  
  // Initial content loaders
  private async loadMoviesBySearch(
    containerId: string, 
    searchTerm: string, 
    year: string = '', 
    type: string = 'movie', 
    count: number = 15
  ): Promise<void> {
    const container = document.getElementById(containerId) as HTMLElement;
    container.innerHTML = '<div class="loading-container"><div class="loader"></div></div>';
    
    try {
      let movies = await this.apiService.searchMovies(searchTerm, type, year);
      movies = movies.slice(0, count); // Limit to requested count
      
      container.innerHTML = '';
      movies.forEach(item => {
        container.appendChild(this.createMovieCard(item));
      });
    } catch (error) {
      container.innerHTML = `<p class="error">Failed to load content</p>`;
    }
  }
  
  private loadInitialContent(): void {
    const currentYear = new Date().getFullYear().toString();
    
    // Latest Movies
    this.loadMoviesBySearch('latestMovies', 'movie', currentYear, 'movie', 15);
    
    // Latest Web Series
    this.loadMoviesBySearch('latestSeries', 'series', currentYear, 'series', 15);
    
    // Trending Movies
    this.loadMoviesBySearch('trendingMovies', 'avengers', '', 'movie', 15);
    
    // Action Movies
    this.loadMoviesBySearch('actionMovies', 'action', '', 'movie', 15);
    
    // Render favorites
    this.renderFavorites();
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new MovieApp();
});