<script lang="ts">
    import { onMount } from "svelte";

    let challenge = "";
    let consentRequest: any = undefined;

    onMount(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        challenge = urlParams.get("consent_challenge") || "";
        const res = await fetch(`/consent?consent_challenge=${challenge}`);
        const data = await res.json();
        console.log(data);
        if (!data.message) {
            consentRequest = data;
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
        <p class="text-gray-600">
            <span class="font-medium"
                >{consentRequest.clientName || "This application"}</span
            > is requesting access to the following scopes:
        </p>
        {#if consentRequest.scopes}
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
