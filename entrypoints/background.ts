export default defineBackground({
  main() {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  },
});
