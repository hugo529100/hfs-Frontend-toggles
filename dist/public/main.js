// main.js - Tile Size 按鈕放在 breadcrumb 上方一行（同 refresh 按鈕）
// 單擊：list(0) ▤ ↔ 服務器默認 ▦（兩態切換）
// 雙擊：直接跳到 tile6 ▣
// 圖標規則：0 → ▤ ；1-5 → ▦ ；6-10 → ▣
'use strict'; {
    const config = HFS.getPluginConfig()
    const h = HFS.h

    // ============================================================
    // 1. 原有功能：隱藏按鈕
    // ============================================================
    const applyStyle = (selector, hide) => {
        const el = document.querySelector(selector)
        if (!el) return
        el.style.display = hide ? 'none' : ''
    }

    const updateUI = () => {
        applyStyle('.breadcrumb:nth-of-type(2)', config.hideHomeBtn)
        applyStyle('.breadcrumb:nth-of-type(1)', config.hideBackBtn)
        applyStyle('#zip-button', config.hideZipBtn)
        applyStyle('#select-button', config.hideSelectBtn)
        applyStyle('#search-button', config.hideSearchBtn)
    }

    HFS.watchState('list', updateUI, true)

    // ============================================================
    // 2. 按鈕排序功能（完全遵循 buttonOrder）
    // ============================================================
    let isReordering = false
    let reorderTimeout = null
    let menuBarObserver = null
    let menuBarObserverRetries = 0
    const MAX_OBSERVER_RETRIES = 10

    const reorderButtons = () => {
        if (!config.buttonOrderEnabled) return
        if (isReordering) return
        isReordering = true

        try {
            const menuBar = document.getElementById('menu-bar')
            if (!menuBar) {
                isReordering = false
                return
            }

            const orderStr = config.buttonOrder || `collapse-toggle-btn
login-button
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
menu-bar-walkie-btn`
            
            let orderList = orderStr.split('\n')
                .map(id => id.trim())
                .filter(id => id && id.length > 0)

            const buttons = Array.from(menuBar.children)
            
            if (buttons.length < 2) {
                isReordering = false
                return
            }

            let needsReorder = false
            const currentOrder = buttons.map(el => el.id || el.className)
            
            for (let i = 0; i < Math.min(orderList.length, currentOrder.length); i++) {
                const expectedId = orderList[i]
                const currentId = currentOrder[i]
                const cleanCurrentId = currentId.replace('menu-bar-', '')
                const cleanExpectedId = expectedId.replace('menu-bar-', '')
                if (cleanCurrentId !== cleanExpectedId) {
                    needsReorder = true
                    break
                }
            }

            if (!needsReorder) {
                isReordering = false
                return
            }

            const orderedButtons = []
            const remainingButtons = []

            orderList.forEach(id => {
                const btn = buttons.find(el => {
                    if (el.id === id) return true
                    if (el.classList) {
                        if (el.classList.contains(id)) return true
                        if (id.startsWith('menu-bar-') && el.classList.contains(id)) return true
                        if (id === 'hfs-sync-button' && el.classList.contains('hfs-sync-button')) return true
                    }
                    if (id === 'collapse-toggle-btn' && el.id === 'collapse-toggle-btn') return true
                    return false
                })
                if (btn && !orderedButtons.includes(btn)) {
                    orderedButtons.push(btn)
                }
            })

            buttons.forEach(btn => {
                if (!orderedButtons.includes(btn)) {
                    remainingButtons.push(btn)
                }
            })

            const allButtons = [...orderedButtons, ...remainingButtons]
            if (allButtons.length !== buttons.length) {
                isReordering = false
                return
            }

            const fragment = document.createDocumentFragment()
            allButtons.forEach(btn => {
                fragment.appendChild(btn)
            })
            menuBar.appendChild(fragment)
            
        } catch (error) {
            // 靜默處理錯誤
        } finally {
            setTimeout(() => {
                isReordering = false
            }, 200)
        }
    }

    const scheduleReorder = () => {
        if (reorderTimeout) {
            cancelAnimationFrame(reorderTimeout)
        }
        reorderTimeout = requestAnimationFrame(() => {
            reorderButtons()
            reorderTimeout = null
        })
    }

    // ============================================================
    // 3. 監聽事件（排序）
    // ============================================================
    HFS.onEvent('afterBreadcrumbs', () => {
        setTimeout(() => {
            scheduleReorder()
            setTimeout(applyCollapseState, 100)
        }, 150)
    })

    const setupMenuBarObserver = () => {
        if (menuBarObserverRetries >= MAX_OBSERVER_RETRIES) {
            return
        }

        const menuBar = document.getElementById('menu-bar')
        if (!menuBar) {
            menuBarObserverRetries++
            setTimeout(setupMenuBarObserver, 200)
            return
        }

        menuBarObserverRetries = 0

        if (menuBarObserver) {
            menuBarObserver.disconnect()
            menuBarObserver = null
        }

        let observerTriggered = false

        menuBarObserver = new MutationObserver((mutations) => {
            let shouldReorder = false
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                        shouldReorder = true
                        break
                    }
                }
            }
            
            if (shouldReorder && !observerTriggered) {
                observerTriggered = true
                scheduleReorder()
                setTimeout(applyCollapseState, 200)
                setTimeout(() => {
                    observerTriggered = false
                }, 300)
            }
        })

        menuBarObserver.observe(menuBar, { 
            childList: true, 
            subtree: false,
            attributes: false
        })
    }

    setTimeout(setupMenuBarObserver, 100)

    HFS.onEvent('configChanged', () => {
        setTimeout(() => {
            scheduleReorder()
            setTimeout(applyCollapseState, 200)
        }, 200)
    })

    // ============================================================
    // 4. 新增功能：Tile Size 快速切換（放在 breadcrumb 上方一行）
    //    單擊：list(0) ▤ ↔ 服務器默認 ▦（兩態切換）
    //    雙擊：直接跳到 tile6 ▣
    //    圖標規則：0 → ▤ ；1-5 → ▦ ；6-10 → ▣
    // ============================================================
    let tileSizeClickTimer = null
    let currentTileSize = null // 當前實際 tile_size 數值
    let serverTileSizeCache = null

    const getServerTileSize = () => {
        // 首次取得後緩存，避免後續 tile_size 被改成 6 後無法反推默認值
        if (serverTileSizeCache !== null) return serverTileSizeCache
        try {
            if (HFS.state && HFS.state.tile_size !== undefined) {
                const v = HFS.state.tile_size
                if (typeof v === 'number' && v > 0 && v !== 6) {
                    serverTileSizeCache = v
                    return v
                }
                if (typeof v === 'number' && v === 6) {
                    // 當前剛好是 6，無法從中得知服務器默認，退回 2
                    serverTileSizeCache = 2
                    return 2
                }
            }
        } catch (e) {}
        serverTileSizeCache = 2
        return 2
    }

    // 按實際 tile_size 數值回傳圖標
    const getTileSizeIconByValue = (value) => {
        if (value === 0) return '▤'
        if (typeof value === 'number' && value >= 1 && value <= 5) return '▦'
        if (typeof value === 'number' && value >= 6) return '▣'
        // 後備
        if (value === 0) return '▤'
        return '▦'
    }

    const getTileSizeIcon = () => {
        if (currentTileSize === null || currentTileSize === undefined) return '▦'
        return getTileSizeIconByValue(currentTileSize)
    }

    const updateTileSizeButtonIcon = () => {
        const btn = document.getElementById('tileSizeButton')
        if (!btn) return
        const iconSpan = btn.querySelector('span[aria-hidden="true"]')
        if (iconSpan) iconSpan.textContent = getTileSizeIcon()
    }

    const applyTileSize = (size) => {
        try {
            if (HFS.state) HFS.state.tile_size = size
            currentTileSize = size
        } catch (e) {}
    }

    // 依模式設定 tile size，並記錄數值
    const setTileMode = (mode) => {
        const serverDefault = getServerTileSize()
        let size
        if (mode === 'list') {
            size = 0
        } else if (mode === 'tile6') {
            size = 6
        } else {
            size = serverDefault
        }
        applyTileSize(size)
        updateTileSizeButtonIcon()
    }

    // 單擊：list(0) ▤ ↔ 服務器默認 ▦（兩態切換）
    const handleTileSizeClick = () => {
        if (tileSizeClickTimer) {
            // 已經在等待雙擊，這次當作雙擊處理
            clearTimeout(tileSizeClickTimer)
            tileSizeClickTimer = null
            setTileMode('tile6')
            return
        }
        tileSizeClickTimer = setTimeout(() => {
            tileSizeClickTimer = null
            // 兩態切換：list(0) ↔ default
            // 判斷當前值：0 → default；其他（含 1-5 與 6-10）→ list
            if (currentTileSize === 0) {
                setTileMode('default')
            } else {
                setTileMode('list')
            }
        }, 250)
    }

    // 雙擊：直接跳到 tile6
    const handleTileSizeDblClick = () => {
        if (tileSizeClickTimer) {
            clearTimeout(tileSizeClickTimer)
            tileSizeClickTimer = null
        }
        setTileMode('tile6')
    }

    const initTileSizeMode = () => {
        try {
            const v = HFS.state && HFS.state.tile_size
            if (typeof v === 'number') {
                currentTileSize = v
                // 首次遇到非 0 且非 6 的值，視為服務器默認值
                if (serverTileSizeCache === null && v > 0 && v !== 6) {
                    serverTileSizeCache = v
                }
            } else {
                currentTileSize = null
            }
        } catch (e) {
            currentTileSize = null
        }
        updateTileSizeButtonIcon()
    }

    // 監聽 tile_size 變化，保持圖標同步
    HFS.watchState('tile_size', (value) => {
        if (typeof value === 'number') {
            currentTileSize = value
            if (serverTileSizeCache === null && value > 0 && value !== 6) {
                serverTileSizeCache = value
            }
        } else {
            currentTileSize = null
        }
        updateTileSizeButtonIcon()
    })

    // 在 breadcrumb 上方一行插入 tile size 按鈕
    if (config.enableTileSizeBtn) {
        HFS.onEvent('afterBreadcrumbs', () => {
            setTimeout(() => {
                const parent = document.querySelector('#breadcrumb-parent')
                if (!parent) return

                // 找到或建立 refresh-container（與 refresh 按鈕共用同一行）
                let container = parent.parentNode.querySelector('.refresh-container')
                if (!container) {
                    container = document.createElement('div')
                    container.className = 'refresh-container'
                    parent.parentNode.insertBefore(container, parent)
                }

                if (document.getElementById('tileSizeButton')) {
                    initTileSizeMode()
                    return
                }

                const btn = document.createElement('button')
                btn.id = 'tileSizeButton'
                btn.title = 'Toggle tile size (click: list/default, double-click: tile 6)'
                btn.innerHTML = '<span aria-hidden="true">' + getTileSizeIcon() + '</span>'

                btn.addEventListener('click', handleTileSizeClick)
                btn.addEventListener('dblclick', handleTileSizeDblClick)

                container.appendChild(btn)
                initTileSizeMode()
            }, 0)
        })
    }

    // ============================================================
    // 5. 原有功能：刷新按鈕
    // ============================================================
    if (config.enableRefreshBtn || config.enableRefreshListBtn) {
        HFS.onEvent('afterBreadcrumbs', () => {
            setTimeout(() => {
                const parent = document.querySelector('#breadcrumb-parent')
                if (parent) {
                    let container = parent.parentNode.querySelector('.refresh-container')
                    if (!container) {
                        container = document.createElement('div')
                        container.className = 'refresh-container'
                        parent.parentNode.insertBefore(container, parent)
                    }

                    if (config.enableRefreshBtn && !document.getElementById('refreshButton')) {
                        const refreshPageBtn = document.createElement('button')
                        refreshPageBtn.id = 'refreshButton'
                        refreshPageBtn.title = 'Refresh page'
                        refreshPageBtn.innerHTML = '<span aria-hidden="true">▲</span>'
                        refreshPageBtn.addEventListener('click', () => location.reload(true))
                        container.appendChild(refreshPageBtn)
                    }

                    if (config.enableRefreshListBtn && !document.getElementById('refreshListButton')) {
                        const refreshListBtn = document.createElement('button')
                        refreshListBtn.id = 'refreshListButton'
                        refreshListBtn.title = 'Refresh list'
                        refreshListBtn.innerHTML = '<span aria-hidden="true">↺</span>'
                        refreshListBtn.addEventListener('click', () => HFS.reloadList())
                        container.appendChild(refreshListBtn)
                    }
                }
            }, 0)
        })
    }

    // ============================================================
    // 6. 原有功能：全屏按鈕
    // ============================================================
    let isFullscreen = false
    let fullscreenChangeHandler = null

    const toggleFullscreen = () => {
        const el = document.documentElement
        
        if (!isFullscreen) {
            el.requestFullscreen?.()
                .then(() => {
                    isFullscreen = true
                    
                    if (fullscreenChangeHandler) {
                        document.removeEventListener('fullscreenchange', fullscreenChangeHandler)
                    }
                    
                    fullscreenChangeHandler = () => {
                        if (!document.fullscreenElement) {
                            el.requestFullscreen?.().catch(() => {
                                isFullscreen = false
                            })
                        }
                    }
                    
                    document.addEventListener('fullscreenchange', fullscreenChangeHandler)
                })
                .catch(err => {
                    HFS.toast("Enter fullscreen failed: " + err, 'error')
                })
        } else {
            if (fullscreenChangeHandler) {
                document.removeEventListener('fullscreenchange', fullscreenChangeHandler)
                fullscreenChangeHandler = null
            }
            
            document.exitFullscreen?.()
            isFullscreen = false
        }
    }

    let menuBarButtonsAdded = false

    HFS.onEvent('appendMenuBar', () => {
        if (menuBarButtonsAdded) {
            return []
        }
        menuBarButtonsAdded = true

        const buttons = []
        
        if (config.enablePageRefreshBtn) {
            buttons.push(
                h('button', {
                    className: 'menu-bar-refresh-btn',
                    onClick: () => location.reload(true),
                    title: 'Refresh Page'
                }, [
                    h('span', { 'aria-hidden': 'true' }, '▲'),
                    h('span', { className: 'btn-label' }, 'Refresh')
                ])
            )
        }
        
        if (config.enableFullscreenBtn) {
            buttons.push(
                h('button', {
                    className: 'menu-bar-fullscreen-btn',
                    onClick: toggleFullscreen,
                    title: 'Toggle Fullscreen'
                }, [
                    h('span', { 'aria-hidden': 'true' }, '⛶'),
                    h('span', { className: 'btn-label' }, 'Full')
                ])
            )
        }
        
        // ★★★ 在 appendMenuBar 事件中創建 collapse-toggle-btn（參照 FullscreenBtn）★★★
        setTimeout(() => {
            createCollapseToggleButton()
            scheduleReorder()
            setTimeout(applyCollapseState, 200)
        }, 300)
        
        return buttons
    })

    if (config.enableFullscreenBtn) {
        let previewButtonAdded = false
        let previewObserver = null
        
        const addPreviewFullscreenButton = () => {
            if (previewButtonAdded) return
            
            const controls = document.querySelector('.file-show .bar .controls')
            if (!controls) return
            
            const closeBtn = controls.querySelector('button[title="Close"]')
            const exists = controls.querySelector('.preview-controls-fullscreen-btn')
            
            if (controls && closeBtn && !exists) {
                const btn = document.createElement('button')
                btn.className = 'preview-controls-fullscreen-btn'
                btn.title = 'Toggle Fullscreen'
                btn.innerHTML = '<span aria-hidden="true">⛶</span>'
                btn.onclick = toggleFullscreen
                controls.insertBefore(btn, closeBtn)
                previewButtonAdded = true
                
                if (previewObserver) {
                    previewObserver.disconnect()
                    previewObserver = null
                }
            }
        }

        previewObserver = new MutationObserver(() => {
            addPreviewFullscreenButton()
        })

        previewObserver.observe(document.body, {
            childList: true,
            subtree: false,
            attributes: false
        })

        const delays = [500, 1000, 2000]
        delays.forEach(delay => {
            setTimeout(addPreviewFullscreenButton, delay)
        })
    }

    // ============================================================
    // 7. 收納菜單功能（先排序後隱藏）
    // ============================================================
    const isCollapseEnabled = () => {
        return config.enableCollapseMenu === true
    }

    const getDefaultButtons = () => {
        const buttons = []
        if (!config.hideSelectBtn) buttons.push('select-button')
        if (!config.hideSearchBtn) buttons.push('search-button')
        if (!config.hideZipBtn) buttons.push('zip-button')
        buttons.push(
            'user-button',
            'options-button',
            'hfs-sync-button',
            'menu-bar-qp-btn',
            'menu-bar-walkie-btn'
        )
        return buttons
    }

    const getToggleButtonSelectors = () => {
        if (!isCollapseEnabled()) return []
        
        const list = config.collapseButtons || ''
        const items = list.split('\n')
            .map(s => s.trim())
            .filter(s => s && s.length > 0)
        
        let buttons = items.length > 0 ? items : getDefaultButtons()
        
        const hiddenByConfig = []
        if (config.hideSelectBtn) hiddenByConfig.push('select-button')
        if (config.hideSearchBtn) hiddenByConfig.push('search-button')
        if (config.hideZipBtn) hiddenByConfig.push('zip-button')
        
        buttons = buttons.filter(btn => !hiddenByConfig.includes(btn))
        
        return buttons
    }

    let isCollapseExpanded = false
    let collapseToggleButton = null
    let collapseTargetButtons = []
    let collapseObserver = null
    let collapseRebuildTimeout = null
    let collapseCreateRetries = 0
    const MAX_CREATE_RETRIES = 3  // 最多重試3次

    const matchesSelector = (el, selector) => {
        if (!el) return false
        if (el.id === selector) return true
        if (el.classList && el.classList.contains(selector)) return true
        return false
    }

    const getCollapseTargetButtons = () => {
        const menuBar = document.getElementById('menu-bar')
        if (!menuBar) return []

        const selectors = getToggleButtonSelectors()
        if (selectors.length === 0) return []

        const children = Array.from(menuBar.children)
        const buttons = []

        children.forEach(el => {
            if (el.id === 'collapse-toggle-btn') return
            for (const selector of selectors) {
                if (matchesSelector(el, selector)) {
                    buttons.push(el)
                    break
                }
            }
        })

        return buttons
    }

    const forceHideButton = (btn) => {
        if (!btn) return
        if (!btn.dataset.origDisplay) {
            const computedStyle = window.getComputedStyle(btn)
            btn.dataset.origDisplay = computedStyle.display || 'inline-flex'
        }
        btn.style.setProperty('display', 'none', 'important')
    }

    const forceShowButton = (btn) => {
        if (!btn) return
        const display = btn.dataset.origDisplay || 'inline-flex'
        btn.style.setProperty('display', display, 'important')
    }

    const applyCollapseState = () => {
        if (!isCollapseEnabled()) return
        
        const menuBar = document.getElementById('menu-bar')
        if (!menuBar) return
        
        collapseTargetButtons = getCollapseTargetButtons()
        
        if (isCollapseExpanded) {
            collapseTargetButtons.forEach(btn => {
                forceShowButton(btn)
            })
        } else {
            collapseTargetButtons.forEach(btn => {
                forceHideButton(btn)
            })
        }
    }

    const initCollapseButtons = () => {
        collapseTargetButtons = getCollapseTargetButtons()
        collapseTargetButtons.forEach(btn => {
            forceHideButton(btn)
        })
        isCollapseExpanded = false
        if (collapseToggleButton) {
            updateToggleButtonText(false)
        }
    }

    // 更新 toggle 按鈕文字
    const updateToggleButtonText = (expanded) => {
        if (!collapseToggleButton) return
        
        collapseToggleButton.innerHTML = ''
        
        const iconSpan = document.createElement('span')
        iconSpan.setAttribute('aria-hidden', 'true')
        iconSpan.textContent = expanded ? '✕' : 'Ⓜ'
        
        const labelSpan = document.createElement('span')
        labelSpan.className = 'btn-label'
        labelSpan.textContent = 'More'
        
        collapseToggleButton.appendChild(iconSpan)
        collapseToggleButton.appendChild(labelSpan)
        
        collapseToggleButton.title = expanded ? 'Hide buttons' : 'Show hidden buttons'
        
        if (expanded) {
            collapseToggleButton.classList.add('expanded')
        } else {
            collapseToggleButton.classList.remove('expanded')
        }
    }

    const showCollapseButtons = () => {
        if (isCollapseExpanded) return
        collapseTargetButtons.forEach(btn => {
            forceShowButton(btn)
        })
        isCollapseExpanded = true
        updateToggleButtonText(true)
    }

    const hideCollapseButtons = () => {
        if (!isCollapseExpanded) return
        collapseTargetButtons.forEach(btn => {
            forceHideButton(btn)
        })
        isCollapseExpanded = false
        updateToggleButtonText(false)
    }

    const toggleCollapseButtons = (e) => {
        if (e) e.stopPropagation()
        collapseTargetButtons = getCollapseTargetButtons()
        if (isCollapseExpanded) {
            hideCollapseButtons()
        } else {
            showCollapseButtons()
        }
    }

    const handleOutsideClick = (e) => {
        if (!isCollapseExpanded) return
        if (!collapseToggleButton) return
        
        const target = e.target
        
        if (collapseToggleButton.contains(target)) return
        
        for (const btn of collapseTargetButtons) {
            if (btn.contains(target)) {
                return
            }
        }
        
        hideCollapseButtons()
    }

    // ★★★ 創建 collapse-toggle-btn（參照 FullscreenBtn 的簡潔風格）★★★
    const createCollapseToggleButton = () => {
        if (!isCollapseEnabled()) {
            removeCollapseToggleButton()
            return
        }

        const menuBar = document.getElementById('menu-bar')
        if (!menuBar) {
            // 重試機制
            if (collapseCreateRetries < MAX_CREATE_RETRIES) {
                collapseCreateRetries++
                setTimeout(createCollapseToggleButton, 200)
            }
            return
        }

        // 如果已存在，不重複創建
        const existingBtn = document.getElementById('collapse-toggle-btn')
        if (existingBtn) {
            collapseToggleButton = existingBtn
            const label = collapseToggleButton.querySelector('.btn-label')
            if (!label) {
                updateToggleButtonText(isCollapseExpanded)
            }
            initCollapseButtons()
            setTimeout(scheduleReorder, 50)
            return
        }

        collapseTargetButtons = getCollapseTargetButtons()
        if (collapseTargetButtons.length === 0) {
            removeCollapseToggleButton()
            return
        }

        collapseToggleButton = document.createElement('button')
        collapseToggleButton.id = 'collapse-toggle-btn'
        collapseToggleButton.className = 'collapse-toggle-btn'
        collapseToggleButton.title = 'Show hidden buttons'
        collapseToggleButton.setAttribute('aria-label', 'Toggle hidden buttons')
        
        updateToggleButtonText(false)
        collapseToggleButton.addEventListener('click', toggleCollapseButtons)

        // 直接追加到 menu-bar，由排序功能決定位置
        menuBar.appendChild(collapseToggleButton)
        
        initCollapseButtons()
        document.addEventListener('click', handleOutsideClick)
        setTimeout(scheduleReorder, 100)
        
        // 重置重試計數
        collapseCreateRetries = 0
    }

    const removeCollapseToggleButton = () => {
        if (collapseToggleButton) {
            collapseToggleButton.remove()
            collapseToggleButton = null
        }
        collapseTargetButtons.forEach(btn => {
            if (btn.dataset.origDisplay) {
                btn.style.removeProperty('display')
                delete btn.dataset.origDisplay
            } else {
                btn.style.removeProperty('display')
            }
        })
        collapseTargetButtons = []
        isCollapseExpanded = false
        document.removeEventListener('click', handleOutsideClick)
    }

    const rebuildCollapse = () => {
        if (collapseRebuildTimeout) {
            clearTimeout(collapseRebuildTimeout)
        }
        collapseRebuildTimeout = setTimeout(() => {
            if (collapseObserver) {
                collapseObserver.disconnect()
                collapseObserver = null
            }
            
            collapseTargetButtons.forEach(btn => {
                if (btn.dataset.origDisplay) {
                    btn.style.removeProperty('display')
                    delete btn.dataset.origDisplay
                } else {
                    btn.style.removeProperty('display')
                }
            })
            collapseTargetButtons = []
            isCollapseExpanded = false
            
            collapseCreateRetries = 0
            createCollapseToggleButton()
            setupCollapseObserver()
            
            collapseRebuildTimeout = null
        }, 100)
    }

    const setupCollapseObserver = () => {
        if (collapseObserver) {
            collapseObserver.disconnect()
            collapseObserver = null
        }

        const menuBar = document.getElementById('menu-bar')
        if (!menuBar) {
            setTimeout(setupCollapseObserver, 200)
            return
        }

        collapseObserver = new MutationObserver(() => {
            applyCollapseState()
        })

        collapseObserver.observe(menuBar, {
            childList: true,
            subtree: false,
            attributes: true,
            attributeFilter: ['style']
        })
    }

    HFS.onEvent('configChanged', () => {
        setTimeout(rebuildCollapse, 200)
    })

    HFS.watchState('list', () => {
        setTimeout(() => {
            scheduleReorder()
            setTimeout(applyCollapseState, 100)
        }, 50)
    }, false)

    // 延遲初始化（由 appendMenuBar 事件觸發創建，這裡作為備用）
    setTimeout(() => {
        createCollapseToggleButton()
        setupCollapseObserver()
        setTimeout(scheduleReorder, 100)
        setTimeout(applyCollapseState, 200)
    }, 300)

    HFS.onEvent('beforeUnload', () => {
        if (collapseObserver) {
            collapseObserver.disconnect()
            collapseObserver = null
        }
        if (collapseRebuildTimeout) {
            clearTimeout(collapseRebuildTimeout)
            collapseRebuildTimeout = null
        }
        if (collapseToggleButton) {
            collapseToggleButton.remove()
            collapseToggleButton = null
        }
        if (tileSizeClickTimer) {
            clearTimeout(tileSizeClickTimer)
            tileSizeClickTimer = null
        }
        document.removeEventListener('click', handleOutsideClick)
    })
}