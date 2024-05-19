<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from "$app/navigation";

    let challenge = "";

    onMount(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        challenge = urlParams.get('logout_challenge') || "";
    });

    const handleLogout = async (accept) => {
        const res = await fetch('/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ logout_challenge: challenge, accept }),
        });

        if (res.ok) {
            const { redirect_to } = await res.json();
            goto(redirect_to);
        } else {
            console.log("Logout failed");
        }
    };
</script>

<main class="flex h-screen bg-gray-100">
    <div class="m-auto w-96">
        <h1 class="mb-4">Logout</h1>
        <p class="mb-4">Do you really want to log out?</p>
        <button class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                on:click={() => handleLogout(true)}>
            Yes
        </button>
        <button class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                on:click={() => handleLogout(false)}>
            No
        </button>
    </div>
</main>
