<script lang="ts">
    import { onMount } from "svelte";
    import { type User, user } from "$lib/stores";

    let challenge = "";
    let consentRequest: any = undefined;
    let loading = true;
    let error = false;
    let isLoaded = false;

    onMount(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        challenge = urlParams.get("consent_challenge") || "";
        try {
            const res = await fetch(`/consent?consent_challenge=${challenge}`);
            const data = await res.json();
            console.log("Consent request information:");
            console.log(data);
            if (!data.message) {
                consentRequest = data;
                if (consentRequest.redirect_to)
                    window.location.href = data.redirect_to;
            } else {
                error = true;
            }
        } catch (e) {
            error = true;
        } finally {
            loading = false;
        }
        const response = await fetch(`https://idp.prayujt.com/sessions/whoami`, {
            credentials: 'include',
        });

        const res = await response.json();
        user.set({
            id: res.identity.id,
            name: `${res.identity.traits.firstName} ${res.identity.traits.lastName}`,
            email: res.identity.traits.email,
            username: res.identity.traits.username,
            avatar: res.identity.traits.avatar,
        } as User);
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

<main class="bg-gray-50">
    <div class="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
        {#if $user}
            {#if $user.avatar}
                {#if !isLoaded}
                    <div class="w-24 h-24 rounded-full bg-gray-300 animate-pulse"></div>
                {/if}
                <img
                    class="w-24 h-24 rounded-full transition-opacity duration-100 ease-in-out"
                    src={$user.avatar}
                    alt="User Avatar"
                    on:load={() => isLoaded = true}
                    class:animate-pulse={!isLoaded}
                    style:display={isLoaded ? 'block' : 'none'}
                />
            {:else}
                <div class="flex items-center justify-center bg-gray-300 rounded-full w-24 h-24 text-3xl text-gray-800">
                    {#if $user.name}
                        {#each $user.name.split(" ").slice(0, 2) as part}
                            {part.charAt(0).toUpperCase()}
                        {/each}
                    {/if}
                </div>
            {/if}
            <div class="flex flex-col mt-4 items-center">
                <p class="text-xl">Welcome back</p>
                <h1 class="mb-4 text-2xl font-semibold text-gray-900">
                    {#if $user.name}
                        {$user.name}
                    {:else}
                        {$user.username}
                    {/if}
                </h1>
            </div>
        {/if}

        <a href="" class="flex items-center mb-6 text-3xl font-heavy text-gray-900">
            Prayuj Authentication
        </a>
        <div class="w-full bg-white rounded-lg shadow md:mt-0 sm:max-w-md xl:p-0">
            <div class="p-6 space-y-4 md:space-y-6 sm:p-8">
                {#if loading || (consentRequest && consentRequest.redirect_to)}
                    <div class="flex justify-center items-center h-48">
                        <div class="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16"></div>
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
                        <span class="font-medium">{consentRequest.client.client_name}</span> is requesting access to the following scopes:
                    </p>
                    <ul class="space-y-2">
                        {#each consentRequest.requested_scope as scope}
                            <li class="flex items-center p-2 bg-gray-100 border border-gray-200 rounded-lg shadow-sm">
                                <span class="ml-2 text-gray-700">{scope}</span>
                            </li>
                        {/each}
                    </ul>
                    <div class="flex space-x-4">
                        <button
                            class="w-full flex items-center justify-center text-white bg-blue-600 hover:bg-blue-700 focus:outline-none font-medium rounded-lg text-sm text-center px-5 py-2.5"
                            on:click={() => handleConsent(true)}
                        >
                            Allow
                        </button>
                        <button
                            class="w-full flex items-center justify-center text-white bg-gray-600 hover:bg-gray-700 focus:outline-none font-medium rounded-lg text-sm text-center px-5 py-2.5"
                            on:click={() => handleConsent(false)}
                        >
                            Deny
                        </button>
                    </div>
                {/if}
            </div>
        </div>
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
