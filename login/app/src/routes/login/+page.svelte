<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";

    import headshot from "$lib/images/HEADSHOT.jpg";

    let identifier = "";
    let password = "";
    let isLoading = false;
    let loginChallenge = "";
    let errorMessage = "";
    let loading = true;
    let isSignUpDisabled = true;

    const KRATOS_PUBLIC_URL = "https://idp.prayujt.com";

    $: {
        loginChallenge = $page.url.searchParams.get("login_challenge") || "";
    }

    onMount(async () => {
        try {
            const sessionResponse = await fetch(
                `${KRATOS_PUBLIC_URL}/sessions/whoami`,
                {
                    credentials: "include",
                },
            );
            if (sessionResponse.ok) {
                const session = await sessionResponse.json();
                console.log("Existing session found...");
                console.log(session);

                const serverResponse = await fetch("/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        session,
                        loginChallenge,
                    }),
                });

                if (!serverResponse.ok) {
                    throw new Error("Network response was not ok");
                }

                const { redirect_to } = await serverResponse.json();
                window.location.href = redirect_to;
            }
        } catch (e) {
            console.log("No existing session found.");
        } finally {
            loading = false;
        }
    });

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

<main class="bg-gray-50">
    <div class="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
        <!-- <img class="w-24 h-24 mb-5 rounded-lg" src={headshot} alt="Prayuj" /> -->
        <a href="" class="flex items-center mb-6 text-3xl font-heavy text-gray-900">
            Sign in with Prayuj Authentication
        </a>
        <div class="w-full bg-white rounded-lg shadow md:mt-0 sm:max-w-md xl:p-0">
            <div class="p-6 space-y-4 md:space-y-6 sm:p-8">
                <form class="space-y-4 md:space-y-6" on:submit|preventDefault={handleLogin}>
                    <div>
                        <label for="identifier" class="block mb-2 text-sm font-medium text-gray-900">Username or Email</label>
                        <input
                            class="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-blue-600 focus:border-blue-600 block w-full p-2.5"
                            id="identifier"
                            type="identifier"
                            placeholder="example@prayujt.com"
                            bind:value={identifier}
                        />
                    </div>
                    <div>
                        <label for="password" class="block mb-2 text-sm font-medium text-gray-900">Password</label>
                        <input
                            class="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-blue-600 focus:border-blue-600 block w-full p-2.5"
                            id="password"
                            type="password"
                            placeholder="******************"
                            bind:value={password}
                        />
                    </div>
                    <button
                        class="w-full flex items-center justify-center text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
                        type="submit"
                        disabled={isLoading}
                        style="min-width: 120px;"
                    >
                        {#if isLoading}
                            <span>Signing In...</span>
                            <div class="ml-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {:else}
                            Sign In
                        {/if}
                    </button>
                    <div class="flex items-center justify-center">
                        <a class="text-sm font-medium text-blue-600 hover:font-bold hover:cursor-not-allowed">Forgot password?</a>
                    </div>
                    <p class="text-sm font-light">
                        Don’t have an account?
                        <a class="font-medium text-blue-600 hover:cursor-not-allowed">
                            Sign up
                        </a>
                    </p>
                </form>
            </div>
        </div>
    </div>
</main>
