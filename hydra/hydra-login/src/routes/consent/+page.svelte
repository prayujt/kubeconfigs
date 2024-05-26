<script lang="ts">
    import { onMount } from "svelte";

    let challenge = "";
    let consentRequest: any = undefined;
    let loading = true;
    let error = false;

    onMount(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        challenge = urlParams.get("consent_challenge") || "";
        try {
            const res = await fetch(`/consent?consent_challenge=${challenge}`);
            const data = await res.json();
            if (!data.message) {
                consentRequest = data;
            } else {
                error = true;
            }
        } catch (e) {
            error = true;
        } finally {
            loading = false;
        }
    });

    const handleConsent = async (granted: boolean) => {
        const res = await fetch("/consent", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                consent_challenge: challenge,
                consentRequest,
                granted,
            }),
        });

        if (!res.ok) {
            throw new Error("Network response was not ok");
        }
        const { redirect_to } = await res.json();
        window.location.href = redirect_to;
    };
</script>

<main class="flex items-center justify-center min-h-screen bg-gray-100 p-4">
    <div class="w-full max-w-md bg-white rounded-lg shadow-lg p-6 space-y-6">
        <h1 class="text-2xl font-semibold text-gray-800">
            Prayuj Authentication
        </h1>
        {#if loading}
            <div class="flex justify-center items-center h-48">
                <div
                    class="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16"
                ></div>
            </div>
        {:else if error || !consentRequest}
            <div class="text-center text-red-600">
                <p class="text-lg font-semibold">
                    Failed to load consent information
                </p>
                <p class="text-gray-600">
                    Please try again later or contact Prayuj himself.
                </p>
            </div>
        {:else}
            <p class="text-gray-600">
                <span class="font-medium">{consentRequest.clientName}</span> is requesting
                access to the following scopes:
            </p>
            <ul class="space-y-2">
                {#each consentRequest.scopes as scope}
                    <li
                        class="flex items-center p-2 bg-gray-100 border border-gray-200 rounded-lg shadow-sm"
                    >
                        <span class="ml-2 text-gray-700">{scope}</span>
                    </li>
                {/each}
            </ul>
            <div class="flex space-x-4">
                <button
                    class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition-transform transform active:scale-95"
                    on:click={() => handleConsent(true)}
                >
                    Allow
                </button>
                <button
                    class="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 transition-transform transform active:scale-95"
                    on:click={() => handleConsent(false)}
                >
                    Deny
                </button>
            </div>
        {/if}
    </div>
</main>

<style>
    .loader {
        border-top-color: #3490dc;
        animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }
</style>
