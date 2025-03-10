// 全局变量声明
let dialogElement = null;
let closeHandler = null;

// 使用highlighter的实例
const highlighter = window.highlighter;

// 确保highlighter初始化
function ensureHighlighter() {
  if (!window.highlighter) {
    try {
      window.highlighter = new TextHighlighter();
      return true;
    } catch (error) {
      console.error("创建高亮器失败:", error);
      return false;
    }
  }
  return true;
}

// 启动初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initialize());
} else {
  initialize();
}

// 在文件顶部添加i18n辅助函数
function getTranslation(key, fallback) {
  if (chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
    const translated = chrome.i18n.getMessage(key);
    if (translated) {
      return translated;
    }
  }
  return fallback || key;
}

// 简化的节点处理函数
function processNodes(nodes, options = {}) {
  if (!nodes || !nodes.size) return Promise.resolve(0);
  
  if (!ensureHighlighter()) {
    return Promise.reject(new Error("高亮器未初始化"));
  }

  try {
    const startTime = performance.now();
    let processedCount = 0;

    // 直接处理所有节点
    for (const node of nodes) {
      if (node instanceof Node && document.contains(node)) {
        if (isHighlightedText(node)) continue;

        if (window.tabActive && window.keywords?.length) {
          window.highlighter.highlight(node, window.keywords);
        } else {
          window.highlighter.clearHighlight(node);
        }
        
        processedCount++;
      }
    }

    const duration = performance.now() - startTime;
    if (processedCount > 10 || duration > 20) {
      console.debug(`处理了${processedCount}个节点，耗时${duration.toFixed(2)}ms`);
    }

    return Promise.resolve(processedCount);
  } catch (error) {
    console.error("处理节点失败:", error);
    return Promise.reject(error);
  }
}

// 简化的DOM观察器
function setupUnifiedObserver() {
  let lastUrl = location.href;
  
  const mutationObserver = new MutationObserver((mutations) => {
    try {
      // 检查URL变化
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        window.highlighter?.clearCache();
        
        if (window.tabActive && window.keywords?.length) {
          window.highlighter.highlight(document.body, window.keywords);
        }
        return;
      }

      // 直接收集和处理变更节点
      const nodesToProcess = new Set();

      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && !isHighlightedText(node)) {
              nodesToProcess.add(node);
            }
          });
        }
        
        if (mutation.type === "characterData" && mutation.target) {
          const parentElement = mutation.target.parentElement;
          if (parentElement && !isHighlightedText(parentElement)) {
            nodesToProcess.add(parentElement);
          }
        }
      });

      // 如果有需要处理的节点，立即处理
      if (nodesToProcess.size > 0) {
        processNodes(nodesToProcess);
      }
    } catch (error) {
      console.error("DOM观察器错误:", error);
    }
  });

  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  return mutationObserver;
}

// 初始化函数 - 增强错误恢复能力
async function initialize(retryCount = 0) {
  try {
    // 确保高亮器初始化
    if (!ensureHighlighter()) {
      throw new Error("高亮器初始化失败");
    }
    
    // 预先设置默认状态
    window.tabActive = false;
    window.keywords = [];
    
    // 注入i18n对象 - 直接使用chrome.i18n
    window.i18n = {
      getMessage: function(key, fallback) {
        return getTranslation(key, fallback);
      }
    };
    
    // 异步获取状态
    const [isActive, keywords] = await Promise.all([
      chrome.runtime.sendMessage({
        opt: "rpc",
        func: "getActiveStatus",
      }),
      chrome.runtime.sendMessage({
        opt: "rpc",
        func: "getKeywords",
      }),
    ]);

    // 更新状态
    window.tabActive = isActive;
    window.keywords = keywords || [];

    // 设置DOM观察器
    const mutationObserver = setupUnifiedObserver();

    // 页面卸载时的清理
    window.addEventListener(
      "unload",
      () => {
        if (dialogElement) {
          document.removeEventListener("mousedown", closeHandler);
          dialogElement.remove();
          dialogElement = null;
        }
        mutationObserver?.disconnect();
        window.highlighter?.clearCache();
      },
      { once: true }
    );

    // 监听语言变更
    window.addEventListener('storage', function(e) {
      if (e.key === 'highlighter_language') {
        // 更新当前语言
        const newLang = e.newValue || 'zh_CN';
        if (window.i18n) {
          window.i18n.currentLang = newLang;
        }
      }
    });

    // 直接处理初始内容
    if (window.tabActive && window.keywords?.length) {
      // 使用requestAnimationFrame确保在浏览器空闲时执行
      requestAnimationFrame(() => {
        window.highlighter.highlight(document.body, window.keywords);
      });
    }
  } catch (error) {
    console.error("初始化失败:", error);
    if (retryCount < 3) {
      setTimeout(() => initialize(retryCount + 1), 300 * (retryCount + 1));
    }
  }
}

