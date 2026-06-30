<!-- Loading placeholder shown in the main content area while navigating between pages. Mirrors the
     open phase: a full-width bar on top and two half-width panels below (which stack on narrow
     screens). The cards take a natural height roughly matching the open phase content; the
     available space only acts as a cap, so a cramped viewport shrinks them to fit rather than
     introducing a scrollbar. -->
<div class="flex min-h-0 w-full flex-1 flex-col gap-5 pt-7">
	<div class="min-h-0 basis-44 animate-pulse rounded-card border border-line bg-card"></div>
	<div class="flex min-h-0 basis-80 gap-5 max-md:flex-col">
		<div class="min-h-0 flex-1 animate-pulse rounded-card border border-line bg-card"></div>
		<div class="min-h-0 flex-1 animate-pulse rounded-card border border-line bg-card"></div>
	</div>
</div>
