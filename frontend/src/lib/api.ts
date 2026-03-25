export function apiBaseUrl() {
    return import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';
}

export function apiUrl(path: string) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${apiBaseUrl()}${normalizedPath}`;
}
