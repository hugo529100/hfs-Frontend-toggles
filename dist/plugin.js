exports.version = 1.3
exports.apiRequired = 8.65
exports.description = "Frontend UI toggle plugin, Some relatively minor tweaks—perhaps not useful to others, but at least meaningful to me."
exports.repo = "Hug3O/Frontend-ui-toggles"
exports.frontend_js = "main.js"

exports.config = {
  hideHomeBtn: {
    type: 'boolean',
    label: 'Hide Home Button (breadcrumb 2)',
    defaultValue: false,
    frontend: true,
    helperText: 'Hide the "Home" button, usually the second item in the breadcrumb navigation.'
  },
  hideBackBtn: {
    type: 'boolean',
    label: 'Hide Back Button (breadcrumb 1)',
    defaultValue: false,
    frontend: true,
    helperText: 'Hide the "Back" button, typically the first item in the breadcrumb navigation.'
  },
  hideZipBtn: {
    type: 'boolean',
    label: 'Hide Zip Download Button',
    defaultValue: false,
    frontend: true,
    helperText: 'Hide the "Zip" button to prevent users from downloading the entire folder as a ZIP file.'
  },
  hideSelectBtn: {
    type: 'boolean',
    label: 'Hide Select Button',
    defaultValue: false,
    frontend: true,
    helperText: 'Hide the "Select" button, which is used to mark files for actions like Zip and Delete.'
  },
  hideSearchBtn: {
    type: 'boolean',
    label: 'Hide Search Button',
    defaultValue: false,
    frontend: true,
    helperText: 'Hide the "Search" button, used for filtering the visible file list.'
  },
  enableRefreshBtn: {
    type: 'boolean',
    label: 'Show Refresh Button',
    defaultValue: true,
    frontend: true,
    helperText: 'Show a small button (◤) above the breadcrumb area to reload the page content.'
  },
  enableFullscreenBtn: {
    type: 'boolean',
    label: 'Show Fullscreen Button',
    defaultValue: true,
    frontend: true,
    helperText: 'Display a fullscreen toggle button in the top menu and preview area for fullscreen viewing.'
  }
}