// 统一的高亮处理
function handleHighlight(element, keywords, shouldClear = true) {
  if (!window.highlighter || !element) return;

  try {
    if (shouldClear) {
      window.highlighter.clearHighlight(element);
    }

    if (keywords?.length) {
      window.highlighter.highlight(element, keywords);
    }
  } catch (error) {
    Utils.handleError(error, "handleHighlight", "DOM");
  }
}

// 处理删除高亮
async function handleRemoveHighlight() {
  try {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (!text) return;

    // 获取当前所有分类
    const response = await chrome.runtime.sendMessage({
      opt: "rpc",
      func: "getKeywordsString2",
    });

    const categories = response || [];
    let removed = false;

    // 从所有分类中删除选中的文本
    categories.forEach((category) => {
      if (category.data) {
        const words = category.data.trim().split(/\s+/);
        const index = words.indexOf(text);
        if (index !== -1) {
          words.splice(index, 1);
          category.data = words.join(" ");
          removed = true;
        }
      }
    });

    if (removed) {
      // 保存更新
      await chrome.runtime.sendMessage({
        opt: "rpc",
        func: "setKeywordsString2",
        args: [categories],
      });

      // 通知刷新高亮
      await chrome.runtime.sendMessage({
        opt: "event",
        event: "reapplyHighlights",
      });
    }
  } catch (error) {
    console.error("删除高亮失败:", error);
  }
}

// 消息处理
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "add-to-category") {
    handleSelection();
  } else if (message.type === "remove-highlight") {
    handleRemoveHighlight();
  } else if (message.opt === "event") {
    switch (message.event) {
      case "storageChange":
        if (message.args.key === "isActive") {
          window.tabActive = message.args.value;
          if (window.tabActive && window.keywords?.length) {
            handleHighlight(document.body, window.keywords);
          } else {
            handleHighlight(document.body, null, true);
          }
        } else if (message.args.key === "fwm_keywordsArray") {
          window.keywords = message.args.value || [];
          if (window.tabActive) {
            handleHighlight(document.body, window.keywords);
          }
        }
        break;

      case "clearHighlights":
        handleHighlight(document.body, null, true);
        break;

      case "reapplyHighlights":
        if (window.tabActive && window.keywords?.length) {
          handleHighlight(document.body, window.keywords);
        }
        break;
    }
  }
});

// 检查节点是否已经高亮
function isHighlightedText(node) {
  if (!node) return false;

  // 检查当前节点
  if (
    node.nodeType === Node.ELEMENT_NODE &&
    node.classList?.contains(window.highlighter.config.className)
  ) {
    return true;
  }

  // 检查父节点
  let parent = node.parentElement;
  while (parent) {
    if (parent.classList?.contains(window.highlighter.config.className)) {
      return true;
    }
    parent = parent.parentElement;
  }

  return false;
}

