import { writable } from 'svelte/store';

interface User {
    email: string;
    name: string;
}

export const user = writable<User | null>(null);
export const token = writable<string | null>(null);
