# TODO.md

## Completed Tasks (June 14, 2026)
1. **Tree Logic**: Fixed bug where changing visibility of one submodule expanded other submodules. Implemented true per-path node tracking so expanding/collapsing one path doesn't mutate unrelated open folders.
2. **Clear All Button**: Added "Clear" action in WaveformViewer toolbar to quickly remove all visible tracks.
3. **Empty Initial State**: Initialized track view state empty so the user explicitly pulls in waveforms manually instead of auto-populating.
4. **Visibility Toggle Bug**: Fixed issue where hiding all signals of top module left some signals in the viewer. Corrected recursive toggling logic to accurately match scopes.
5. **Mark Visible Signals**: Implemented active highlight on explicitly toggled tree nodes syncing with the visible signal array.
6. **Hide Signal on Item**: Rendered a small `X` close button directly on individual waveform track labels to toggle visibility inline.
7. **Cursor Overlap**: Enforced proper absolute bounding limits and strict `z-index` layering on the timeline scrubber to prevent overlap with the signal list panel.
8. **Signal Explorer Resizing**: Separated AI width from signal tree width by utilizing independent layout panels and caching size.
9. **Permanent Record Rule**: Maintained a full log of all requested changes in this TODO file as a permanent record.
10. **Fix Errors**: Fixed React Resizeable Panels `bt(...) is undefined` crash by removing dynamic defaultSize. Fixed `ResizeObserver loop` error.
11. **Signal Explorer Resizing (Fix)**: Fixed the auto-saving of panel width by ensuring it only saves when the user manually drags the panel resize handle. Without this fix, switching tabs programmatically overwrote the saved sizes.
12. **Panel Decoupling**: Completely separated the AI Assistant, Signal Explorer, and Schema Explorer into distinct conditional `Panel` components (with unique keys) so `react-resizable-panels` caches their sizes completely independently. This ensures dragging the Signal Explorer has absolutely zero effect on the AI Assistant width when switching tabs.
13. **Fix Unknown Warning**: Fixed React warning `Unknown event handler property onDragging` by using `onMouseDown` and a document listener for `mouseup` to correctly track drag state without relying on undocumented props of `Separator`.
14. **Fix UI Freeze on Resize**: Fixed severe UI lag during panel dragging by preventing continuous `updateFileUI` and `setChatWidth` state updates inside `onResize`. Intermediate sizes are now written to a `useRef`, and committed to React state only when the user finishes dragging (`mouseup` event).
15. **Nodes On Top Fix & Diagram Features**: Fixed the "nodes on top" view toggle from getting stuck upon initial render by ensuring its effect evaluates on layout regeneration. Also added double-click handling to `LOGIC CORE` parts to navigate to module source code natively, and added a top-level persistent "Back" button across cross-file drill-downs to allow returning to previous diagram views efficiently.
16. **Diagram Fixes**: Fixed a bug where jumping to module source code failed due to rigid substring parsing; replaced it with a dynamic Regex pattern handler inside Monaco Editor search. Implemented correct array dependency popping on the "Back" button which fixes the bug where retreating backwards from deep submodules within the same file did not resolve correctly. Fixed `zIndex` application phase to fix the visual glitch where wires would draw above nodes on submodule navigation unless toggled twice.
17. **Editor View State Persistence Fix**: Fixed an issue where switching back to the code text view from the schematic viewer would reset the scroll and cursor positions to the top of the file. Corrected the approach by preserving the React Monaco Editor component in the DOM (using CSS `display: none` via Tailwind's `hidden` class) instead of unmounting it during mode switches. This allows Monaco's native internal view state mechanisms to perfectly retain cursor and scroll position across structural toggles.

## Tasks for Tomorrow
1. (Ready for new assignments and features)
