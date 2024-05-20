<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { user, token } from "$lib/stores";

    let email = "";
    let password = "";
    let isLoading = false;
    let loginChallenge = "";

    $: {
        loginChallenge = $page.url.searchParams.get("login_challenge") || "";
    }

    const handleLogin = async () => {
        isLoading = true;
        try {
            const res = await fetch("/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password, loginChallenge }),
            });

            if (!res.ok) {
                throw new Error("Network response was not ok");
            }

            const {
                token: responseToken,
                email: responseEmail,
                firstName,
                lastName,
            } = await res.json();

            token.set(responseToken);
            user.set({
                email: responseEmail,
                name: `${firstName} ${lastName}`,
            });

            if (res.status === 302) goto(res.headers.location);
        } catch (e: any) {
            console.log("Incorrect login");
        } finally {
            isLoading = false;
        }
    };
</script>

<main class="flex h-screen bg-gray-100">
    <div class="m-auto w-96">
        <form
            class="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4"
            on:submit|preventDefault={handleLogin}
        >
            <div class="mb-4">
                <label
                    class="block text-gray-700 text-sm font-bold mb-2"
                    for="email"
                >
                    Email
                </label>
                <input
                    class="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400
                focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500
                disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none
                invalid:border-pink-500 invalid:text-pink-600
                focus:invalid:border-pink-500 focus:invalid:ring-pink-500"
                    id="email"
                    type="email"
                    placeholder="example@prayujt.com"
                    bind:value={email}
                />
            </div>
            <div class="mb-6">
                <label
                    class="block text-gray-700 text-sm font-bold mb-2"
                    for="password"
                >
                    Password
                </label>
                <input
                    class="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400
                focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500
                disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none"
                    id="password"
                    type="password"
                    placeholder="******************"
                    bind:value={password}
                />
            </div>
            <div class="flex items-center justify-between">
                <button
                    class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline relative flex items-center justify-center"
                    type="submit"
                    disabled={isLoading}
                >
                    {#if isLoading}
                        <span>Signing In...</span>
                        <div
                            class="font-neue-helvetica ml-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                        ></div>
                    {:else}
                        Sign In
                    {/if}
                </button>
                <a
                    class="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800"
                    href="#"
                >
                    Forgot Password?
                </a>
            </div>
        </form>
    </div>
</main>
