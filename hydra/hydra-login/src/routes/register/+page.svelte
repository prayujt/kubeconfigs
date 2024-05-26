<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";

    let firstName = "";
    let lastName = "";
    let email = "";
    let password = "";
    let username = "";
    let isLoading = false;

    const KRATOS_PUBLIC_URL = "https://kratos.prayujt.com";

    const handleRegister = async () => {
        isLoading = true;
        try {
            const initResponse = await fetch(
                `${KRATOS_PUBLIC_URL}/self-service/registration/browser`,
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
                console.error("Error initiating registration flow", errorData);
                throw new Error("Failed to initiate registration flow");
            }

            const flow = await initResponse.json();

            const csrfToken = flow.ui.nodes.find(
                (node) => node.attributes.name === "csrf_token",
            )?.attributes.value;

            if (!csrfToken) {
                throw new Error("CSRF token not found");
            }

            const registrationResponse = await fetch(
                `${KRATOS_PUBLIC_URL}/self-service/registration?flow=${flow.id}`,
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
                        traits: {
                            email,
                            username,
                            firstName,
                            lastName,
                        },
                        password,
                    }),
                },
            );

            if (!registrationResponse.ok) {
                const errorData = await registrationResponse.json();
                console.error("Error completing registration", errorData);
                throw new Error("Failed to complete registration");
            }

            const result = await registrationResponse.json();
            console.log(result);

            loginRedirect();
        } catch (e: any) {
            console.log("Registration error:", e);
        } finally {
            isLoading = false;
        }
    };

    const loginRedirect = () => {
        const urlSearchParams = new URLSearchParams($page.url.search);
        const newUrl = `/login?${urlSearchParams.toString()}`;
        goto(newUrl);
    };
</script>

<main class="flex items-center justify-center min-h-screen bg-gray-100 p-4">
    <div class="w-full max-w-md bg-white rounded-lg shadow-lg p-6 space-y-6">
        <h1 class="text-2xl font-semibold text-gray-800">
            Register with Prayuj Authentication
        </h1>
        <form class="space-y-4" on:submit|preventDefault={handleRegister}>
            <div>
                <label
                    class="block text-gray-700 text-sm font-bold mb-2"
                    for="firstName"
                >
                    First Name
                </label>
                <input
                    class="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400
                focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500
                disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none"
                    id="firstName"
                    type="text"
                    placeholder="First Name"
                    bind:value={firstName}
                />
            </div>
            <div>
                <label
                    class="block text-gray-700 text-sm font-bold mb-2"
                    for="lastName"
                >
                    Last Name
                </label>
                <input
                    class="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400
                focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500
                disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none"
                    id="lastName"
                    type="text"
                    placeholder="Last Name"
                    bind:value={lastName}
                />
            </div>
            <div>
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
            <div>
                <label
                    class="block text-gray-700 text-sm font-bold mb-2"
                    for="username"
                >
                    Username (optional)
                </label>
                <input
                    class="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400
                focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500
                disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none"
                    id="username"
                    type="text"
                    placeholder="Username"
                    bind:value={username}
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
                    class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-150 ease-in-out transform hover:scale-105 active:scale-95"
                    type="submit"
                    disabled={isLoading}
                >
                    {#if isLoading}
                        <span>Registering...</span>
                        <div
                            class="ml-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                        ></div>
                    {:else}
                        Register
                    {/if}
                </button>
            </div>
            <div class="flex items-center justify-center mt-4">
                <a
                    class="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800 cursor-pointer"
                    on:click={() => loginRedirect()}
                >
                    Already have an account? Sign In
                </a>
            </div>
        </form>
    </div>
</main>
