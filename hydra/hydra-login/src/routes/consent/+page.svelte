<!-- src/routes/consent/+page.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from "$app/navigation";

    let challenge = "";
    let scopes = [];

    onMount(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        challenge = urlParams.get('consent_challenge') || "";
        const res = await fetch(`/consent?consent_challenge=${challenge}`);
        const data = await res.json();
        scopes = data.scopes;
    });

    const handleConsent = async (grant) => {
        const res = await fetch('/consent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ consent_challenge: challenge, grant_scope: scopes, remember: grant }),
        });

        // if (res.ok) {
        //     const { redirect_to } = await res.json();
        //     window.location.href = redirect_to;
        // } else {
        //     console.log("Consent failed");
        // }
    };
</script>

<main class="flex h-screen bg-gray-100">
    <div class="m-auto w-96">
        <h1 class="mb-4">Consent</h1>
        <p class="mb-4">The application is requesting access to the following scopes:</p>
        <ul class="mb-4">
            {#each scopes as scope}
                <li>{scope}</li>
            {/each}
        </ul>
        <button class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                on:click={() => handleConsent(true)}>
            Allow
	    </button>
	    <button class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
		    on:click={() => handleConsent(false)}>
		Deny
	    </button>
	</div>
</main>
