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

  // 刷新按钮功能
  if (config.enableRefreshBtn || config.enableRefreshListBtn) {
    HFS.onEvent('afterBreadcrumbs', () => {
      setTimeout(() => {
        const parent = document.querySelector('#breadcrumb-parent')
        if (parent && !document.getElementById('refreshButton')) {
          // 创建刷新容器
          const refreshContainer = document.createElement('div')
          refreshContainer.className = 'refresh-container'
          parent.parentNode.insertBefore(refreshContainer, parent)
          
          // 添加刷新页面按钮（只保留图标，移除文字标签）
          if (config.enableRefreshBtn) {
            const refreshPageBtn = document.createElement('button')
            refreshPageBtn.id = 'refreshButton'
            refreshPageBtn.title = 'Refresh page'
            refreshPageBtn.innerHTML = '<span aria-hidden="true">♻</span>'
            refreshPageBtn.addEventListener('click', () => location.reload(true))
            refreshContainer.appendChild(refreshPageBtn)
          }
          
          // 添加刷新列表按钮（只保留图标，移除文字标签）
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

  // 全屏按钮功能
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

  // 菜单栏按钮（刷新和全屏）- 保留文字标签
  HFS.onEvent('appendMenuBar', () => {
    const buttons = []
    
    // 添加页面刷新按钮（菜单栏版本）- 保留文字标签
    if (config.enablePageRefreshBtn) {
      buttons.push(
        h('button', {
          className: 'menu-bar-refresh-btn',
          onClick: () => location.reload(true),
          title: 'Refresh Page'
        }, [
          h('span', { 'aria-hidden': 'true' }, '♻ '),
          h('span', { className: 'btn-label' }, 'Refresh')
        ])
      )
    }
    
    // 添加全屏按钮 - 保留文字标签
    if (config.enableFullscreenBtn) {
      buttons.push(
        h('button', {
          className: 'menu-bar-fullscreen-btn',
          onClick: toggleFullscreen,
          title: 'Toggle Fullscreen'
        }, [
          h('span', { 'aria-hidden': 'true' }, '⛶'),
          h('span', { className: 'btn-label' }, 'Fullscreen')
        ])
      )
    }
    
    return buttons
  })

  // 预览控制栏全屏按钮 - 保留文字标签
  if (config.enableFullscreenBtn) {
    setInterval(() => {
      const controls = document.querySelector('.file-show .bar .controls')
      const closeBtn = controls?.querySelector('button[title="Close"]')
      const exists = controls?.querySelector('.preview-controls-fullscreen-btn')

      if (controls && closeBtn && !exists) {
        const btn = document.createElement('button')
        btn.className = 'preview-controls-fullscreen-btn'
        btn.title = 'Toggle Fullscreen'
        btn.innerHTML = '<span aria-hidden="true">⛶</span> <span class="btn-label">Fullscreen</span>'
        btn.onclick = toggleFullscreen
        controls.insertBefore(btn, closeBtn)
      }
    }, 500)
  }
}