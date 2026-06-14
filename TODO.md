# TODO.md

1. **Tree Logic**: Changing visibility of one submodule expands other submodules. (Check `collapsedPaths` state updating).
2. **Clear All Button**: Add "Clear All" button to Waveform Viewer to remove all tracks.
3. **Empty Initial State**: Don't show any signals upon first opening Waveform Viewer.
4. **Visibility Toggle Bug**: Hiding all signals of top module leaves some signals in Waveform Viewer. (Check if `setSignalsVisibility` recursively hides correctly, or if there's a discrepancy in signal lists).
5. **Mark Visible Signals**: Make sure visible signals are marked in the Signal Explorer tree.
6. **Hide Signal on Item**: Add "Hide Signal" (or a close button) directly on the track label in Waveform Viewer.
7. **Cursor Overlap**: Cursor goes over the signal list panel. Fix z-index or overflow in WaveformViewer timeline.
8. **Signal Explorer Resizing**: Save the width of the Signal Explorer per Waveform Viewer window/tab independently. Ensure it doesn't affect the AI panel size.
9. **Rule**: Always keep a full log of all requested changes in this TODO file. Let this act as a permanent record.
10. **Fix Errors**: Fixed React Resizeable Panels `bt(...) is undefined` crash by removing dynamic defaultSize. Fixed `ResizeObserver loop` error.
11. **Signal Explorer Resizing (Fix)**: Fixed the auto-saving of panel width by ensuring it only saves when the user manually drags the panel resize handle. Without this fix, switching tabs programmatically overwrote the saved sizes.
12. **Panel Decoupling**: Completely separated the AI Assistant, Signal Explorer, and Schema Explorer into distinct conditional `Panel` components (with unique keys) so `react-resizable-panels` caches their sizes completely independently. This ensures dragging the Signal Explorer has absolutely zero effect on the AI Assistant width when switching tabs.
13. **Fix Unknown Warning**: Fixed React warning `Unknown event handler property onDragging` by using `onMouseDown` and a document listener for `mouseup` to correctly track drag state without relying on undocumented props of `Separator`.
14. **Fix UI Freeze on Resize**: Fixed severe UI lag during panel dragging by preventing continuous `updateFileUI` and `setChatWidth` state updates inside `onResize`. Intermediate sizes are now written to a `useRef`, and committed to React state only when the user finishes dragging (`mouseup` event).
