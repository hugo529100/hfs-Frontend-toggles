// main.js
'use strict'; {
  const config = HFS.getPluginConfig()
  const h = HFS.h

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

  // 按鈕排序功能
  let isReordering = false
  let reorderTimeout = null
  let menuBarObserver = null
  let menuBarObserverRetries = 0
  const MAX_OBSERVER_RETRIES = 10

  const reorderButtons = () => {
    // 如果未啟用自定義排序，則跳過
    if (!config.buttonOrderEnabled) return
    
    // 防止重複執行
    if (isReordering) return
    isReordering = true

    try {
      const menuBar = document.getElementById('menu-bar')
      if (!menuBar) {
        isReordering = false
        return
      }

      // 直接從配置讀取排序順序，如果為空則使用默認備用
      const orderStr = config.buttonOrder || `login-button
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
      
      // 按行分割，過濾空行和空白
      const orderList = orderStr.split('\n')
        .map(id => id.trim())
        .filter(id => id && id.length > 0)

      // 獲取所有按鈕元素
      const buttons = Array.from(menuBar.children)
      
      // 如果按鈕數量很少，可能是正在加載，跳過排序
      if (buttons.length < 3) {
        isReordering = false
        return
      }

      // 檢查是否已經按照正確順序排列
      let needsReorder = false
      const currentOrder = buttons.map(el => el.id || el.className)
      
      // 檢查前幾個按鈕是否匹配配置順序
      for (let i = 0; i < Math.min(orderList.length, currentOrder.length); i++) {
        const expectedId = orderList[i]
        const currentId = currentOrder[i]
        if (!currentId.includes(expectedId.replace('menu-bar-', ''))) {
          needsReorder = true
          break
        }
      }

      // 如果不需要重新排序，直接返回
      if (!needsReorder) {
        isReordering = false
        return
      }

      // 按順序重新排列
      const orderedButtons = []
      const remainingButtons = []

      // 先按照配置順序添加
      orderList.forEach(id => {
        const btn = buttons.find(el => {
          if (el.id === id) return true
          if (el.classList) {
            if (el.classList.contains(id)) return true
            if (id.startsWith('menu-bar-') && el.classList.contains(id)) return true
            if (id === 'hfs-sync-button' && el.classList.contains('hfs-sync-button')) return true
          }
          return false
        })
        if (btn && !orderedButtons.includes(btn)) {
          orderedButtons.push(btn)
        }
      })

      // 添加未在配置中的按鈕
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

      // 批量更新 DOM
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

  // 使用 requestAnimationFrame 優化排序時機
  const scheduleReorder = () => {
    if (reorderTimeout) {
      cancelAnimationFrame(reorderTimeout)
    }
    reorderTimeout = requestAnimationFrame(() => {
      reorderButtons()
      reorderTimeout = null
    })
  }

  // 在頁面加載時和菜單欄更新時重新排序
  HFS.onEvent('afterBreadcrumbs', () => {
    setTimeout(scheduleReorder, 150)
  })

  // 監聽菜單欄變化（改進版，有重試限制）
  const setupMenuBarObserver = () => {
    // 如果重試次數超過限制，停止重試
    if (menuBarObserverRetries >= MAX_OBSERVER_RETRIES) {
      return
    }

    const menuBar = document.getElementById('menu-bar')
    if (!menuBar) {
      menuBarObserverRetries++
      setTimeout(setupMenuBarObserver, 200)
      return
    }

    // 重置重試計數
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
        // 重置標誌，避免阻塞後續觸發
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

  // 監聽配置變化
  HFS.onEvent('configChanged', () => {
    setTimeout(scheduleReorder, 200)
  })

  // 刷新按鈕功能
  if (config.enableRefreshBtn || config.enableRefreshListBtn) {
    HFS.onEvent('afterBreadcrumbs', () => {
      setTimeout(() => {
        const parent = document.querySelector('#breadcrumb-parent')
        if (parent && !document.getElementById('refreshButton')) {
          const refreshContainer = document.createElement('div')
          refreshContainer.className = 'refresh-container'
          parent.parentNode.insertBefore(refreshContainer, parent)
          
          if (config.enableRefreshBtn) {
            const refreshPageBtn = document.createElement('button')
            refreshPageBtn.id = 'refreshButton'
            refreshPageBtn.title = 'Refresh page'
            refreshPageBtn.innerHTML = '<span aria-hidden="true">▲</span>'
            refreshPageBtn.addEventListener('click', () => location.reload(true))
            refreshContainer.appendChild(refreshPageBtn)
          }
          
          if (config.enableRefreshListBtn) {
            const refreshListBtn = document.createElement('button')
            refreshListBtn.id = 'refreshListButton'
            refreshListBtn.title = 'Refresh list'
            refreshListBtn.innerHTML = '<span aria-hidden="true">▤</span>'
            refreshListBtn.addEventListener('click', () => HFS.reloadList())
            refreshContainer.appendChild(refreshListBtn)
          }
        }
      }, 0)
    })
  }

  // 全屏按鈕功能
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

  // 菜單欄按鈕（刷新和全屏）
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
    
    setTimeout(scheduleReorder, 300)
    
    return buttons
  })

  // 預覽控制欄全屏按鈕（改進版）
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
        
        // 按鈕添加成功後，可以考慮停止觀察
        if (previewObserver) {
          previewObserver.disconnect()
          previewObserver = null
        }
      }
    }

    // 使用更精確的觀察目標
    previewObserver = new MutationObserver(() => {
      addPreviewFullscreenButton()
    })

    // 只觀察 body 的 childList 變化，減少不必要的觸發
    previewObserver.observe(document.body, {
      childList: true,
      subtree: false,
      attributes: false
    })

    // 延遲執行
    const delays = [500, 1000, 2000]
    delays.forEach(delay => {
      setTimeout(addPreviewFullscreenButton, delay)
    })
  }
}