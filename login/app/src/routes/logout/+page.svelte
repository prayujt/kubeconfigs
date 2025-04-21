<script lang="ts">
    import { onMount } from "svelte";
    import headshot from "$lib/images/HEADSHOT.jpg";

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

<main class="bg-gray-50">
    <div class="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
        <img class="w-24 h-24 mb-5 rounded-lg" src={headshot} alt="Prayuj" />
        <a href="" class="flex items-center mb-6 text-3xl font-heavy text-gray-900">
            Prayuj Cloud
        </a>
        <div class="w-full bg-white rounded-lg shadow md:mt-0 sm:max-w-md xl:p-0">
            <div class="p-6 space-y-4 md:space-y-6 sm:p-8">
                <p class="text-gray-600">Do you really want to log out?</p>
                <div class="flex space-x-4">
                    <button
                        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-300 transition-transform transform hover:scale-105 active:scale-95"
                        on:click={() => handleLogout(true)}
                    >
                        Yes
                    </button>
                    <button
                        class="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-300 transition-transform transform hover:scale-105 active:scale-95"
                        on:click={() => handleLogout(false)}
                    >
                        No
                    </button>
                </div>
            </div>
        </div>
    </div>
</main>
