// Public endpoint only. Room credentials never belong in this configuration.
export const API_URL = import.meta.env.VITE_API_URL || 'https://kurzfilm-bewertung-api.patrick-fischer.workers.dev/api/rooms';
export function roomLink(token:string){return `${location.origin}${import.meta.env.BASE_URL}#${token}`;}
