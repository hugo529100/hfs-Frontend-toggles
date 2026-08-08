
exports.version = 1.8
exports.apiRequired = 8.65
exports.description = "Frontend UI customization plugin - Hide/show buttons, reorder menu bar, add refresh and fullscreen controls."
exports.repo = "Hug3O/Frontend-ui-toggles"
exports.frontend_js = "main.js"
exports.frontend_css = "style.css"

exports.config = {
    // 按鈕顯示控制
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

    // 功能開關
    enableRefreshBtn: {
        type: 'boolean',
        label: 'Show Refresh Button',
        defaultValue: true,
        frontend: true,
        helperText: 'Show a small button (▲) above the breadcrumb area to reload the page content.'
    },
    enableRefreshListBtn: {
        type: 'boolean',
        label: 'Show Refresh List Button',
        defaultValue: false,
        frontend: true,
        helperText: 'Show a refresh list button (▤) in the menu for refreshing the file list without reloading the entire page.'
    },
    enableFullscreenBtn: {
        type: 'boolean',
        label: 'Show Fullscreen Button',
        defaultValue: true,
        frontend: true,
        helperText: 'Display a fullscreen toggle button (⛶) in the top menu and preview area for fullscreen viewing.'
    },
    enablePageRefreshBtn: {
        type: 'boolean',
        label: 'Show Page Refresh Button',
        defaultValue: false,
        frontend: true,
        helperText: 'Show a page refresh button in the menu bar next to the fullscreen button.'
    },

    // 按鈕排序配置
    buttonOrderEnabled: {
        type: 'boolean',
        label: 'Enable Custom Button Order',
        defaultValue: true,
        frontend: true,
        helperText: 'Enable custom ordering of buttons in the menu bar.'
    },

    buttonOrder: {
        type: 'string',
        label: 'Button Order (one per line)',
        multiline: true,
        frontend: true,
        defaultValue: 
`login-button
user-button
select-button
upload-button
search-button
zip-button
menu-bar-fullscreen-btn
options-button
hfs-sync-button
menu-bar-qp-btn
menu-bar-notes-btn
menu-bar-walkie-btn`,
        helperText: 'Enter one button ID or class per line. Buttons will be displayed from top to bottom in this order. Use the exact ID or class name as shown in the HTML.'
    }
}