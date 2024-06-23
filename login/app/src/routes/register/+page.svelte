<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import headshot from "$lib/images/HEADSHOT.jpg";

    let firstName = "";
    let lastName = "";
    let email = "";
    let password = "";
    let username = "";
    let isLoading = false;
    let errorMessages: string[] = [];

    const KRATOS_PUBLIC_URL = "https://idp.prayujt.com";

    const handleRegister = async () => {
        isLoading = true;
        // errorMessages = ['Registration is not allowed at this time...'];
        // return;
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
                extractErrorMessages(errorData);
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

    const extractErrorMessages = (errorData: any) => {
        errorData.ui.nodes.forEach((node: any) => {
            node.messages.forEach((message: any) => {
                errorMessages.push(message.text);
            });
        });
    };

    const loginRedirect = () => {
        const urlSearchParams = new URLSearchParams($page.url.search);
        const newUrl = `/login?${urlSearchParams.toString()}`;
        goto(newUrl);
    };
</script>

<main class="bg-gray-50">
    <div class="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
        <!-- <img class="w-24 h-24 mb-5 rounded-lg" src={headshot} alt="Prayuj" /> -->
        <a href="" class="flex items-center mb-6 text-3xl font-heavy text-gray-900">
            Register with Prayuj Authentication
        </a>
        <div class="w-full bg-white rounded-lg shadow md:mt-0 sm:max-w-md xl:p-0">
            <div class="p-6 space-y-4 md:space-y-6 sm:p-8">
                {#if errorMessages.length > 0}
                    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                        <strong class="font-bold">Errors:</strong>
                        <ul class="list-disc list-inside mt-2">
                            {#each errorMessages as errorMessage}
                                <li>{errorMessage}</li>
                            {/each}
                        </ul>
                    </div>
                {/if}
                <form class="space-y-4 md:space-y-6" on:submit|preventDefault={handleRegister}>
                    <div>
                        <label for="firstName" class="block mb-2 text-sm font-medium text-gray-900">First Name</label>
                        <input
                            class="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-blue-600 focus:border-blue-600 block w-full p-2.5"
                            id="firstName"
                            type="text"
                            placeholder="First Name"
                            bind:value={firstName}
                        />
                    </div>
                    <div>
                        <label for="lastName" class="block mb-2 text-sm font-medium text-gray-900">Last Name</label>
                        <input
                            class="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-blue-600 focus:border-blue-600 block w-full p-2.5"
                            id="lastName"
                            type="text"
                            placeholder="Last Name"
                            bind:value={lastName}
                        />
                    </div>
                    <div>
                        <label for="email" class="block mb-2 text-sm font-medium text-gray-900">Email</label>
                        <input
                            class="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-blue-600 focus:border-blue-600 block w-full p-2.5"
                            id="email"
                            type="email"
                            placeholder="example@prayujt.com"
                            bind:value={email}
                        />
                    </div>
                    <div>
                        <label for="username" class="block mb-2 text-sm font-medium text-gray-900">Username (optional)</label>
                        <input
                            class="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-blue-600 focus:border-blue-600 block w-full p-2.5"
                            id="username"
                            type="text"
                            placeholder="Username"
                            bind:value={username}
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
                            <span>Registering...</span>
                            <div class="ml-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {:else}
                            Register
                        {/if}
                    </button>
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
        </div>
    </div>
</main>
