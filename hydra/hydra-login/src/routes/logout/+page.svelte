<script lang="ts">
    import { onMount } from "svelte";

    let challenge = "";

    onMount(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        challenge = urlParams.get("logout_challenge") || "";
    });

    const handleLogout = async (accept: boolean) => {
        const res = await fetch("/logout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ logout_challenge: challenge, accept }),
        });

        if (res.ok) {
            const { redirect_to } = await res.json();
            window.location.href = redirect_to;
        } else {
            console.log("Logout failed");
        }
    };
</script>

<main class="flex items-center justify-center min-h-screen bg-gray-100 p-4">
    <div class="w-full max-w-md bg-white rounded-lg shadow-lg p-6 space-y-6">
        <h1 class="text-2xl font-semibold text-gray-800">
            Prayuj Authentication
        </h1>
        <p class="text-gray-600">Do you really want to log out?</p>
        <div class="flex space-x-4">
            <button
                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition-transform transform active:scale-95"
                on:click={() => handleLogout(true)}
            >
                Yes
            </button>
            <button
                class="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 transition-transform transform active:scale-95"
                on:click={() => handleLogout(false)}
            >
                No
            </button>
        </div>
    </div>
</main>
