<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";

    let user = "";
    let password = "";
    let isLoading = false;
    let loginChallenge = "";
    let errorMessage = "";

    $: {
        loginChallenge = $page.url.searchParams.get("login_challenge") || "";
    }

    const handleLogin = async () => {
        isLoading = true;
        errorMessage = "";
        try {
            const res = await fetch("/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ user, password, loginChallenge }),
            });

            if (!res.ok) {
                throw new Error("Network response was not ok");
            }
            const { redirect_to } = await res.json();
            window.location.href = redirect_to;
        } catch (e: any) {
            errorMessage =
                "Incorrect login. Please check your username and password.";
        } finally {
            isLoading = false;
        }
    };

    const registerRedirect = () => {
        const urlSearchParams = new URLSearchParams($page.url.search);
        const newUrl = `/register?${urlSearchParams.toString()}`;
        goto(newUrl);
    };
</script>

<main class="flex h-screen bg-gray-100">
    <div class="m-auto w-96">
        <form
            class="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4"
            on:submit|preventDefault={handleLogin}
        >
            {#if errorMessage}
                <div
                    class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
                    role="alert"
                >
                    <strong class="font-bold">Error!</strong>
                    <span class="block sm:inline"> {errorMessage}</span>
                    <span class="absolute top-0 bottom-0 right-0 px-4 py-3">
                        <svg
                            on:click={() => (errorMessage = "")}
                            class="fill-current h-6 w-6 text-red-500"
                            role="button"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            ><title>Close</title><path
                                d="M14.348 5.652a.8.8 0 010 1.131L11.131 10l3.217 3.217a.8.8 0 11-1.131 1.131L10 11.131l-3.217 3.217a.8.8 0 11-1.131-1.131L8.869 10 5.652 6.783a.8.8 0 011.131-1.131L10 8.869l3.217-3.217a.8.8 0 011.131 0z"
                            /></svg
                        >
                    </span>
                </div>
            {/if}
            <div class="mb-4">
                <label
                    class="block text-gray-700 text-sm font-bold mb-2"
                    for="user"
                >
                    Username or Email
                </label>
                <input
                    class="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400
                focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500
                disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none
                invalid:border-pink-500 invalid:text-pink-600
                focus:invalid:border-pink-500 focus:invalid:ring-pink-500"
                    id="user"
                    type="user"
                    placeholder="example@prayujt.com"
                    bind:value={user}
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
            <div class="flex items-center justify-between mb-4">
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
            <div class="flex items-center justify-center">
                <button
                    class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                    type="button"
                    on:click={() => registerRedirect()}
                >
                    Register
                </button>
            </div>
        </form>
    </div>
</main>
