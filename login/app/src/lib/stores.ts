import { writable } from "svelte/store";

export interface User {
    id: string;
    email: string;
    name: string;
    username: string;
    avatar: string;
}

export const user = writable<User | null>(null);
export const token = writable<string | null>(null);
