<!-- src/routes/+page.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation'

    onMount(() => {
        const urlSearchParams = new URLSearchParams($page.url.search);

        const newUrl = `/login?${urlSearchParams.toString()}`;

        goto(newUrl);
    });
</script>
