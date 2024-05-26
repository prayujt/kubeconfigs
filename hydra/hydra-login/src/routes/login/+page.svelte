<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";

    let identifier = "";
    let password = "";
    let isLoading = false;
    let loginChallenge = "";
    let errorMessage = "";

    const KRATOS_PUBLIC_URL =
        process.env.KRATOS_PUBLIC_URL || "https://idp.prayujt.com";

    $: {
        loginChallenge = $page.url.searchParams.get("login_challenge") || "";
    }

    const handleLogin = async () => {
        isLoading = true;
        errorMessage = "";
        try {
            const initResponse = await fetch(
                `${KRATOS_PUBLIC_URL}/self-service/login/browser`,
                {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                    },
                    credentials: "include",
                },
            );

            if (!initResponse.ok) {
                const errorData = await initResponse.json();
                console.error("Error initiating login flow", errorData);
                throw new Error("Failed to initiate login flow");
            }

            const flow = await initResponse.json();

            const csrfToken = flow.ui.nodes.find(
                (node: any) => node.attributes.name === "csrf_token",
            )?.attributes.value;

            if (!csrfToken) {
                throw new Error("CSRF token not found");
            }

            const loginResponse = await fetch(
                `${KRATOS_PUBLIC_URL}/self-service/login?flow=${flow.id}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": csrfToken,
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        csrf_token: csrfToken,
                        method: "password",
                        identifier,
                        password,
                    }),
                },
            );

            if (!loginResponse.ok) {
                const errorData = await loginResponse.json();
                console.error("Error completing login", errorData);
                throw new Error("Failed to complete login");
            }

            const result = await loginResponse.json();

            const { session } = result;

            const serverResponse = await fetch("/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    subject: identifier,
                    session,
                    loginChallenge,
                }),
            });

            if (!serverResponse.ok) {
                throw new Error("Network response was not ok");
            }

            const { redirect_to } = await serverResponse.json();
            window.location.href = redirect_to;
        } catch (e: any) {
            errorMessage =
                "Incorrect login. Please check your username or email and password.";
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

<main class="flex items-center justify-center min-h-screen bg-gray-100 p-4">
    <div class="w-full max-w-md bg-white rounded-lg shadow-lg p-6 space-y-6">
        <h1 class="text-2xl font-semibold text-gray-800">
            Sign in with Prayuj Authentication
        </h1>
        <form class="space-y-4" on:submit|preventDefault={handleLogin}>
            {#if errorMessage}
                <div
                    class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
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
            <div>
                <label
                    class="block text-gray-700 text-sm font-bold mb-2"
                    for="identifier"
                >
                    Username or Email
                </label>
                <input
                    class="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400
                focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500
                disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none
                invalid:border-pink-500 invalid:text-pink-600
                focus:invalid:border-pink-500 focus:invalid:ring-pink-500"
                    id="identifier"
                    type="identifier"
                    placeholder="example@prayujt.com"
                    bind:value={identifier}
                />
            </div>
            <div>
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
            <div class="flex items-center justify-center">
                <button
                    class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition-transform transform hover:scale-105 active:scale-95"
                    type="submit"
                    disabled={isLoading}
                >
                    {#if isLoading}
                        <span>Signing In...</span>
                        <div
                            class="ml-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                        ></div>
                    {:else}
                        Sign In
                    {/if}
                </button>
            </div>
            <div class="flex items-center justify-center mt-4">
                <a
                    class="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800 cursor-pointer"
                    on:click={() => registerRedirect()}
                >
                    Don't have an account? Create one
                </a>
            </div>
        </form>
    </div>
</main>