// 添加选择文本处理
async function handleSelection() {
  try {
    // 获取选中的文本
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const text = selection.toString().trim();
    if (!text) return;
    
    // 获取选区位置
    const range = selection.getRangeAt(selection.rangeCount - 1);
    const rect = range.getBoundingClientRect();
    
    // 计算弹窗位置
    const position = {
      x: Math.min(rect.left, window.innerWidth - 320),
      y: Math.min(rect.bottom + window.scrollY, window.innerHeight - 420),
    };
    
    // 获取分类列表
    const categories = await chrome.runtime.sendMessage({
      opt: "rpc",
      func: "getKeywordsString2",
    });
    
    // 如果已存在弹窗则移除
    if (dialogElement) {
      dialogElement.remove();
    }
    
    // 创建弹窗
    dialogElement = document.createElement("div");
    dialogElement.className = "highlight-dialog";
    dialogElement.style.cssText = `
      position: fixed;
      left: ${position.x}px;
      top: ${position.y}px;
      z-index: 2147483647;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1);
      padding: 12px;
      max-width: 300px;
      width: 100%;
      max-height: 400px;
      overflow-y: auto;
    `;
    
    // 添加标题 - 使用chrome.i18n
    const title = document.createElement("div");
    title.style.cssText = `
      font-size: 14px;
      color: #606266;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #ebeef5;
    `;
    title.textContent = chrome.i18n.getMessage("selectCategory");
    dialogElement.appendChild(title);
    
    // 添加分类列表
    categories.forEach((category) => {
      const item = document.createElement("div");
      item.style.cssText = `
        display: flex;
        align-items: center;
        padding: 8px;
        cursor: pointer;
        border-radius: 4px;
        margin-bottom: 4px;
        transition: background-color 0.2s;
      `;
      item.innerHTML = `
        <div class="chrome-extension-mutihighlight-style-${category.colour}" 
             style="width:16px;height:16px;margin-right:8px;border-radius:2px;">
        </div>
        <span style="flex:1;color:#606266;">${
          category.name || chrome.i18n.getMessage("untitledCategory")
        }</span>
      `;
      
      // 悬停效果
      item.onmouseover = () => (item.style.backgroundColor = "#f5f7fa");
      item.onmouseout = () => (item.style.backgroundColor = "transparent");
      
      // 点击处理
      item.onclick = async () => {
        try {
          const words = new Set((category.data || "").trim().split(/\s+/));
          words.add(text);
          category.data = Array.from(words).join(" ");
          
          // 更新数据
          await chrome.runtime.sendMessage({
            opt: "rpc",
            func: "setKeywordsString2",
            args: [categories],
          });
          
          // 刷新高亮
          chrome.runtime.sendMessage({
            opt: "event",
            event: "reapplyHighlights",
          });
          
          // 关闭弹窗
          dialogElement.remove();
          dialogElement = null;
        } catch (error) {
          console.error("添加高亮失败:", error);
        }
      };
      
      dialogElement.appendChild(item);
    });
    
    // 添加到页面
    document.body.appendChild(dialogElement);
    
    // 点击其他区域关闭弹窗
    closeHandler = (e) => {
      if (!dialogElement?.contains(e.target)) {
        dialogElement?.remove();
        dialogElement = null;
        document.removeEventListener("mousedown", closeHandler);
        closeHandler = null;
      }
    };
    document.addEventListener("mousedown", closeHandler);
  } catch (error) {
    console.error("处理选择文本失败:", error);
  }
}

// 只处理快捷键和右键菜单消息
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "add-to-category") {
    handleSelection();
  }
});

// 在reapplyHighlights处理程序中添加颜色更新支持
async function reapplyHighlights() {
  try {
    // 获取当前分类
    const response = await chrome.runtime.sendMessage({
      opt: "rpc", 
      func: "getKeywordsString2"
    });
    
    if (!response) return;
    
    // 标记需要更新颜色
    response.forEach(category => {
      if (category && typeof category === 'object') {
        category._colorUpdated = true;
      }
    });
    
    // 将分类转换为高亮关键词
    const keywords = [];
    response.forEach(category => {
      if (category.status !== 1) return;
      
      const words = (category.data || "").trim().split(/\s+/);
      words.forEach(word => {
        if (word) {
          keywords.push({
            words: word,
            colour: category.colour || 1,
            _colorUpdated: true // 标记需要刷新颜色
          });
        }
      });
    });
    
    // 应用高亮
    if (keywords.length > 0) {
      // 强制清除缓存确保颜色正确应用
      window.highlighter.clearCache();
      window.highlighter.highlight(document.body, keywords);
    } else {
      window.highlighter.clearHighlight(document.body);
    }
  } catch (error) {
    console.error("重新应用高亮失败:", error);
  }
}

// 监听配置更新事件
window.addEventListener('highlighter:config-updated', (e) => {
  if (e.detail && e.detail.colorChanged) {
    reapplyHighlights();
  }
});
