import axios from 'axios';

export const hydraAdmin = axios.create({
    baseURL: 'https://auth.prayujt.com/admin', // Replace with your Hydra admin URL
    headers: {
        'Content-Type': 'application/json',
    },
});
