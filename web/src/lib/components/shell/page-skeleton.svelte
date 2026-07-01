<!-- Loading placeholder shown in the main content area while navigating between pages. Mirrors the
     phase layout: the standardized phase intro (title + description) on top, then a full-width bar
     and two half-width panels below (which stack on narrow screens). The cards take a natural height
     roughly matching the open phase content; the available space only acts as a cap, so a cramped
     viewport shrinks them to fit rather than introducing a scrollbar. -->
<div class="flex min-h-0 w-full flex-1 flex-col gap-5 pt-7">
	<div class="flex shrink-0 flex-col gap-2.5">
		<div class="h-6 w-40 animate-pulse rounded-chip bg-card2"></div>
		<div class="flex flex-col gap-2">
			<div class="h-3.5 w-full animate-pulse rounded-chip bg-card2"></div>
			<div class="h-3.5 w-3/4 animate-pulse rounded-chip bg-card2"></div>
		</div>
	</div>
	<div class="min-h-0 basis-44 animate-pulse rounded-card border border-line bg-card"></div>
	<div class="flex min-h-0 basis-80 gap-5 max-md:flex-col">
		<div class="min-h-0 flex-1 animate-pulse rounded-card border border-line bg-card"></div>
		<div class="min-h-0 flex-1 animate-pulse rounded-card border border-line bg-card"></div>
	</div>
</div>
