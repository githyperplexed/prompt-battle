export function hasTextSelection(): boolean {
	return (window.getSelection()?.toString() ?? "") !== "";
}
