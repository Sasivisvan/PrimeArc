export function apiBaseUrl() {
    // If not Vercel production and VITE_API_URL isn't explicitly set, default to localhost
    if (import.meta.env.MODE === 'development' && !import.meta.env.VITE_API_URL) {
        return 'http://localhost:5000';
    }
    return import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';
}

export function apiUrl(path: string) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${apiBaseUrl()}${normalizedPath}`;
}
