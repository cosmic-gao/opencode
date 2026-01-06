<template>
  <div class="min-h-dvh flex flex-col">
    <header class="border-b px-6 py-3 flex items-center justify-between">
      <h1 class="text-lg font-semibold">@opencode/codex</h1>
      <nav class="flex items-center gap-4">
        <a class="text-blue-600" href="/">Home</a>
      </nav>
    </header>
    <main class="flex-1 p-6">
      <slot />
    </main>
  </div>
</template>

