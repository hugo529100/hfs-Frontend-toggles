(() => {
  // 檢查是否存在 showing-container 元素
  const isShowingMode = () => {
    return document.querySelector('.showing-container') !== null;
  };

  const STORAGE_KEY_OPTIMIZE = 'hfs_optimize_scope';
  const OPTIMIZE_SCOPE_ID = 'optimize-scope-select';
  const SETTINGS_PANEL_ID = 'performance-settings-panel';
  
  // 監控狀態標記
  let videoPlayerVisible = false;
  let imageViewerVisible = false;
  let mediaCheckInterval = null;
  let mediaObserver = null;
  let visibilityObserver = null;
  let showingObserver = null;
  let isScriptActive = false;
  const CHECK_INTERVAL = 500;

  // 優化範圍選項
  const OPTIMIZE_SCOPES = {
    0: { name: 'Disabled' },
    1: { name: 'Video Only' },
    2: { name: 'Video and Image' },
    3: { name: 'Full Page' }
  };

  // 檢查 localStorage 是否支持
  const isLocalStorageSupported = () => {
    try {
      localStorage.setItem('test', '1');
      localStorage.removeItem('test');
      return true;
    } catch (e) {
      return false;
    }
  };

  // 獲取儲存的優化範圍
  const getOptimizeScope = () => {
    if (!isLocalStorageSupported()) return 2;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY_OPTIMIZE);
      if (stored !== null) {
        const value = parseInt(stored);
        if (value >= 0 && value <= 3) return value;
      }
      return 2;
    } catch (e) {
      return 2;
    }
  };

  // 儲存優化範圍
  const setOptimizeScope = (value) => {
    if (isLocalStorageSupported()) {
      localStorage.setItem(STORAGE_KEY_OPTIMIZE, value.toString());
    }
  };

  // 切換性能優化模式
  const toggleOptimization = (enable) => {
    if (!document.body) return;
    
    if (enable) {
      document.body.classList.add('accelerated-mode');
    } else {
      document.body.classList.remove('accelerated-mode');
    }
  };

  // 檢查是否需要啟用優化
  const checkAndApplyOptimization = () => {
    const scope = getOptimizeScope();
    
    switch (scope) {
      case 0:
        toggleOptimization(false);
        break;
        
      case 1:
        toggleOptimization(videoPlayerVisible && !imageViewerVisible);
        break;
        
      case 2:
        toggleOptimization(videoPlayerVisible || imageViewerVisible);
        break;
        
      case 3:
        toggleOptimization(true);
        break;
        
      default:
        toggleOptimization(false);
    }
  };

  // 檢查是否為視頻播放器
  const isVideoPlayer = (el) => {
    if (!el) return false;
    
    if (el.nodeName === 'VIDEO') {
      return true;
    }
    
    if (el.classList) {
      if (el.classList.contains('video-player') || 
          el.classList.contains('player') ||
          el.classList.contains('media-player') ||
          el.classList.contains('video-container')) {
        if (el.querySelector('video')) {
          return true;
        }
      }
    }
    
    if (el.getAttribute('role') === 'dialog' && el.classList.contains('contain')) {
      if (el.querySelector('video')) {
        return true;
      }
    }
    
    return false;
  };

  // 檢查是否為圖片瀏覽器
  const isImageViewer = (el) => {
    if (!el || !el.classList) return false;
    
    if (el.nodeName === 'VIDEO' || el.querySelector('video')) {
      return false;
    }
    
    if (el.getAttribute('role') === 'dialog' && el.classList.contains('contain')) {
      if (el.querySelector('video')) {
        return false;
      }
      
      const hasShowingContainer = el.querySelector('.showing-container');
      const hasShowingImage = el.querySelector('img.showing');
      const hasPreviewControls = el.querySelector('.preview-controls-fullscreen-btn');
      
      if ((hasShowingContainer && hasShowingImage) || hasPreviewControls) {
        return true;
      }
    }
    
    if (el.classList.contains('showing-container') && el.querySelector('img.showing')) {
      if (!el.querySelector('video')) {
        return true;
      }
    }
    
    if (el.classList.contains('showing') && el.nodeName === 'IMG') {
      const dialog = el.closest('[role="dialog"].contain');
      if (dialog && !dialog.querySelector('video')) {
        return true;
      }
    }
    
    return false;
  };

  // 獲取所有需要監控的媒體元素
  const getMediaElements = () => {
    const elements = {
      videos: [],
      images: []
    };
    
    // 主要針對 showing-container 內的媒體元素
    const showingContainers = document.querySelectorAll('.showing-container');
    
    showingContainers.forEach(container => {
      // 檢查 showing-container 內的 video 元素
      const videos = container.querySelectorAll('video');
      videos.forEach(video => {
        if (!elements.videos.includes(video)) {
          elements.videos.push(video);
        }
      });
      
      // 檢查 showing-container 內的 video-js 播放器
      const videoPlayers = container.querySelectorAll('.video-js');
      videoPlayers.forEach(player => {
        if (!elements.videos.includes(player)) {
          elements.videos.push(player);
        }
      });
      
      // 檢查 showing-container 內的圖片
      const showingImages = container.querySelectorAll('img.showing');
      showingImages.forEach(img => {
        if (!elements.images.includes(img)) {
          elements.images.push(img);
        }
      });
    });
    
    return elements;
  };

  // 檢查元素是否在視口中可見
  const isElementInViewport = (el) => {
    if (!el) return false;
    
    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;
    
    const vertInView = (rect.top <= windowHeight) && ((rect.top + rect.height) >= 0);
    const horInView = (rect.left <= windowWidth) && ((rect.left + rect.width) >= 0);
    
    return vertInView && horInView;
  };

  // 檢查元素是否實際可見
  const isElementActuallyVisible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  };

  // 更新媒體可見性狀態
  const updateMediaVisibility = () => {
    // 只有在 showing-container 存在時才檢查
    if (!isShowingMode()) {
      return;
    }
    
    const elements = getMediaElements();
    let newVideoVisible = false;
    let newImageVisible = false;
    
    for (const video of elements.videos) {
      if (isElementInViewport(video) && isElementActuallyVisible(video)) {
        newVideoVisible = true;
        break;
      }
    }
    
    for (const image of elements.images) {
      if (isElementInViewport(image) && isElementActuallyVisible(image)) {
        newImageVisible = true;
        break;
      }
    }
    
    const videoChanged = (newVideoVisible !== videoPlayerVisible);
    const imageChanged = (newImageVisible !== imageViewerVisible);
    
    videoPlayerVisible = newVideoVisible;
    imageViewerVisible = newImageVisible;
    
    if (videoChanged || imageChanged) {
      checkAndApplyOptimization();
    }
  };

  // 使用 Intersection Observer 監控媒體可見性
  const setupVisibilityObserver = () => {
    if (visibilityObserver) {
      visibilityObserver.disconnect();
    }
    
    visibilityObserver = new IntersectionObserver((entries) => {
      let needsUpdate = false;
      
      for (const entry of entries) {
        const el = entry.target;
        if (!isElementActuallyVisible(el)) continue;
        
        if (isVideoPlayer(el)) {
          const wasVisible = videoPlayerVisible;
          videoPlayerVisible = entry.isIntersecting;
          if (wasVisible !== videoPlayerVisible) needsUpdate = true;
        } 
        else if (isImageViewer(el)) {
          const wasVisible = imageViewerVisible;
          imageViewerVisible = entry.isIntersecting;
          if (wasVisible !== imageViewerVisible) needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        checkAndApplyOptimization();
      }
    }, {
      threshold: 0.1
    });
    
    const elements = getMediaElements();
    elements.videos.forEach(video => visibilityObserver.observe(video));
    elements.images.forEach(image => visibilityObserver.observe(image));
  };

  // 啟動腳本功能
  const activateScript = () => {
    if (isScriptActive) return;
    
    console.log('Performance optimization activated for showing-container');
    isScriptActive = true;
    
    // 初始化優化狀態
    checkAndApplyOptimization();
    
    // 開始媒體監控
    if (!window.IntersectionObserver) {
      if (mediaCheckInterval) {
        clearInterval(mediaCheckInterval);
      }
      mediaCheckInterval = setInterval(updateMediaVisibility, CHECK_INTERVAL);
    } else {
      setupVisibilityObserver();
    }
    
    // 設置媒體監控的 DOM 變化觀察器（限制在 showing-container 內）
    if (mediaObserver) {
      mediaObserver.disconnect();
    }
    
    const showingContainer = document.querySelector('.showing-container');
    if (showingContainer) {
      mediaObserver = new MutationObserver((mutations) => {
        let needsRecheck = false;
        
        for (const mutation of mutations) {
          if (mutation.addedNodes.length) {
            for (const node of mutation.addedNodes) {
              if (!node.nodeType || node.nodeType !== 1) continue;
              
              if (isVideoPlayer(node) || isImageViewer(node)) {
                if (visibilityObserver) visibilityObserver.observe(node);
                needsRecheck = true;
              }
              
              if (node.querySelectorAll) {
                const videos = node.querySelectorAll('video');
                videos.forEach(video => {
                  if (isVideoPlayer(video) && visibilityObserver) {
                    visibilityObserver.observe(video);
                    needsRecheck = true;
                  }
                });
                
                const showingImages = node.querySelectorAll('img.showing');
                showingImages.forEach(img => {
                  if (isImageViewer(img) && visibilityObserver) {
                    visibilityObserver.observe(img);
                    needsRecheck = true;
                  }
                });
              }
            }
          }
        }
        
        if (needsRecheck) {
          setTimeout(updateMediaVisibility, 100);
        }
      });
      
      mediaObserver.observe(showingContainer, {
        childList: true,
        subtree: true
      });
    }
    
    // 監聽Options對話框的出現
    const optionsObserver = new MutationObserver((mutations) => {
      if (document.querySelector('.dialog-title')?.textContent.includes('Options')) {
        setTimeout(insertSettingsPanel, 100);
      }
    });
    
    optionsObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  // 停用腳本功能
  const deactivateScript = () => {
    if (!isScriptActive) return;
    
    console.log('Performance optimization deactivated');
    isScriptActive = false;
    
    // 清除媒體監控
    if (mediaCheckInterval) {
      clearInterval(mediaCheckInterval);
      mediaCheckInterval = null;
    }
    
    if (visibilityObserver) {
      visibilityObserver.disconnect();
      visibilityObserver = null;
    }
    
    if (mediaObserver) {
      mediaObserver.disconnect();
      mediaObserver = null;
    }
    
    // 清除優化狀態
    toggleOptimization(false);
    
    // 重置狀態標記
    videoPlayerVisible = false;
    imageViewerVisible = false;
  };

  // 在Options界面中添加設置面板
  const insertSettingsPanel = () => {
    const optionsDialog = document.querySelector('.dialog[aria-modal="true"]');
    if (!optionsDialog) return;

    const themeSelect = document.getElementById('option-theme');
    if (!themeSelect) return;

    if (document.getElementById(SETTINGS_PANEL_ID)) {
      return;
    }

    const currentScope = getOptimizeScope();

    const settingsHTML = `
      <div id="${SETTINGS_PANEL_ID}" style="margin-top:1em; padding-top:1em; border-top:1px solid var(--fg-2);">
        <div style="margin-bottom: 0.5em;">
          <label style="display: block; margin-bottom: 0.2em; font-size: 0.9em;">Performance Optimization Scope:</label>
          <select id="${OPTIMIZE_SCOPE_ID}" style="width: 100%; padding: 0.4em;">
            <option value="0" ${currentScope === 0 ? 'selected' : ''}>${OPTIMIZE_SCOPES[0].name}</option>
            <option value="1" ${currentScope === 1 ? 'selected' : ''}>${OPTIMIZE_SCOPES[1].name}</option>
            <option value="2" ${currentScope === 2 ? 'selected' : ''}>${OPTIMIZE_SCOPES[2].name}</option>
            <option value="3" ${currentScope === 3 ? 'selected' : ''}>${OPTIMIZE_SCOPES[3].name}</option>
          </select>
        </div>
      </div>
    `;

    themeSelect.insertAdjacentHTML('afterend', settingsHTML);

    const scopeSelect = document.getElementById(OPTIMIZE_SCOPE_ID);

    scopeSelect.addEventListener('change', (e) => {
      const newScope = parseInt(e.target.value);
      setOptimizeScope(newScope);
      checkAndApplyOptimization();
    });
  };

  // 監控 showing-container 的出現和消失
  const monitorShowingContainer = () => {
    // 初始檢查
    if (isShowingMode()) {
      activateScript();
    }
    
    // 使用 MutationObserver 監控 showing-container 的出現和消失
    showingObserver = new MutationObserver((mutations) => {
      let showingContainerChanged = false;
      
      for (const mutation of mutations) {
        // 檢查新增的節點
        if (mutation.addedNodes.length) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              if (node.classList && node.classList.contains('showing-container') || 
                  (node.querySelector && node.querySelector('.showing-container'))) {
                showingContainerChanged = true;
                break;
              }
            }
          }
        }
        
        // 檢查移除的節點
        if (mutation.removedNodes.length) {
          for (const node of mutation.removedNodes) {
            if (node.nodeType === 1) {
              if (node.classList && node.classList.contains('showing-container') || 
                  (node.querySelector && node.querySelector('.showing-container'))) {
                showingContainerChanged = true;
                break;
              }
            }
          }
        }
        
        if (showingContainerChanged) break;
      }
      
      if (showingContainerChanged) {
        // 短暫延遲確保 DOM 更新完成
        setTimeout(() => {
          if (isShowingMode()) {
            activateScript();
          } else {
            deactivateScript();
          }
        }, 100);
      }
    });
    
    // 監控整個 body 的變化
    showingObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  // 初始化
  const init = () => {
    // 檢查是否已經存在 showing-container
    if (isShowingMode()) {
      activateScript();
    }
    
    // 開始監控 showing-container 的出現和消失
    monitorShowingContainer();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();